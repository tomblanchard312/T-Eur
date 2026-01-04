import { ethers, Contract, JsonRpcProvider, Wallet } from 'ethers';
import crypto from 'crypto';
import { config } from '../config/index.js';
import { parameters } from '../config/parameters.js';
import { logger, logAuditEvent } from '../utils/logger.js';
import { BlockchainError } from '../middleware/errors.js';

// Contract ABIs (minimal interfaces for API operations)
const WalletRegistryABI = [
  'function registerWallet(address wallet, uint8 walletType, address linkedBank, bytes32 kycHash) external',
  'function deactivateWallet(address wallet) external',
  'function reactivateWallet(address wallet) external',
  'function updateLinkedBank(address wallet, address newBank) external',
  'function getWalletInfo(address wallet) external view returns (tuple(uint8 walletType, bool isActive, address linkedBank, bytes32 kycHash, uint256 registeredAt))',
  'function getHoldingLimit(address wallet) external view returns (uint256)',
  'function isRegistered(address wallet) external view returns (bool)',
  'event WalletRegistered(address indexed wallet, uint8 indexed walletType, address indexed linkedBank)',
  'event WalletDeactivated(address indexed wallet)',
  'event WalletReactivated(address indexed wallet)',
];

const TokenizedEuroABI = [
  'function mint(address to, uint256 amount, string justification, bytes32 idempotencyKey) external',
  'function burn(address from, uint256 amount, bytes32 idempotencyKey) external',
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
  'function totalSupply() external view returns (uint256)',
  'function executeWaterfall(address wallet) external',
  'function executeReverseWaterfall(address wallet, uint256 amount) external',
  'function pause() external',
  'function unpause() external',
  'function paused() external view returns (bool)',
  'function freezeAccount(address account, string reason) external',
  'function unfreezeAccount(address account) external',
  'function escrowFunds(address account, uint256 amount, string legalBasis, uint256 expiry) external',
  'function releaseEscrowedFunds(address account, address to) external',
  'function burnEscrowedFunds(address account) external',
  'function frozenAccounts(address account) external view returns (bool)',
  'function escrowedBalances(address account) external view returns (tuple(uint256 amount, string legalBasis, uint256 expiry))',
  'function escrowTotals(address account) external view returns (uint256)',
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event WaterfallExecuted(address indexed wallet, uint256 excessAmount, address indexed linkedBank)',
  'event ReverseWaterfallExecuted(address indexed wallet, uint256 amount, address indexed linkedBank)',
  'event AccountFrozen(address indexed account, address indexed by, string reason)',
  'event AccountUnfrozen(address indexed account, address indexed by)',
  'event FundsEscrowed(address indexed account, uint256 amount, string legalBasis, uint256 expiry)',
  'event FundsReleased(address indexed account, uint256 amount, address indexed to)',
  'event FundsBurnedFromEscrow(address indexed account, uint256 amount)',
];

const ConditionalPaymentsABI = [
  'function createConditionalPayment(address payee, uint256 amount, uint8 conditionType, bytes32 conditionData, uint256 expiresAt, address arbiter) external returns (bytes32)',
  'function confirmDelivery(bytes32 paymentId, bytes32 proof) external',
  'function releasePayment(bytes32 paymentId, bytes32 proof) external',
  'function cancelPayment(bytes32 paymentId) external',
  'function disputePayment(bytes32 paymentId) external',
  'function resolveDispute(bytes32 paymentId, bool releaseToPayee) external',
  'function getPayment(bytes32 paymentId) external view returns (tuple(address payer, address payee, uint256 amount, uint8 conditionType, bytes32 conditionData, uint8 status, uint256 createdAt, uint256 expiresAt, address arbiter, bool payerConfirmed, bool payeeConfirmed))',
  'event PaymentCreated(bytes32 indexed paymentId, address indexed payer, address indexed payee, uint256 amount)',
  'event PaymentReleased(bytes32 indexed paymentId)',
  'event PaymentCancelled(bytes32 indexed paymentId)',
  'event PaymentDisputed(bytes32 indexed paymentId)',
  'event DisputeResolved(bytes32 indexed paymentId, bool releasedToPayee)',
];

const PermissioningABI = [
  'function grantRole(bytes32 role, address account) external',
  'function revokeRole(bytes32 role, address account) external',
  'function hasRole(bytes32 role, address account) external view returns (bool)',
  'function getRoleAdmin(bytes32 role) external view returns (bytes32)',
  'function isECB(address account) external view returns (bool)',
  'function isStateBank(address account) external view returns (bool)',
  'function isLocalBank(address account) external view returns (bool)',
  'function isPSP(address account) external view returns (bool)',
  'function isMerchant(address account) external view returns (bool)',
  'function isWalletHolder(address account) external view returns (bool)',
  'event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)',
  'event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)',
];

// Role constants
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

// Wallet type enum matching contract
export enum WalletType {
  INDIVIDUAL = 0,
  MERCHANT = 1,
  PSP = 2,
  NCB = 3,
  BANK = 4,
}

// Payment status enum
export enum PaymentStatus {
  PENDING = 0,
  RELEASED = 1,
  CANCELLED = 2,
  EXPIRED = 3,
  DISPUTED = 4,
}

// Condition type enum
export enum ConditionType {
  DELIVERY = 0,
  TIME_LOCK = 1,
  MILESTONE = 2,
  ORACLE = 3,
  MULTI_SIG = 4,
}

// Lightweight numeric wrapper for returned big values
type EBig = { toString(): string; toNumber?: () => number };

type WalletInfo = {
  walletType: number | EBig;
  isActive: boolean;
  linkedBank: string;
  kycHash: string;
  registeredAt: EBig;
};

