import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { blockchainService, ConditionType } from '../services/blockchain.js';
import { broadcastSignedConditionalPayment } from '../services/signedTransaction.js';
import { parameters } from '../config/parameters.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate, asyncHandler, NotFoundError } from '../middleware/errors.js';
import { idempotency, strictRateLimiter } from '../middleware/common.js';
import { logAuditEvent } from '../utils/logger.js';
import { generateCorrelationId } from '../utils/crypto.js';
import {
  createConditionalPaymentSchema,
  confirmDeliverySchema,
  releasePaymentSchema,
  disputePaymentSchema,
  resolveDisputeSchema,
  getPaymentSchema,
} from '../schemas/index.js';

const router = Router();
router.use(authenticate);

router.post(
  '/',
  requirePermission('conditional_payments'),
  strictRateLimiter,
  idempotency,
  validate(createConditionalPaymentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof createConditionalPaymentSchema>;
    const {
      payer,
      payee,
      amount,
      conditionType,
      conditionData,
      expiresAt,
      arbiter,
      idempotencyKey,
      signedTransaction,
    } = body;

    const conditionTypeEnum = ConditionType[conditionType as keyof typeof ConditionType];
    const arbiterAddress = arbiter || parameters.default_arbiter_address;

    // ConditionalPayments records msg.sender as payer. To preserve custody the
    // gateway therefore relays a transaction signed by the payer itself rather
    // than invoking the contract through the shared operator signer.
    const result = await broadcastSignedConditionalPayment({
      rawTransaction: signedTransaction,
      payer,
      payee,
      amount: BigInt(amount),
      conditionType: conditionTypeEnum,
      conditionData,
      expiresAt,
      arbiter: arbiterAddress,
      idempotencyKey,
    });

    logAuditEvent({
      action: 'CONDITIONAL_PAYMENT_CREATED',
      actor: req.auth!.institutionId,
      resource: 'payment',
      resourceId: result.paymentId,
      details: {
        payer,
        payee,
        amount,
        amountFormatted: `€${(amount / 100).toFixed(2)}`,
        conditionType,
        expiresAt: new Date(expiresAt * 1000).toISOString(),
        idempotencyKey,
        payerSigned: true,
      },
      result: 'success',
    });

    res.status(201).json({
      success: true,
      data: {
        paymentId: result.paymentId,
        payer,
        payee,
        amount,
        amountFormatted: `€${(amount / 100).toFixed(2)}`,
        conditionType,
        expiresAt: new Date(expiresAt * 1000).toISOString(),
        arbiter: arbiterAddress,
        txHash: result.txHash,
        blockNumber: result.blockNumber,
      },
    });
  })
);

router.get('/:paymentId', requirePermission('read'), validate(getPaymentSchema, 'params'), asyncHandler(async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  try {
    const payment = await blockchainService.getPayment(paymentId!);
    res.json({ success: true, data: { paymentId, ...payment, amountFormatted: `€${(Number(payment.amount) / 100).toFixed(2)}` } });
  } catch {
    throw new NotFoundError('Payment', paymentId);
  }
}));

router.post('/:paymentId/confirm-delivery', requirePermission('conditional_payments'), strictRateLimiter, validate(confirmDeliverySchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof confirmDeliverySchema>;
  const { paymentId, proof } = body;
  const correlationId = generateCorrelationId('confirm-delivery');
  const userId = req.auth!.institutionId;
  const result = await blockchainService.confirmDelivery(paymentId, proof, correlationId, userId);
  logAuditEvent({ action: 'DELIVERY_CONFIRMED', actor: req.auth!.institutionId, resource: 'payment', resourceId: paymentId, result: 'success' });
  res.json({ success: true, data: { paymentId, action: 'delivery_confirmed', ...result } });
}));

router.post('/:paymentId/release', requirePermission('conditional_payments'), strictRateLimiter, validate(releasePaymentSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof releasePaymentSchema>;
  const { paymentId, proof } = body;
  const correlationId = generateCorrelationId('release-payment');
  const userId = req.auth!.institutionId;
  const result = await blockchainService.releasePayment(paymentId, proof, correlationId, userId);
  logAuditEvent({ action: 'PAYMENT_RELEASED', actor: req.auth!.institutionId, resource: 'payment', resourceId: paymentId, result: 'success' });
  res.json({ success: true, data: { paymentId, action: 'released', ...result } });
}));

router.post('/:paymentId/cancel', requirePermission('conditional_payments'), strictRateLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { paymentId } = req.params;
  const correlationId = generateCorrelationId('cancel-payment');
  const userId = req.auth!.institutionId;
  const reason = typeof req.body?.reason === 'string' && req.body.reason.length > 0 ? req.body.reason.slice(0, 256) : 'Cancelled by payer';
  const result = await blockchainService.refundPayment(paymentId!, reason, correlationId, userId);
  logAuditEvent({ action: 'PAYMENT_CANCELLED', actor: req.auth!.institutionId, resource: 'payment', resourceId: paymentId!, result: 'success' });
  res.json({ success: true, data: { paymentId, action: 'cancelled', ...result } });
}));

router.post('/:paymentId/dispute', requirePermission('conditional_payments'), strictRateLimiter, validate(disputePaymentSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof disputePaymentSchema>;
  const { paymentId, reason } = body;
  const correlationId = generateCorrelationId('dispute-payment');
  const userId = req.auth!.institutionId;
  const result = await blockchainService.disputePayment(paymentId, reason, correlationId, userId);
  logAuditEvent({ action: 'PAYMENT_DISPUTED', actor: req.auth!.institutionId, resource: 'payment', resourceId: paymentId, details: { reason }, result: 'success' });
  res.json({ success: true, data: { paymentId, action: 'disputed', reason, ...result } });
}));

router.post('/:paymentId/resolve', requirePermission('conditional_payments'), strictRateLimiter, validate(resolveDisputeSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof resolveDisputeSchema>;
  const { paymentId, releaseToPayee } = body;
  const correlationId = generateCorrelationId('resolve-dispute');
  const userId = req.auth!.institutionId;
  const result = await blockchainService.resolveDispute(paymentId, releaseToPayee, correlationId, userId);
  logAuditEvent({ action: 'DISPUTE_RESOLVED', actor: req.auth!.institutionId, resource: 'payment', resourceId: paymentId, details: { releaseToPayee }, result: 'success' });
  res.json({ success: true, data: { paymentId, action: 'dispute_resolved', releaseToPayee, ...result } });
}));

export default router;
