import { ethers, Contract, JsonRpcProvider, Wallet } from 'ethers';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
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

class BlockchainService {
  private provider: JsonRpcProvider;
  private signer: Wallet;
  private walletRegistry!: Contract;
  private tokenizedEuro!: Contract;
  private conditionalPayments!: Contract;
  private permissioning!: Contract;
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
    
    this.walletRegistry = new Contract(
      config.contracts.walletRegistry,
      WalletRegistryABI,
      this.signer
    );
    
    this.tokenizedEuro = new Contract(
      config.contracts.tokenizedEuro,
      TokenizedEuroABI,
      this.signer
    );
    
    this.conditionalPayments = new Contract(
      config.contracts.conditionalPayments,
      ConditionalPaymentsABI,
      this.signer
    );
    
    this.permissioning = new Contract(
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

  private async executeTransaction(
    contract: Contract,
    method: string,
    args: unknown[],
    options: { gasLimit?: bigint } = {}
  ): Promise<{ txHash: string; blockNumber: number }> {
    try {
      const contractMethod = contract[method] as (...args: unknown[]) => Promise<{ wait: () => Promise<{ hash: string; blockNumber: number }> }>;
      const tx = await contractMethod(...args, options);
      const receipt = await tx.wait();
      
      return {
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };
    } catch (error: unknown) {
      const err = error as Error & { reason?: string; code?: string };
      logger.error('Blockchain transaction failed', {
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
    kycHash: string
  ) {
    return this.executeTransaction(
      this.walletRegistry,
      'registerWallet',
      [wallet, walletType, linkedBank, kycHash]
    );
  }

  async deactivateWallet(wallet: string) {
    return this.executeTransaction(
      this.walletRegistry,
      'deactivateWallet',
      [wallet]
    );
  }

  async reactivateWallet(wallet: string) {
    return this.executeTransaction(
      this.walletRegistry,
      'reactivateWallet',
      [wallet]
    );
  }

  async updateLinkedBank(wallet: string, newBank: string) {
    return this.executeTransaction(
      this.walletRegistry,
      'updateLinkedBank',
      [wallet, newBank]
    );
  }

  async getWalletInfo(wallet: string) {
    try {
      const info = await this.walletRegistry!.getWalletInfo(wallet);
      return {
        walletType: Number(info.walletType),
        walletTypeName: WalletType[info.walletType] || 'UNKNOWN',
        isActive: info.isActive,
        linkedBank: info.linkedBank,
        kycHash: info.kycHash,
        registeredAt: new Date(Number(info.registeredAt) * 1000).toISOString(),
      };
    } catch (error) {
      throw new BlockchainError('Failed to get wallet info', error);
    }
  }

  async isRegistered(wallet: string): Promise<boolean> {
    try {
      return await this.walletRegistry!.isRegistered(wallet);
    } catch (error) {
      throw new BlockchainError('Failed to check registration', error);
    }
  }

  async getHoldingLimit(wallet: string): Promise<string> {
    try {
      const limit = await this.walletRegistry!.getHoldingLimit(wallet);
      return limit.toString();
    } catch (error) {
      throw new BlockchainError('Failed to get holding limit', error);
    }
  }

  // ============ Token Operations ============

  async mint(to: string, amount: bigint) {
    return this.executeTransaction(
      this.tokenizedEuro,
      'mint',
      [to, amount]
    );
  }

  async burn(from: string, amount: bigint) {
    return this.executeTransaction(
      this.tokenizedEuro,
      'burn',
      [from, amount]
    );
  }

  async transfer(to: string, amount: bigint) {
    return this.executeTransaction(
      this.tokenizedEuro,
      'transfer',
      [to, amount]
    );
  }

  async balanceOf(address: string): Promise<string> {
    try {
      const balance = await this.tokenizedEuro!.balanceOf(address);
      return balance.toString();
    } catch (error) {
      throw new BlockchainError('Failed to get balance', error);
    }
  }

  async totalSupply(): Promise<string> {
    try {
      const supply = await this.tokenizedEuro!.totalSupply();
      return supply.toString();
    } catch (error) {
      throw new BlockchainError('Failed to get total supply', error);
    }
  }

  async executeWaterfall(wallet: string) {
    return this.executeTransaction(
      this.tokenizedEuro,
      'executeWaterfall',
      [wallet]
    );
  }

  async executeReverseWaterfall(wallet: string, amount: bigint) {
    return this.executeTransaction(
      this.tokenizedEuro,
      'executeReverseWaterfall',
      [wallet, amount]
    );
  }

  async isPaused(): Promise<boolean> {
    try {
      return await this.tokenizedEuro!.paused();
    } catch (error) {
      throw new BlockchainError('Failed to check pause status', error);
    }
  }

  async pause() {
    return this.executeTransaction(this.tokenizedEuro, 'pause', []);
  }

  async unpause() {
    return this.executeTransaction(this.tokenizedEuro, 'unpause', []);
  }

  // ============ Conditional Payments ============

  async createConditionalPayment(
    payee: string,
    amount: bigint,
    conditionType: ConditionType,
    conditionData: string,
    expiresAt: number,
    arbiter: string
  ): Promise<{ txHash: string; blockNumber: number; paymentId: string }> {
    const tx = await this.conditionalPayments!.createConditionalPayment(
      payee,
      amount,
      conditionType,
      conditionData,
      expiresAt,
      arbiter
    );
    const receipt = await tx.wait();
    
    // Extract payment ID from event
    const event = receipt.logs.find(
      (log: { fragment?: { name: string } }) => log.fragment?.name === 'PaymentCreated'
    );
    const paymentId = event?.args?.[0] || ethers.ZeroHash;

    return {
      txHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      paymentId,
    };
  }

  async confirmDelivery(paymentId: string, proof: string) {
    return this.executeTransaction(
      this.conditionalPayments,
      'confirmDelivery',
      [paymentId, proof]
    );
  }

  async releasePayment(paymentId: string, proof: string) {
    return this.executeTransaction(
      this.conditionalPayments,
      'releasePayment',
      [paymentId, proof]
    );
  }

  async cancelPayment(paymentId: string) {
    return this.executeTransaction(
      this.conditionalPayments,
      'cancelPayment',
      [paymentId]
    );
  }

  async disputePayment(paymentId: string) {
    return this.executeTransaction(
      this.conditionalPayments,
      'disputePayment',
      [paymentId]
    );
  }

  async resolveDispute(paymentId: string, releaseToPayee: boolean) {
    return this.executeTransaction(
      this.conditionalPayments,
      'resolveDispute',
      [paymentId, releaseToPayee]
    );
  }

  async getPayment(paymentId: string) {
    try {
      const payment = await this.conditionalPayments!.getPayment(paymentId);
      return {
        payer: payment.payer,
        payee: payment.payee,
        amount: payment.amount.toString(),
        conditionType: Number(payment.conditionType),
        conditionTypeName: ConditionType[payment.conditionType] || 'UNKNOWN',
        conditionData: payment.conditionData,
        status: Number(payment.status),
        statusName: PaymentStatus[payment.status] || 'UNKNOWN',
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
      return await this.permissioning!.hasRole(role, account);
    } catch (error) {
      throw new BlockchainError('Failed to check role', error);
    }
  }

  async grantRole(role: string, account: string) {
    return this.executeTransaction(
      this.permissioning,
      'grantRole',
      [role, account]
    );
  }

  async revokeRole(role: string, account: string) {
    return this.executeTransaction(
      this.permissioning,
      'revokeRole',
      [role, account]
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
