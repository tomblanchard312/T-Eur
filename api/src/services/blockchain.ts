import { ethers, Contract, JsonRpcProvider } from 'ethers';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { parameters } from '../config/parameters.js';
import { logger, logAuditEvent } from '../utils/logger.js';
import { BlockchainError } from '../middleware/errors.js';
import {
  WalletRegistryABI,
  TokenizedEuroABI,
  ConditionalPaymentsABI,
  PermissioningABI,
  WalletType,
  ConditionType,
  PaymentStatus,
} from './abi.js';
import { createSigner, type ManagedSigner } from './signer.js';

export { WalletType, ConditionType, PaymentStatus };

export const ROLES = {
  DEFAULT_ADMIN_ROLE: ethers.ZeroHash,
  MINTER_ROLE: ethers.keccak256(ethers.toUtf8Bytes('MINTER_ROLE')),
  BURNER_ROLE: ethers.keccak256(ethers.toUtf8Bytes('BURNER_ROLE')),
  PAUSER_ROLE: ethers.keccak256(ethers.toUtf8Bytes('PAUSER_ROLE')),
  REGISTRAR_ROLE: ethers.keccak256(ethers.toUtf8Bytes('REGISTRAR_ROLE')),
  WATERFALL_OPERATOR_ROLE: ethers.keccak256(ethers.toUtf8Bytes('WATERFALL_OPERATOR_ROLE')),
  EMERGENCY_ROLE: ethers.keccak256(ethers.toUtf8Bytes('EMERGENCY_ROLE')),
  ARBITER_ROLE: ethers.keccak256(ethers.toUtf8Bytes('ARBITER_ROLE')),
  ECB_ROLE: ethers.keccak256(ethers.toUtf8Bytes('ECB_ROLE')),
  STATE_BANK_ROLE: ethers.keccak256(ethers.toUtf8Bytes('STATE_BANK_ROLE')),
  LOCAL_BANK_ROLE: ethers.keccak256(ethers.toUtf8Bytes('LOCAL_BANK_ROLE')),
  PSP_ROLE: ethers.keccak256(ethers.toUtf8Bytes('PSP_ROLE')),
  MERCHANT_ROLE: ethers.keccak256(ethers.toUtf8Bytes('MERCHANT_ROLE')),
  WALLET_HOLDER_ROLE: ethers.keccak256(ethers.toUtf8Bytes('WALLET_HOLDER_ROLE')),
} as const;

// Lightweight numeric wrapper for returned big values
type EBig = { toString(): string; toNumber?: () => number };

/**
 * Mirrors IWalletRegistry.WalletInfo. Field order matches the struct exactly;
 * ethers decodes tuples positionally, so a reordering here silently yields
 * wrong values rather than an error.
 */
type WalletInfo = {
  walletType: number | EBig;
  linkedBankAccount: string;
  customLimit: EBig;
  registrationTime: EBig;
  isActive: boolean;
  kycHash: string;
};

/** Mirrors IConditionalPayments.ConditionalPayment. */
type PaymentInfo = {
  paymentId: string;
  payer: string;
  payee: string;
  amount: EBig;
  conditionType: number | EBig;
  conditionData: string;
  createdAt: EBig;
  expiresAt: EBig;
  status: number | EBig;
  arbiter: string;
};

/**
 * BlockchainService: Orchestrates interactions with the tEUR smart contracts.
 * 
 * FINANCIAL SYSTEM SAFETY REQUIREMENTS:
 * 1. No Fail-Open: If a security or policy check (e.g., holding limits, intermediary verification) 
 *    cannot be completed due to technical failure, the transaction MUST be blocked.
 * 2. Explicit Failure: All errors must be caught, logged with structured context, and 
 *    rethrown as explicit BlockchainError types to prevent silent degradation.
 * 3. Integrity Protection: Transaction receipts must be verified for success (status === 1).
 * 4. Schema Enforcement: Contract return data must be validated against expected types 
 *    to prevent issues from unexpected contract upgrades or schema evolution.
 */
