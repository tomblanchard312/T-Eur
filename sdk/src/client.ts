import axios, { AxiosInstance } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import type {
  ClientConfig,
  WalletConfig,
  TransferRequest,
  MintRequest,
  ConditionalPaymentRequest,
  WalletInfo,
  PaymentInfo,
  TransactionResult,
} from './types';

/**
 * tEUR Client - TypeScript SDK for European banks
 * 
 * @example
 * ```typescript
 * import { TEurClient } from '@teur/bank-sdk';
 * 
 * const client = new TEurClient({
 *   apiUrl: 'https://teur-api.eu',
 *   apiKey: 'your-bank-api-key',
 * });
 * 
 * // Register a wallet
 * const wallet = await client.registerWallet({
 *   address: '0x...',
 *   type: WalletType.INDIVIDUAL,
 *   kycHash: '0x...',
 * });
 * 
 * // Transfer tEUR
 * const transfer = await client.transfer({
 *   from: '0x...',
 *   to: '0x...',
 *   amount: 10000, // €100.00 in cents
 * });
 * ```
 */
export class TEurClient {
  private api: AxiosInstance;

  constructor(config: ClientConfig) {
    this.api = axios.create({
      baseURL: config.apiUrl,
      timeout: config.timeout || 30000,
      headers: {
        'X-API-Key': config.apiKey,
        'Content-Type': 'application/json',
      },
    });

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response.data,
      (error) => {
        const message = error.response?.data?.error?.message || error.message;
        const code = error.response?.data?.error?.code || 'UNKNOWN_ERROR';
        throw new Error(`[${code}] ${message}`);
      }
    );
  }

  // ============ Wallet Operations ============

  /**
   * Register a new wallet with KYC compliance
   */
  async registerWallet(params: {
    address: string;
    type: WalletConfig['type'];
    linkedBankAccount?: string;
    kycHash: string;
  }): Promise<TransactionResult> {
    const response = await this.api.post('/wallets', {
      wallet: params.address,
      walletType: params.type,
      linkedBankAccount: params.linkedBankAccount,
      kycHash: params.kycHash,
      idempotencyKey: uuidv4(),
    });
    return response.data;
  }

  /**
   * Get wallet information including balance and limits
   */
  async getWallet(address: string): Promise<WalletInfo> {
    const response = await this.api.get(`/wallets/${address}`);
    return response.data;
  }

  /**
   * Get wallet balance in cents
   */
  async getBalance(address: string): Promise<{ balance: string; balanceFormatted: string }> {
    const response = await this.api.get(`/wallets/${address}/balance`);
    return response.data;
  }

  /**
   * Deactivate a wallet
   */
  async deactivateWallet(address: string, reason: string): Promise<TransactionResult> {
    const response = await this.api.post(`/wallets/${address}/deactivate`, {
      wallet: address,
      reason,
    });
    return response.data;
  }

  /**
   * Reactivate a wallet
   */
  async reactivateWallet(address: string): Promise<TransactionResult> {
    const response = await this.api.post(`/wallets/${address}/reactivate`);
    return response.data;
  }

  // ============ Transfer Operations ============

  /**
   * Transfer tEUR between wallets
   */
  async transfer(params: Omit<TransferRequest, 'idempotencyKey'> & { idempotencyKey?: string }): Promise<TransactionResult> {
    const response = await this.api.post('/transfers', {
      ...params,
      idempotencyKey: params.idempotencyKey || uuidv4(),
    });
    return response.data;
  }

  /**
   * Mint new tEUR (NCB/ECB only)
   */
  async mint(params: Omit<MintRequest, 'idempotencyKey'> & { idempotencyKey?: string }): Promise<TransactionResult> {
    const response = await this.api.post('/transfers/mint', {
      ...params,
      idempotencyKey: params.idempotencyKey || uuidv4(),
    });
    return response.data;
  }

  /**
   * Burn tEUR (NCB/ECB only)
   */
  async burn(params: { from: string; amount: number; idempotencyKey?: string }): Promise<TransactionResult> {
    const response = await this.api.post('/transfers/burn', {
      ...params,
      idempotencyKey: params.idempotencyKey || uuidv4(),
    });
    return response.data;
  }

  /**
   * Execute waterfall - sweep excess to linked bank account
   */
  async executeWaterfall(walletAddress: string): Promise<TransactionResult> {
    const response = await this.api.post('/transfers/waterfall', {
      wallet: walletAddress,
    });
    return response.data;
  }

  /**
   * Execute reverse waterfall - fund wallet from linked bank account
   */
  async executeReverseWaterfall(params: {
    wallet: string;
    amount: number;
    idempotencyKey?: string;
  }): Promise<TransactionResult> {
    const response = await this.api.post('/transfers/reverse-waterfall', {
      ...params,
      idempotencyKey: params.idempotencyKey || uuidv4(),
    });
    return response.data;
  }

  /**
   * Get total tEUR supply
   */
  async getTotalSupply(): Promise<{ totalSupply: string; totalSupplyFormatted: string }> {
    const response = await this.api.get('/transfers/total-supply');
    return response.data;
  }

  // ============ Conditional Payments ============

  /**
   * Create a conditional payment (escrow)
   */
  async createConditionalPayment(
    params: Omit<ConditionalPaymentRequest, 'idempotencyKey'> & { idempotencyKey?: string }
  ): Promise<TransactionResult & { paymentId: string }> {
    const response = await this.api.post('/payments', {
      ...params,
      idempotencyKey: params.idempotencyKey || uuidv4(),
    });
    return response.data;
  }

  /**
   * Get conditional payment details
   */
  async getPayment(paymentId: string): Promise<PaymentInfo> {
    const response = await this.api.get(`/payments/${paymentId}`);
    return response.data;
  }

  /**
   * Confirm delivery for a conditional payment
   */
  async confirmDelivery(paymentId: string, proof: string): Promise<TransactionResult> {
    const response = await this.api.post(`/payments/${paymentId}/confirm-delivery`, {
      paymentId,
      proof,
    });
    return response.data;
  }

  /**
   * Release funds from conditional payment
   */
  async releasePayment(paymentId: string, proof: string): Promise<TransactionResult> {
    const response = await this.api.post(`/payments/${paymentId}/release`, {
      paymentId,
      proof,
    });
    return response.data;
  }

  /**
   * Cancel a conditional payment
   */
  async cancelPayment(paymentId: string): Promise<TransactionResult> {
    const response = await this.api.post(`/payments/${paymentId}/cancel`);
    return response.data;
  }

  /**
   * Dispute a conditional payment
   */
  async disputePayment(paymentId: string, reason: string): Promise<TransactionResult> {
    const response = await this.api.post(`/payments/${paymentId}/dispute`, {
      paymentId,
      reason,
    });
    return response.data;
  }

  // ============ Utility Methods ============

  /**
   * Convert euros to cents (for API calls)
   */
  static eurosToCents(euros: number): number {
    return Math.round(euros * 100);
  }

  /**
   * Convert cents to euros (from API responses)
   */
  static centsToEuros(cents: number): number {
    return cents / 100;
  }

  /**
   * Format amount as EUR currency
   */
  static formatEuro(cents: number): string {
    return new Intl.NumberFormat('en-EU', {
      style: 'currency',
      currency: 'EUR',
    }).format(cents / 100);
  }

  /**
   * Generate idempotency key for requests
   */
  static generateIdempotencyKey(): string {
    return uuidv4();
  }
}
