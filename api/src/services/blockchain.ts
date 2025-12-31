import { ethers, Contract, JsonRpcProvider, Wallet } from 'ethers';
import { config } from '../config/index.js';
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
  'function mint(address to, uint256 amount) external',
  'function burn(address from, uint256 amount) external',
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
  'event Transfer(address indexed from, address indexed to, uint256 value)',
  'event WaterfallExecuted(address indexed wallet, uint256 excessAmount, address indexed linkedBank)',
  'event ReverseWaterfallExecuted(address indexed wallet, uint256 amount, address indexed linkedBank)',
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
      
      logger.info('Blockchain service initialized', {
        chainId: network.chainId.toString(),
        blockNumber,
        operator: this.signer.address,
      });

      this.initialized = true;
    } catch (error) {
      logger.error('Failed to initialize blockchain service', { error });
      throw new BlockchainError('Failed to connect to blockchain');
    }
  }

  // --- Typed wrapper helpers for contract calls ---
  private async _callWalletRegistryGetWalletInfo(wallet: string): Promise<WalletInfo> {
    // use dynamic access to avoid TS complaints about Contract index signatures
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = (this._walletRegistry as any)['getWalletInfo'];
    if (!fn) throw new BlockchainError('Contract method getWalletInfo not available');
    const info = await fn.call(this._walletRegistry, wallet);
    return info as unknown as WalletInfo;
  }

  private async _callWalletRegistryIsRegistered(wallet: string): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = (this._walletRegistry as any)['isRegistered'];
    if (!fn) throw new BlockchainError('Contract method isRegistered not available');
    return await fn.call(this._walletRegistry, wallet) as boolean;
  }

  private async _callWalletRegistryGetHoldingLimit(wallet: string): Promise<EBig> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = (this._walletRegistry as any)['getHoldingLimit'];
    if (!fn) throw new BlockchainError('Contract method getHoldingLimit not available');
    const limit = await fn.call(this._walletRegistry, wallet);
    return limit as unknown as EBig;
  }

  private async _callTokenBalanceOf(address: string): Promise<EBig> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = (this._tokenizedEuro as any)['balanceOf'];
    if (!fn) throw new BlockchainError('Contract method balanceOf not available');
    const bal = await fn.call(this._tokenizedEuro, address);
    return bal as unknown as EBig;
  }

  private async _callTokenTotalSupply(): Promise<EBig> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = (this._tokenizedEuro as any)['totalSupply'];
    if (!fn) throw new BlockchainError('Contract method totalSupply not available');
    const s = await fn.call(this._tokenizedEuro);
    return s as unknown as EBig;
  }

  private async _callTokenPaused(): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = (this._tokenizedEuro as any)['paused'];
    if (!fn) throw new BlockchainError('Contract method paused not available');
    return await fn.call(this._tokenizedEuro) as boolean;
  }

  private async _callGetPayment(paymentId: string): Promise<PaymentInfo> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = (this._conditionalPayments as any)['getPayment'];
    if (!fn) throw new BlockchainError('Contract method getPayment not available');
    const p = await fn.call(this._conditionalPayments, paymentId);
    return p as unknown as PaymentInfo;
  }

  private async _callHasRole(role: string, account: string): Promise<boolean> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fn = (this._permissioning as any)['hasRole'];
    if (!fn) throw new BlockchainError('Contract method hasRole not available');
    return await fn.call(this._permissioning, role, account) as boolean;
  }

  private _toNumber(value: number | EBig): number {
    if (typeof value === 'number') return value;
    // try BigNumber-like API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (value && typeof (value as any).toNumber === 'function') return (value as any).toNumber();
    return Number((value as any).toString());
  }

  private async executeTransaction(
    contract: Contract,
    method: string,
    args: unknown[],
    options: { gasLimit?: bigint; correlationId?: string; userId?: string; operation?: string } = {}
  ): Promise<{ txHash: string; blockNumber: number }> {
    const startTime = Date.now();
    const correlationId = options.correlationId || `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Pre-transaction audit log
      await logAuditEvent({
        action: 'BLOCKCHAIN_TRANSACTION_INITIATED',
        actor: options.userId || 'system',
        resource: 'blockchain',
        resourceId: correlationId,
        details: {
          operation: options.operation || method,
          contract: contract.target.toString(),
          method,
          args: JSON.stringify(args),
          gasLimit: options.gasLimit?.toString(),
        },
        result: 'success',
      });

      const contractMethod = contract[method] as (...args: unknown[]) => Promise<{ wait: () => Promise<{ hash: string; blockNumber: number; gasUsed: bigint }> }>;
      const tx = await contractMethod(...args, options);
      const receipt = await tx.wait();

      const duration = Date.now() - startTime;

      // Post-transaction audit log
      await logAuditEvent({
        action: 'BLOCKCHAIN_TRANSACTION_COMPLETED',
        actor: options.userId || 'system',
        resource: 'blockchain',
        resourceId: correlationId,
        details: {
          operation: options.operation || method,
          contract: contract.target.toString(),
          method,
          args: JSON.stringify(args),
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
      };
    } catch (error: unknown) {
      const duration = Date.now() - startTime;
      const err = error as Error & { reason?: string; code?: string };

      // Error audit log
      await logAuditEvent({
        action: 'BLOCKCHAIN_TRANSACTION_FAILED',
        actor: options.userId || 'system',
        resource: 'blockchain',
        resourceId: correlationId,
        details: {
          operation: options.operation || method,
          contract: contract.target.toString(),
          method,
          args: JSON.stringify(args),
          error: err.message,
          reason: err.reason,
          code: err.code,
          duration,
          status: 'failed',
        },
        result: 'failure',
        errorMessage: err.message,
      });

      logger.error('Blockchain transaction failed', {
        correlationId,
        method,
        error: err.message,
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

  // ============ Token Operations ============

  async mint(to: string, amount: bigint, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._tokenizedEuro,
      'mint',
      [to, amount],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'MINT_TOKENS'
      }
    );
  }

  async burn(from: string, amount: bigint, correlationId?: string, userId?: string) {
    return this.executeTransaction(
      this._tokenizedEuro,
      'burn',
      [from, amount],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'BURN_TOKENS'
      }
    );
  }

  async transfer(to: string, amount: bigint, correlationId?: string, userId?: string) {
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
    const txResult = await this.executeTransaction(
      this._conditionalPayments,
      'createConditionalPayment',
      [payee, amount, conditionType, conditionData, expiresAt, arbiter],
      {
        ...(correlationId && { correlationId }),
        ...(userId && { userId }),
        operation: 'CREATE_CONDITIONAL_PAYMENT'
      }
    );

    // Extract payment ID from event - we'll need to query this separately since executeTransaction doesn't return events
    // For now, return a placeholder - the payment ID will be extracted by the caller from events if needed
    return {
      ...txResult,
      paymentId: ethers.ZeroHash, // Placeholder - actual ID should be extracted from events
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