class BlockchainService {
  private provider: JsonRpcProvider;
  private managedSigner?: ManagedSigner;
  private operatorAddress = '';
  private contracts?: {
    walletRegistry: Contract;
    tokenizedEuro: Contract;
    conditionalPayments: Contract;
    permissioning: Contract;
  };
  private initialized = false;

  constructor() {
    this.provider = new JsonRpcProvider(config.blockchain.rpcUrl);
  }

  /**
   * Contracts are bound during initialize() rather than in the constructor
   * because signer creation is asynchronous under the KMS backend.
   */
  private bound() {
    if (!this.contracts) {
      throw new BlockchainError('Blockchain service has not been initialized');
    }
    return this.contracts;
  }

  private get _walletRegistry(): Contract { return this.bound().walletRegistry; }
  private get _tokenizedEuro(): Contract { return this.bound().tokenizedEuro; }
  private get _conditionalPayments(): Contract { return this.bound().conditionalPayments; }
  private get _permissioning(): Contract { return this.bound().permissioning; }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.managedSigner = await createSigner(this.provider, {
        backend: config.blockchain.signerBackend,
        privateKey: config.blockchain.operatorPrivateKey,
        kmsKeyId: config.blockchain.kmsKeyId,
        permitsLocalKeys: config.nodeEnv === 'development' || config.nodeEnv === 'test',
      });
      this.operatorAddress = await this.managedSigner.getAddress();

      const signer = this.managedSigner.signer;
      this.contracts = {
        walletRegistry: new Contract(config.contracts.walletRegistry, WalletRegistryABI, signer),
        tokenizedEuro: new Contract(config.contracts.tokenizedEuro, TokenizedEuroABI, signer),
        conditionalPayments: new Contract(config.contracts.conditionalPayments, ConditionalPaymentsABI, signer),
        permissioning: new Contract(config.contracts.permissioning, PermissioningABI, signer),
      };

      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();

      if (network.chainId !== BigInt(config.blockchain.chainId)) {
        throw new BlockchainError(
          `Connected chain ${network.chainId} does not match configured chain ${config.blockchain.chainId}`,
        );
      }

      // OWASP: Security Logging and Monitoring - Log service startup
      logger.info('BLOCKCHAIN_SERVICE', 'RESOURCE_CREATED', {
        chainId: network.chainId.toString(),
        blockNumber,
        // Sanitized: only log address, never key material
        resourceId: this.operatorAddress,
      });