type PaymentInfo = {
  payer: string;
  payee: string;
  amount: EBig;
  conditionType: number | EBig;
  conditionData: string;
  status: number | EBig;
  createdAt: EBig;
  expiresAt: EBig;
  arbiter: string;
  payerConfirmed: boolean;
  payeeConfirmed: boolean;
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
  private signer: Wallet;
  private _walletRegistry: Contract;
  private _tokenizedEuro: Contract;
  private _conditionalPayments: Contract;
  private _permissioning: Contract;
  private initialized = false;

  constructor() {
    this.provider = new JsonRpcProvider(config.blockchain.rpcUrl);
    this.signer = new Wallet(config.blockchain.operatorPrivateKey, this.provider);
    
    if (!config.contracts.walletRegistry) {
      throw new Error('CONTRACT_WALLET_REGISTRY not configured');
    }
    if (!config.contracts.tokenizedEuro) {
      throw new Error('CONTRACT_TOKENIZED_EURO not configured');
    }
    if (!config.contracts.conditionalPayments) {
      throw new Error('CONTRACT_CONDITIONAL_PAYMENTS not configured');
    }
    if (!config.contracts.permissioning) {
      throw new Error('CONTRACT_PERMISSIONING not configured');
    }
    
    this._walletRegistry = new Contract(
      config.contracts.walletRegistry,
      WalletRegistryABI,
      this.signer
    );
    
    this._tokenizedEuro = new Contract(
      config.contracts.tokenizedEuro,
      TokenizedEuroABI,
      this.signer
    );
    
    this._conditionalPayments = new Contract(
      config.contracts.conditionalPayments,
      ConditionalPaymentsABI,
      this.signer
    );
    
    this._permissioning = new Contract(
      config.contracts.permissioning,
      PermissioningABI,
      this.signer
    );
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const network = await this.provider.getNetwork();
      const blockNumber = await this.provider.getBlockNumber();
      
      // OWASP: Security Logging and Monitoring - Log service startup
      logger.info('BLOCKCHAIN_SERVICE', 'RESOURCE_CREATED', {
        chainId: network.chainId.toString(),
        blockNumber,
        // Sanitized: only log address, not private key
        resourceId: this.signer.address,
      });

      this.initialized = true;
    } catch (error) {
      logger.error('BLOCKCHAIN_SERVICE', 'INTERNAL_SERVER_ERROR', { 
        errorCode: String(error) 
      });
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

      const tx = await func(...args, overrides);
      const receipt = await tx.wait();

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

  async deactivateWallet(wallet: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._walletRegistry,
      'deactivateWallet',
      [wallet],
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
      'updateLinkedBank',
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
      if (!info || typeof info.isActive !== 'boolean' || !info.linkedBank || !info.kycHash) {
        throw new Error('Invalid wallet info returned from contract');
      }

      return {
        walletType: this._toNumber(info.walletType),
        walletTypeName: WalletType[this._toNumber(info.walletType)] || 'UNKNOWN',
        isActive: info.isActive,
        linkedBank: info.linkedBank,
        kycHash: info.kycHash,
        registeredAt: new Date(this._toNumber(info.registeredAt) * 1000).toISOString(),
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
    } catch (error) {
      return false;
    }
  }

  // ============ Token Operations ============

  async mint(to: string, amount: bigint, justification: string, idempotencyKey: string, correlationId?: string, userId?: string) {
    // ECB Alignment: Holding limits enforcement at gateway
    await this.validateHoldingLimit(to, amount);

    return this.executeTransaction(
      this._tokenizedEuro,
      'mint',
      [to, amount, justification, idempotencyKey],
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
      [from, amount, idempotencyKey],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'BURN_TOKENS'
      }
    );
  }

  async transfer(to: string, amount: bigint, correlationId?: string, userId?: string) {
    // ECB Alignment: Holding limits enforcement at gateway
    await this.validateHoldingLimit(to, amount);

    return this.executeTransaction(
      this._tokenizedEuro,
      'transfer',
      [to, amount],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'TRANSFER_TOKENS'
      }
    );
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
        if (walletType === WalletType.INDIVIDUAL) {
          limit = BigInt(parameters.holding_limit_individual);
        } else if (walletType === WalletType.MERCHANT) {
          limit = BigInt(parameters.holding_limit_merchant);
        } else {
          // PSPs and Banks typically don't have holding limits in the same way, 
          // or they are much higher. For now, we allow them.
          return;
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

  async executeReverseWaterfall(wallet: string, amount: bigint, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._tokenizedEuro,
      'executeReverseWaterfall',
      [wallet, amount],
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
    correlationId?: string,
    userId?: string
  ): Promise<{ txHash: string; blockNumber: number; paymentId: string }> {
    const { txHash, blockNumber, receipt } = await this.executeTransaction(
      this._conditionalPayments,
      'createConditionalPayment',
      [payee, amount, conditionType, conditionData, expiresAt, arbiter],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'CREATE_CONDITIONAL_PAYMENT'
      }
    );

    // Extract payment ID from PaymentCreated event
    const event = receipt.logs
      .map(log => {
        try {
          return this._conditionalPayments.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(parsed => parsed && parsed.name === 'PaymentCreated');

    if (!event) {
      throw new BlockchainError('PaymentCreated event not found in transaction receipt');
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

  async cancelPayment(paymentId: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._conditionalPayments,
      'cancelPayment',
      [paymentId],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'CANCEL_PAYMENT'
      }
    );
  }

  async disputePayment(paymentId: string, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._conditionalPayments,
      'disputePayment',
      [paymentId],
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
        payerConfirmed: payment.payerConfirmed,
        payeeConfirmed: payment.payeeConfirmed,
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
    return this.signer.address;
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
