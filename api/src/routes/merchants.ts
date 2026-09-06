import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { merchantService, MerchantType, MerchantStatus } from '../services/merchant.js';
import { feeEngine, FeeType } from '../services/fee-engine.js';
import { blockchainService } from '../services/blockchain.js';
import { broadcastSignedTransfer } from '../services/signedTransaction.js';
import { authenticate, requirePermission, requireRole } from '../middleware/auth.js';
import { validate, asyncHandler, NotFoundError } from '../middleware/errors.js';
import { strictRateLimiter } from '../middleware/common.js';
import { logAuditEvent } from '../utils/logger.js';
import { generateCorrelationId } from '../utils/crypto.js';

function mapMerchantTypeToFeeType(merchantType: MerchantType): 'retail' | 'hospitality' | 'ecommerce' | 'atm' {
  switch (merchantType) {
    case MerchantType.RETAIL:
      return 'retail';
    case MerchantType.HOSPITALITY:
      return 'hospitality';
    case MerchantType.ECOMMERCE:
      return 'ecommerce';
    case MerchantType.PROFESSIONAL_SERVICES:
    case MerchantType.HEALTHCARE:
    case MerchantType.EDUCATION:
    case MerchantType.GOVERNMENT:
      return 'retail';
    default:
      return 'retail';
  }
}

const merchantApplicationSchema = z.object({
  businessName: z.string().min(1).max(100),
  businessRegistrationNumber: z.string().min(1).max(50),
  taxId: z.string().min(1).max(50),
  businessAddress: z.object({
    street: z.string().min(1).max(200),
    city: z.string().min(1).max(100),
    postalCode: z.string().min(1).max(20),
    country: z.string().min(1).max(100),
  }).strict(),
  contactInfo: z.object({
    email: z.string().email(),
    phone: z.string().min(1).max(20),
    website: z.string().url().optional(),
  }).strict(),
  businessType: z.nativeEnum(MerchantType),
  settlementAccount: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  documents: z.object({
    businessRegistration: z.string().min(1),
    taxCertificate: z.string().min(1),
    bankStatement: z.string().min(1),
    identityVerification: z.string().min(1),
  }).strict(),
  termsAccepted: z.boolean().refine(val => val === true),
  privacyPolicyAccepted: z.boolean().refine(val => val === true),
}).strict();

const merchantReviewSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  notes: z.string().optional(),
}).strict();

const feeCalculationSchema = z.object({
  type: z.nativeEnum(FeeType),
  amount: z.number().int().positive(),
  merchantType: z.enum(['retail', 'hospitality', 'ecommerce', 'atm']).optional(),
  isInstantSettlement: z.boolean().optional(),
  isCrossBorder: z.boolean().optional(),
}).strict();

const merchantPaymentSchema = z.object({
  merchantId: z.string().min(1),
  amount: z.number().int().positive(),
  customerWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  description: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid(),
  signedTransaction: z.string().regex(/^0x[a-fA-F0-9]+$/, 'Invalid signed transaction').min(4).max(262144),
}).strict();

const listMerchantsSchema = z.object({
  status: z.nativeEnum(MerchantStatus).optional(),
  businessType: z.nativeEnum(MerchantType).optional(),
  country: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
}).strict();

const router = Router();
router.use(authenticate);

router.post('/onboard', requirePermission('merchant_onboard'), strictRateLimiter, validate(merchantApplicationSchema), asyncHandler(async (req: Request, res: Response) => {
  const application = req.body as z.infer<typeof merchantApplicationSchema>;
  const correlationId = generateCorrelationId('merchant-onboard');
  const userId = req.auth!.institutionId;
  const result = await merchantService.submitApplication(application, correlationId, userId);
  res.status(201).json({ success: true, data: result });
}));

router.post('/:merchantId/review', requireRole('ECB_ADMIN', 'NCB_OPERATOR'), strictRateLimiter, validate(merchantReviewSchema), asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const { decision, notes } = req.body as z.infer<typeof merchantReviewSchema>;
  const correlationId = generateCorrelationId('merchant-review');
  const userId = req.auth!.institutionId;
  await merchantService.reviewApplication(merchantId!, decision, userId, notes, correlationId, userId);
  res.json({ success: true, data: { merchantId, decision, reviewedBy: userId, reviewedAt: new Date().toISOString() } });
}));

router.get('/', requirePermission('merchant_read'), strictRateLimiter, validate(listMerchantsSchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as z.infer<typeof listMerchantsSchema>;
  const merchants = merchantService.listMerchants({
    status: query.status,
    businessType: query.businessType,
    country: query.country,
    limit: query.limit,
    offset: query.offset,
  });
  logAuditEvent({
    action: 'MERCHANTS_LISTED',
    actor: req.auth!.institutionId,
    resource: 'merchant',
    details: { filters: { status: query.status, businessType: query.businessType, country: query.country }, count: merchants.length },
    result: 'success',
  });
  res.json({ success: true, data: merchants });
}));