      this.initialized = true;
    } catch (error) {
      logger.error('BLOCKCHAIN_SERVICE', 'INTERNAL_SERVER_ERROR', {
        errorCode: 'BLOCKCHAIN_INIT_FAILED',
        details: { errorType: error instanceof Error ? error.name : 'unknown' },
      });
      if (error instanceof BlockchainError) throw error;
      throw new BlockchainError('Failed to connect to blockchain');
    }
  }

  // --- Typed wrapper helpers for contract calls ---
  private async _callWalletRegistryGetWalletInfo(wallet: string): Promise<WalletInfo> {
    const func = this._walletRegistry.getFunction('getWalletInfo');
    if (!func) throw new BlockchainError('Contract method getWalletInfo not available');
    const info = await func(wallet);
    return info as unknown as WalletInfo;
  }

  private async _callWalletRegistryIsRegistered(wallet: string): Promise<boolean> {
    const func = this._walletRegistry.getFunction('isRegistered');
    if (!func) throw new BlockchainError('Contract method isRegistered not available');
    return await func(wallet) as boolean;
  }

  private async _callWalletRegistryGetHoldingLimit(wallet: string): Promise<EBig> {
    const func = this._walletRegistry.getFunction('getHoldingLimit');
    if (!func) throw new BlockchainError('Contract method getHoldingLimit not available');
    const limit = await func(wallet);
    return limit as unknown as EBig;
  }

  private async _callTokenBalanceOf(address: string): Promise<EBig> {
    const func = this._tokenizedEuro.getFunction('balanceOf');
    if (!func) throw new BlockchainError('Contract method balanceOf not available');
    const bal = await func(address);
    return bal as unknown as EBig;
  }

  private async _callTokenTotalSupply(): Promise<EBig> {
    const func = this._tokenizedEuro.getFunction('totalSupply');
    if (!func) throw new BlockchainError('Contract method totalSupply not available');
    const s = await func();
    return s as unknown as EBig;
  }

  private async _callTokenPaused(): Promise<boolean> {
    const func = this._tokenizedEuro.getFunction('paused');
    if (!func) throw new BlockchainError('Contract method paused not available');
    return await func() as boolean;
  }

  private async _callGetPayment(paymentId: string): Promise<PaymentInfo> {
    const func = this._conditionalPayments.getFunction('getPayment');
    if (!func) throw new BlockchainError('Contract method getPayment not available');
    const p = await func(paymentId);
    return p as unknown as PaymentInfo;
  }

  private async _callHasRole(role: string, account: string): Promise<boolean> {
    const func = this._permissioning.getFunction('hasRole');
    if (!func) throw new BlockchainError('Contract method hasRole not available');
    return await func(role, account) as boolean;
  }

  /**
   * Contract idempotency parameters are bytes32, but the API accepts UUIDs.
   * A UUID is not valid bytes32 and ethers rejects it at encode time, so it is
   * hashed. Values already in bytes32 form are passed through unchanged, which
   * keeps the mapping stable and collision-free for both input shapes.
   */
  private _toBytes32Key(key: string): string {
    if (/^0x[a-fA-F0-9]{64}$/.test(key)) return key;
    return ethers.keccak256(ethers.toUtf8Bytes(key));
  }

  private _toNumber(value: number | EBig): number {
    if (typeof value === 'number') return value;
    if (value && typeof value.toNumber === 'function') return value.toNumber();
    return Number(value.toString());
  }

  private async executeTransaction(
    contract: Contract,
    method: string,
    args: unknown[],
    options: { gasLimit?: bigint; correlationId?: string; userId?: string; operation?: string } = {}
  ): Promise<{ txHash: string; blockNumber: number; receipt: ethers.TransactionReceipt }> {
    const startTime = Date.now();
    const correlationId = options.correlationId || crypto.randomUUID();

    try {
      // Pre-transaction audit log
      await logAuditEvent({
        action: 'TRANSACTION_INITIATED',
        actor: options.userId || 'system',
        resource: 'blockchain',
        resourceId: correlationId,
        details: {
          operation: options.operation || method,
          contract: contract.target.toString(),
          method,
          args: JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v),
          gasLimit: options.gasLimit?.toString(),
        },
        result: 'success',
      });

      const func = contract.getFunction(method);
      if (!func) {
        throw new BlockchainError(`Contract method ${method} not found`);
      }

      // Only pass valid ethers transaction overrides
      const overrides: { gasLimit?: bigint } = {};
      if (options.gasLimit) overrides.gasLimit = options.gasLimit;

      // Serialise submission so concurrent requests cannot claim the same
      // operator nonce. On failure the local nonce is re-synced from the chain,
      // otherwise one rejected send would strand every later transaction.
      const signer = this.managedSigner;
      if (!signer) throw new BlockchainError('Blockchain service has not been initialized');

      const receipt = await signer.runExclusive(async () => {
        try {
          const tx = await func(...args, overrides);
          return await tx.wait(config.blockchain.confirmations);
        } catch (sendError) {
          signer.reset();
          throw sendError;
        }
      });

      if (!receipt) {
        throw new BlockchainError('Transaction receipt is null');
      }

      // Financial System Safety: Explicitly check for transaction revert.
      // status === 0 indicates the transaction was mined but reverted on-chain.
      if (receipt.status === 0) {
        throw new BlockchainError('Transaction reverted on-chain', { txHash: receipt.hash });
      }

      const duration = Date.now() - startTime;

      // Post-transaction audit log
      await logAuditEvent({
        action: 'TRANSACTION_COMPLETED',
        actor: options.userId || 'system',
        resource: 'blockchain',
        resourceId: correlationId,
        details: {
          operation: options.operation || method,
          contract: contract.target.toString(),
          method,
          args: JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v),
          txHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          duration,
          status: 'success',
        },
        result: 'success',
      });

      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        receipt,
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const err = error as Error & { reason?: string; code?: string };

      // Error audit log
      await logAuditEvent({
        action: 'TRANSACTION_FAILED',
        actor: options.userId || 'system',
        resource: 'blockchain',
        resourceId: correlationId,
        details: {
          operation: options.operation || method,
          contract: contract.target.toString(),
          method,
          args: JSON.stringify(args, (_, v) => typeof v === 'bigint' ? v.toString() : v),
          error: err.message,
          reason: err.reason,
          code: err.code,
          duration,
          status: 'failed',
        },
        result: 'failure',
        errorMessage: err.message,
      });

      // OWASP: Security Logging and Monitoring - Log blockchain transaction failures
      logger.error('BLOCKCHAIN_SERVICE', 'TRANSACTION_SUBMITTED', {
        correlationId,
        method,
        errorCode: err.code,
        // Sanitized: log reason but not full error message which might contain raw data
        reason: err.reason,
      });

      // Parse common error messages
      if (err.reason?.includes('insufficient funds')) {
        throw new BlockchainError('Insufficient funds for transaction');
      }
      if (err.reason?.includes('exceeds holding limit')) {
        throw new BlockchainError('Transfer would exceed holding limit');
      }
      if (err.reason?.includes('not registered')) {
        throw new BlockchainError('Wallet is not registered');
      }
      if (err.reason?.includes('not active')) {
        throw new BlockchainError('Wallet is not active');
      }
      if (err.code === 'ACTION_REJECTED') {
        throw new BlockchainError('Transaction was rejected');
      }

      throw new BlockchainError(`Transaction failed: ${err.reason || err.message}`, err);
    }
  }

  // ============ Wallet Operations ============

  async registerWallet(
    wallet: string,
    walletType: WalletType,
    linkedBank: string,
    kycHash: string,
    correlationId?: string,
    userId?: string
  ) {
    // ECB Alignment: Intermediated model enforcement.
    // All wallets (except PSPs/Banks themselves) must be linked to a supervised intermediary.
    if (walletType !== WalletType.PSP && walletType !== WalletType.BANK) {
      const isIntermediary = await this.isIntermediary(linkedBank);
      if (!isIntermediary) {
        // Fail explicitly with documented rationale
        throw new BlockchainError(
          'ECB Alignment Violation: All end-user wallets must be linked to a supervised intermediary (PSP or Bank). ' +
          'Direct end-user settlement without an intermediary is prohibited by the Digital Euro scheme.'
        );
      }
    }

    return this.executeTransaction(
      this._walletRegistry,
      'registerWallet',
      [wallet, walletType, linkedBank, kycHash],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'REGISTER_WALLET'
      }
    );
  }

  async deactivateWallet(wallet: string, reason: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._walletRegistry,
      'deactivateWallet',
      [wallet, reason],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'DEACTIVATE_WALLET'
      }
    );
  }

  async reactivateWallet(wallet: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._walletRegistry,
      'reactivateWallet',
      [wallet],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'REACTIVATE_WALLET'
      }
    );
  }

  async updateLinkedBank(wallet: string, newBank: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._walletRegistry,
      'updateLinkedBankAccount',
      [wallet, newBank],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'UPDATE_LINKED_BANK'
      }
    );
  }

  async getWalletInfo(wallet: string) {
    try {
      const info = await this._callWalletRegistryGetWalletInfo(wallet);
      
      // Financial System Safety: Validate schema of contract return data.
      // Prevents "Unexpected schema evolution" from causing silent data corruption.
      if (!info || typeof info.isActive !== 'boolean' || !info.linkedBankAccount || !info.kycHash) {
        throw new Error('Invalid wallet info returned from contract');
      }

      return {
        walletType: this._toNumber(info.walletType),
        walletTypeName: WalletType[this._toNumber(info.walletType)] || 'UNKNOWN',
        isActive: info.isActive,
        linkedBank: info.linkedBankAccount,
        customLimit: info.customLimit.toString(),
        kycHash: info.kycHash,
        registeredAt: new Date(this._toNumber(info.registrationTime) * 1000).toISOString(),
      };
    } catch (error) {
      throw new BlockchainError('Failed to get wallet info', error);
    }
  }

  async isRegistered(wallet: string): Promise<boolean> {
    try {
      return await this._callWalletRegistryIsRegistered(wallet);
    } catch (error) {
      throw new BlockchainError('Failed to check registration', error);
    }
  }

  async getHoldingLimit(wallet: string): Promise<string> {
    try {
      const limit = await this._callWalletRegistryGetHoldingLimit(wallet);
      return limit.toString();
    } catch (error) {
      throw new BlockchainError('Failed to get holding limit', error);
    }
  }

  /**
   * ECB Alignment: Intermediated model verification.
   * Checks if a wallet belongs to a supervised intermediary (PSP or Bank).
   */
  async isIntermediary(wallet: string): Promise<boolean> {
    try {
      const info = await this._callWalletRegistryGetWalletInfo(wallet);
      const type = this._toNumber(info.walletType);
      return type === WalletType.PSP || type === WalletType.BANK;
    } catch {
      return false;
    }
  }

  // ============ Token Operations ============

  /**
   * `justification` is recorded in the audit trail only. The on-chain mint
   * takes no justification argument, so it must not be passed to the contract.
   */
  async mint(to: string, amount: bigint, justification: string, idempotencyKey: string, correlationId?: string, userId?: string) {
    // ECB Alignment: Holding limits enforcement at gateway
    await this.validateHoldingLimit(to, amount);

    await logAuditEvent({
      action: 'TOKENS_MINTED',
      actor: userId || 'system',
      resource: 'token',
      resourceId: to,
      details: { justification, amount: amount.toString(), idempotencyKey },
      result: 'success',
    });

    return this.executeTransaction(
      this._tokenizedEuro,
      'mint',
      [to, amount, this._toBytes32Key(idempotencyKey)],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'MINT_TOKENS'
      }
    );
  }

  async burn(from: string, amount: bigint, idempotencyKey: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._tokenizedEuro,
      'burn',
      [from, amount, this._toBytes32Key(idempotencyKey)],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'BURN_TOKENS'
      }
    );
  }

  /**
   * Moves tokens between two wallets on behalf of the payer.
   *
   * This uses transferFrom, not transfer. The operator is not the owner of the
   * funds, so it must spend against an allowance the payer has granted it.
   * Using transfer here would debit the operator's own balance while the audit
   * record claimed a payer-to-payee movement, so an unfunded allowance must
   * fail loudly rather than silently spending gateway funds.
   */
  async transfer(from: string, to: string, amount: bigint, correlationId?: string, userId?: string) {
    // ECB Alignment: Holding limits enforcement at gateway
    await this.validateHoldingLimit(to, amount);

    return this.executeTransaction(
      this._tokenizedEuro,
      'transferFrom',
      [from, to, amount],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'TRANSFER_TOKENS'
      }
    );
  }

  /** Allowance the payer has granted the gateway operator. */
  async allowanceForOperator(owner: string): Promise<bigint> {
    const func = this._tokenizedEuro.getFunction('allowance');
    if (!func) throw new BlockchainError('Contract method allowance not available');
    const result = await func(owner, this.operatorAddress);
    return BigInt(result.toString());
  }

  // ============ Sovereign Monetary Controls ============

  async freezeAccount(account: string, reason: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._tokenizedEuro,
      'freezeAccount',
      [account, reason],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'FREEZE_ACCOUNT'
      }
    );
  }

  async unfreezeAccount(account: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._tokenizedEuro,
      'unfreezeAccount',
      [account],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'UNFREEZE_ACCOUNT'
      }
    );
  }

  async escrowFunds(account: string, amount: bigint, legalBasis: string, expiry: bigint, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._tokenizedEuro,
      'escrowFunds',
      [account, amount, legalBasis, expiry],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'ESCROW_FUNDS'
      }
    );
  }

  async releaseEscrowedFunds(account: string, to: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._tokenizedEuro,
      'releaseEscrowedFunds',
      [account, to],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'RELEASE_ESCROWED_FUNDS'
      }
    );
  }

  async burnEscrowedFunds(account: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._tokenizedEuro,
      'burnEscrowedFunds',
      [account],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'BURN_ESCROWED_FUNDS'
      }
    );
  }

  async isAccountFrozen(account: string): Promise<boolean> {
    const func = this._tokenizedEuro.getFunction('frozenAccounts');
    if (!func) throw new BlockchainError('Contract method frozenAccounts not available');
    return await func(account) as boolean;
  }

  async getEscrowedBalance(account: string): Promise<{ amount: bigint; legalBasis: string; expiry: bigint }> {
    const func = this._tokenizedEuro.getFunction('escrowedBalances');
    if (!func) throw new BlockchainError('Contract method escrowedBalances not available');
    const result = await func(account);
    return {
      amount: BigInt(result[0].toString()),
      legalBasis: result[1],
      expiry: BigInt(result[2].toString())
    };
  }

  async getEscrowTotal(account: string): Promise<bigint> {
    const func = this._tokenizedEuro.getFunction('escrowTotals');
    if (!func) throw new BlockchainError('Contract method escrowTotals not available');
    const result = await func(account);
    return BigInt(result.toString());
  }

  // ============ Role Checks ============

  async isECB(account: string): Promise<boolean> {
    const func = this._permissioning.getFunction('isECB');
    if (!func) throw new BlockchainError('Contract method isECB not available');
    return await func(account) as boolean;
  }

  async isStateBank(account: string): Promise<boolean> {
    const func = this._permissioning.getFunction('isStateBank');
    if (!func) throw new BlockchainError('Contract method isStateBank not available');
    return await func(account) as boolean;
  }

  async isLocalBank(account: string): Promise<boolean> {
    const func = this._permissioning.getFunction('isLocalBank');
    if (!func) throw new BlockchainError('Contract method isLocalBank not available');
    return await func(account) as boolean;
  }

  async isPSP(account: string): Promise<boolean> {
    const func = this._permissioning.getFunction('isPSP');
    if (!func) throw new BlockchainError('Contract method isPSP not available');
    return await func(account) as boolean;
  }

  async isMerchant(account: string): Promise<boolean> {
    const func = this._permissioning.getFunction('isMerchant');
    if (!func) throw new BlockchainError('Contract method isMerchant not available');
    return await func(account) as boolean;
  }

  async isWalletHolder(account: string): Promise<boolean> {
    const func = this._permissioning.getFunction('isWalletHolder');
    if (!func) throw new BlockchainError('Contract method isWalletHolder not available');
    return await func(account) as boolean;
  }

  /**
   * Validate if a transfer would exceed the recipient's holding limit
   */
  private async validateHoldingLimit(address: string, additionalAmount: bigint): Promise<void> {
    try {
      const info = await this._callWalletRegistryGetWalletInfo(address);
      const currentBalance = await this._callTokenBalanceOf(address);
      const newBalance = BigInt(currentBalance.toString()) + additionalAmount;

      // Get limit from contract (custom limit)
      let limit = BigInt((await this._callWalletRegistryGetHoldingLimit(address)).toString());

      // If no custom limit, use default based on wallet type
      if (limit === BigInt(0)) {
        const walletType = Number(info.walletType);
        switch (walletType) {
          case WalletType.INDIVIDUAL:
            limit = BigInt(parameters.holding_limit_individual);
            break;
          case WalletType.MERCHANT:
            limit = BigInt(parameters.holding_limit_merchant);
            break;
          case WalletType.PSP:
          case WalletType.NCB:
          case WalletType.BANK:
            // Supervised intermediaries hold balances on behalf of others and
            // are not subject to the scheme's per-holder cap.
            return;
          default:
            // UNREGISTERED, or an ordinal this build does not know about.
            // Deny rather than fall through to an unbounded limit.
            throw new BlockchainError(
              `Recipient wallet is not registered for holding tEUR (wallet type ${walletType})`,
            );
        }
      }

      if (newBalance > limit) {
        throw new BlockchainError(`ECB Alignment Violation: Recipient holding limit exceeded. Limit: ${limit}, Resulting Balance: ${newBalance}`);
      }
    } catch (error) {
      if (error instanceof BlockchainError) throw error;
      
      // Financial System Safety: No fail-open behavior. 
      // If we cannot verify the holding limit (e.g. RPC failure, contract error), 
      // we MUST block the transaction to prevent potential breach of Digital Euro scheme rules.
      const msg = `Failed to verify holding limit for ${address}. Transaction blocked to preserve system integrity.`;
      logger.error('BLOCKCHAIN_SERVICE', 'HOLDING_LIMIT_CHECK_FAILED', { address, error: String(error) });
      throw new BlockchainError(msg, error);
    }
  }

  async balanceOf(address: string): Promise<string> {
    try {
      const balance = await this._callTokenBalanceOf(address);
      return balance.toString();
    } catch (error) {
      throw new BlockchainError('Failed to get balance', error);
    }
  }

  async totalSupply(): Promise<string> {
    try {
      const supply = await this._callTokenTotalSupply();
      return supply.toString();
    } catch (error) {
      throw new BlockchainError('Failed to get total supply', error);
    }
  }

  async executeWaterfall(wallet: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._tokenizedEuro,
      'executeWaterfall',
      [wallet],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'EXECUTE_WATERFALL'
      }
    );
  }

  async executeReverseWaterfall(wallet: string, amount: bigint, idempotencyKey: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._tokenizedEuro,
      'executeReverseWaterfall',
      [wallet, amount, this._toBytes32Key(idempotencyKey)],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'EXECUTE_REVERSE_WATERFALL'
      }
    );
  }

  async isPaused(): Promise<boolean> {
    try {
      return await this._callTokenPaused();
    } catch (error) {
      throw new BlockchainError('Failed to check pause status', error);
    }
  }

  async pause(correlationId?: string, userId?: string) {
    return this.executeTransaction(this._tokenizedEuro, 'pause', [], {
      ...(correlationId && { correlationId }),
      ...(userId && { userId }),
      operation: 'PAUSE_CONTRACT'
    });
  }

  async unpause(correlationId?: string, userId?: string) {
    return this.executeTransaction(this._tokenizedEuro, 'unpause', [], {
      ...(correlationId && { correlationId }),
      ...(userId && { userId }),
      operation: 'UNPAUSE_CONTRACT'
    });
  }

  // ============ Conditional Payments ============

  async createConditionalPayment(
    payee: string,
    amount: bigint,
    conditionType: ConditionType,
    conditionData: string,
    expiresAt: number,
    arbiter: string,
    idempotencyKey: string,
    correlationId?: string,
    userId?: string
  ): Promise<{ txHash: string; blockNumber: number; paymentId: string }> {
    const { txHash, blockNumber, receipt } = await this.executeTransaction(
      this._conditionalPayments,
      'createConditionalPayment',
      [payee, amount, conditionType, conditionData, expiresAt, arbiter, this._toBytes32Key(idempotencyKey)],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'CREATE_CONDITIONAL_PAYMENT'
      }
    );

    // Extract payment ID from the ConditionalPaymentCreated event
    const event = receipt.logs
      .map(log => {
        try {
          return this._conditionalPayments.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(parsed => parsed && parsed.name === 'ConditionalPaymentCreated');

    if (!event) {
      throw new BlockchainError('ConditionalPaymentCreated event not found in transaction receipt');
    }

    const paymentId = event.args.paymentId as string;

    return {
      txHash,
      blockNumber,
      paymentId,
    };
  }

  async confirmDelivery(paymentId: string, proof: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._conditionalPayments,
      'confirmDelivery',
      [paymentId, proof],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'CONFIRM_DELIVERY'
      }
    );
  }

  async releasePayment(paymentId: string, proof: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._conditionalPayments,
      'releasePayment',
      [paymentId, proof],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'RELEASE_PAYMENT'
      }
    );
  }

  /**
   * The contract exposes refundPayment, not cancelPayment. Both take a reason
   * string that is emitted with PaymentRefunded for the audit trail.
   */
  async refundPayment(paymentId: string, reason: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._conditionalPayments,
      'refundPayment',
      [paymentId, reason],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'REFUND_PAYMENT'
      }
    );
  }

  async claimExpiredPayment(paymentId: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._conditionalPayments,
      'claimExpiredPayment',
      [paymentId],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'CLAIM_EXPIRED_PAYMENT'
      }
    );
  }

  async disputePayment(paymentId: string, reason: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._conditionalPayments,
      'disputePayment',
      [paymentId, reason],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'DISPUTE_PAYMENT'
      }
    );
  }

  async resolveDispute(paymentId: string, releaseToPayee: boolean, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._conditionalPayments,
      'resolveDispute',
      [paymentId, releaseToPayee],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'RESOLVE_DISPUTE'
      }
    );
  }

  async getPayment(paymentId: string) {
    try {
      const payment = await this._callGetPayment(paymentId);
      return {
        payer: payment.payer,
        payee: payment.payee,
        amount: payment.amount.toString(),
        conditionType: this._toNumber(payment.conditionType),
        conditionTypeName: ConditionType[this._toNumber(payment.conditionType)] || 'UNKNOWN',
        conditionData: payment.conditionData,
        status: this._toNumber(payment.status),
        statusName: PaymentStatus[this._toNumber(payment.status)] || 'UNKNOWN',
        createdAt: new Date(Number(payment.createdAt) * 1000).toISOString(),
        expiresAt: new Date(Number(payment.expiresAt) * 1000).toISOString(),
        arbiter: payment.arbiter,
      };
    } catch (error) {
      throw new BlockchainError('Failed to get payment info', error);
    }
  }

  // ============ Role Management ============

  async hasRole(role: string, account: string): Promise<boolean> {
    try {
      return await this._callHasRole(role, account);
    } catch (error) {
      throw new BlockchainError('Failed to check role', error);
    }
  }

  async grantRole(role: string, account: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._permissioning,
      'grantRole',
      [role, account],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'GRANT_ROLE'
      }
    );
  }

  async revokeRole(role: string, account: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._permissioning,
      'revokeRole',
      [role, account],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'REVOKE_ROLE'
      }
    );
  }

  // ============ Utility ============

  getOperatorAddress(): string {
    return this.operatorAddress;
  }

  async getBlockNumber(): Promise<number> {
    return this.provider.getBlockNumber();
  }

  async getGasPrice(): Promise<string> {
    const feeData = await this.provider.getFeeData();
    return feeData.gasPrice?.toString() || '0';
  }
}

// Export singleton instance
export const blockchainService = new BlockchainService();
