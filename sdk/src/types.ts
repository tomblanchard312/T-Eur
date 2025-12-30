export interface ClientConfig {
  apiUrl: string;
  apiKey: string;
  timeout?: number;
}

export interface WalletConfig {
  type: WalletType;
  linkedBankAccount?: string;
  kycHash: string;
}

export enum WalletType {
  INDIVIDUAL = 'INDIVIDUAL',
  MERCHANT = 'MERCHANT',
  PSP = 'PSP',
  NCB = 'NCB',
  BANK = 'BANK',
}

export enum ConditionType {
  DELIVERY = 'DELIVERY',
  TIME_LOCK = 'TIME_LOCK',
  MILESTONE = 'MILESTONE',
  ORACLE = 'ORACLE',
  MULTI_SIG = 'MULTI_SIG',
}

export interface TransferRequest {
  from: string;
  to: string;
  amount: number; // in cents
  idempotencyKey: string;
}

export interface MintRequest {
  to: string;
  amount: number; // in cents
  idempotencyKey: string;
}

export interface ConditionalPaymentRequest {
  payee: string;
  amount: number; // in cents
  conditionType: ConditionType;
  conditionData: string;
  expiresAt: number; // Unix timestamp
  arbiter?: string;
  idempotencyKey: string;
}

export interface WalletInfo {
  address: string;
  walletType: string;
  walletTypeName: string;
  isActive: boolean;
  linkedBank: string;
  kycHash: string;
  registeredAt: string;
  holdingLimit: string;
  balance: string;
  balanceFormatted: string;
  holdingLimitFormatted: string;
}

export interface PaymentInfo {
  paymentId: string;
  payer: string;
  payee: string;
  amount: string;
  amountFormatted: string;
  conditionType: number;
  conditionTypeName: string;
  conditionData: string;
  status: number;
  statusName: string;
  createdAt: string;
  expiresAt: string;
  arbiter: string;
  payerConfirmed: boolean;
  payeeConfirmed: boolean;
}

export interface TransactionResult {
  txHash: string;
  blockNumber: number;
}
