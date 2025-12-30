import { z } from 'zod';

// Common patterns
const ethereumAddress = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');
const bytes32 = z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid bytes32 value');
const amount = z.coerce.number().int().positive('Amount must be positive');

// ============ Wallet Operations ============

export const registerWalletSchema = z.object({
  wallet: ethereumAddress,
  walletType: z.enum(['INDIVIDUAL', 'MERCHANT', 'PSP', 'NCB', 'BANK']),
  linkedBankAccount: ethereumAddress.optional(),
  kycHash: bytes32,
  idempotencyKey: z.string().uuid(),
});

export const deactivateWalletSchema = z.object({
  wallet: ethereumAddress,
  reason: z.string().min(10).max(500),
});

export const updateLinkedBankSchema = z.object({
  wallet: ethereumAddress,
  newBankAccount: ethereumAddress,
});

// ============ Token Operations ============

export const mintSchema = z.object({
  to: ethereumAddress,
  amount: amount.describe('Amount in euro cents (e.g., 100000 = €1,000.00)'),
  idempotencyKey: z.string().uuid(),
});

export const burnSchema = z.object({
  from: ethereumAddress,
  amount: amount,
  idempotencyKey: z.string().uuid(),
});

export const transferSchema = z.object({
  from: ethereumAddress,
  to: ethereumAddress,
  amount: amount,
  idempotencyKey: z.string().uuid(),
});

// ============ Waterfall Operations ============

export const executeWaterfallSchema = z.object({
  wallet: ethereumAddress,
});

export const executeReverseWaterfallSchema = z.object({
  wallet: ethereumAddress,
  amount: amount,
  idempotencyKey: z.string().uuid(),
});

// ============ Conditional Payments ============

export const createConditionalPaymentSchema = z.object({
  payee: ethereumAddress,
  amount: amount,
  conditionType: z.enum(['DELIVERY', 'TIME_LOCK', 'MILESTONE', 'ORACLE', 'MULTI_SIG']),
  conditionData: bytes32,
  expiresAt: z.coerce.number().int().positive(),
  arbiter: ethereumAddress.optional(),
  idempotencyKey: z.string().uuid(),
});

export const confirmDeliverySchema = z.object({
  paymentId: bytes32,
  proof: bytes32,
});

export const releasePaymentSchema = z.object({
  paymentId: bytes32,
  proof: bytes32,
});

export const disputePaymentSchema = z.object({
  paymentId: bytes32,
  reason: z.string().min(10).max(1000),
});

export const resolveDisputeSchema = z.object({
  paymentId: bytes32,
  releaseToPayee: z.boolean(),
});

// ============ Query Schemas ============

export const getBalanceSchema = z.object({
  address: ethereumAddress,
});

export const getWalletInfoSchema = z.object({
  address: ethereumAddress,
});

export const getPaymentSchema = z.object({
  paymentId: bytes32,
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// Export types
export type RegisterWalletRequest = z.infer<typeof registerWalletSchema>;
export type MintRequest = z.infer<typeof mintSchema>;
export type BurnRequest = z.infer<typeof burnSchema>;
export type TransferRequest = z.infer<typeof transferSchema>;
export type CreateConditionalPaymentRequest = z.infer<typeof createConditionalPaymentSchema>;