router.get('/:merchantId', requirePermission('merchant_read'), strictRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const profile = merchantService.getMerchantProfile(merchantId!);
  if (!profile) throw new NotFoundError('Merchant not found');
  if (req.auth!.institutionId !== profile.id && !req.auth!.roles.includes('ECB_ADMIN')) throw new Error('Access denied');
  res.json({ success: true, data: profile });
}));

router.post('/calculate-fee', strictRateLimiter, validate(feeCalculationSchema), asyncHandler(async (req: Request, res: Response) => {
  const { type, amount, merchantType, isInstantSettlement, isCrossBorder } = req.body;
  const preview = feeEngine.getFeePreview({ type, amount: BigInt(amount), merchantType, isInstantSettlement, isCrossBorder });
  res.json({
    success: true,
    data: {
      ...preview,
      amount,
      amountFormatted: `€${(amount / 100).toFixed(2)}`,
      totalFeeFormatted: `€${(Number(preview.totalFee) / 100).toFixed(2)}`,
      netAmountFormatted: `€${(Number(preview.netAmount) / 100).toFixed(2)}`,
    },
  });
}));

router.post('/:merchantId/payments', requirePermission('merchant_payment'), strictRateLimiter, validate(merchantPaymentSchema), asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const { amount, customerWallet, description, idempotencyKey, signedTransaction } = req.body as z.infer<typeof merchantPaymentSchema>;
  const userId = req.auth!.institutionId;

  const merchant = merchantService.getMerchantProfile(merchantId!);
  if (!merchant) throw new NotFoundError('Merchant not found');
  if (merchant.status !== MerchantStatus.APPROVED) throw new Error('Merchant is not approved for payments');

  const feePreview = feeEngine.getFeePreview({
    type: FeeType.MERCHANT_PAYMENT,
    amount: BigInt(amount),
    merchantType: mapMerchantTypeToFeeType(merchant.businessType),
  });

  if (!feeEngine.validateMinimumAmount(BigInt(amount), FeeType.MERCHANT_PAYMENT, mapMerchantTypeToFeeType(merchant.businessType))) {
    throw new Error('Transaction amount too small after fees');
  }

  // The customer remains the economic payer. The API relays an exact token
  // transfer signed by customerWallet; generic merchant_payment permission is
  // never sufficient to spend another wallet's allowance.
  const result = await broadcastSignedTransfer({
    rawTransaction: signedTransaction,
    payer: customerWallet,
    to: merchant.walletAddress,
    amount: feePreview.netAmount,
  });

  await merchantService.updateMonthlyVolume(merchantId!, merchant.monthlyVolume + BigInt(amount));

  logAuditEvent({
    action: 'MERCHANT_PAYMENT_PROCESSED',
    actor: userId,
    resource: 'payment',
    resourceId: result.txHash,
    details: {
      merchantId,
      customerWallet,
      amount,
      amountFormatted: `€${(amount / 100).toFixed(2)}`,
      fee: Number(feePreview.totalFee),
      feeFormatted: `€${(Number(feePreview.totalFee) / 100).toFixed(2)}`,
      netAmount: Number(feePreview.netAmount),
      netAmountFormatted: `€${(Number(feePreview.netAmount) / 100).toFixed(2)}`,
      description,
      idempotencyKey,
      payerSigned: true,
    },
    result: 'success',
  });

  res.status(201).json({
    success: true,
    data: {
      paymentId: result.txHash,
      merchantId,
      customerWallet,
      amount,
      amountFormatted: `€${(amount / 100).toFixed(2)}`,
      fee: Number(feePreview.totalFee),
      feeFormatted: `€${(Number(feePreview.totalFee) / 100).toFixed(2)}`,
      netAmount: Number(feePreview.netAmount),
      netAmountFormatted: `€${(Number(feePreview.netAmount) / 100).toFixed(2)}`,
      ...result,
    },
  });
}));

router.post('/:merchantId/settlement', requirePermission('merchant_settlement'), strictRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { merchantId } = req.params;
  const correlationId = generateCorrelationId('merchant-settlement');
  const userId = req.auth!.institutionId;
  const merchant = merchantService.getMerchantProfile(merchantId!);
  if (!merchant) throw new NotFoundError('Merchant not found');
  if (merchant.status !== MerchantStatus.APPROVED) throw new Error('Merchant is not approved for settlement');

  const balance = await blockchainService.balanceOf(merchant.walletAddress);
  if (balance === '0') throw new Error('No funds available for settlement');

  const result = await blockchainService.executeWaterfall(merchant.walletAddress, correlationId, userId);
  logAuditEvent({
    action: 'MERCHANT_SETTLEMENT_EXECUTED',
    actor: userId,
    resource: 'settlement',
    resourceId: merchantId!,
    details: { merchantId: merchantId!, settlementAccount: merchant.settlementAccount, amount: balance, amountFormatted: `€${(Number(balance) / 100).toFixed(2)}` },
    result: 'success',
  });
  res.json({ success: true, data: { merchantId, settlementAccount: merchant.settlementAccount, amount: balance, amountFormatted: `€${(Number(balance) / 100).toFixed(2)}`, ...result } });
}));

export default router;
