import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { blockchainService, ConditionType } from '../services/blockchain.js';
import {
  broadcastSignedConditionalPayment,
  broadcastSignedDeliveryConfirmation,
  broadcastSignedPaymentRefund,
  broadcastSignedPaymentDispute,
  broadcastSignedDisputeResolution,
} from '../services/signedTransaction.js';
import { parameters } from '../config/parameters.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate, asyncHandler, NotFoundError, ValidationError } from '../middleware/errors.js';
import { idempotency, strictRateLimiter } from '../middleware/common.js';
import { logAuditEvent } from '../utils/logger.js';
import {
  createConditionalPaymentSchema,
  confirmDeliverySchema,
  releasePaymentSchema,
  refundPaymentSchema,
  disputePaymentSchema,
  resolveDisputeSchema,
  getPaymentSchema,
} from '../schemas/index.js';

const router = Router();
router.use(authenticate);

function assertRoutePaymentId(routeId: string | undefined, bodyId: string): void {
  if (routeId !== bodyId) {
    throw new ValidationError('Payment ID in the request body must match the route', {
      routePaymentId: routeId,
      bodyPaymentId: bodyId,
    });
  }
}

router.post('/', requirePermission('conditional_payments'), strictRateLimiter, idempotency, validate(createConditionalPaymentSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof createConditionalPaymentSchema>;
  const { payer, payee, amount, conditionType, conditionData, expiresAt, arbiter, idempotencyKey, signedTransaction } = body;
  const conditionTypeEnum = ConditionType[conditionType as keyof typeof ConditionType];
  const arbiterAddress = arbiter || parameters.default_arbiter_address;

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
    action: 'CONDITIONAL_PAYMENT_CREATED', actor: req.auth!.institutionId, resource: 'payment', resourceId: result.paymentId,
    details: { payer, payee, amount, conditionType, expiresAt, idempotencyKey, payerSigned: true }, result: 'success',
  });
  res.status(201).json({ success: true, data: { paymentId: result.paymentId, payer, payee, amount, conditionType, expiresAt, arbiter: arbiterAddress, txHash: result.txHash, blockNumber: result.blockNumber } });
}));

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
  const { paymentId, proof, payer, signedTransaction } = req.body as z.infer<typeof confirmDeliverySchema>;
  assertRoutePaymentId(req.params.paymentId, paymentId);
  const payment = await blockchainService.getPayment(paymentId);
  if (payment.payer.toLowerCase() !== payer.toLowerCase()) {
    throw new ValidationError('Declared payer does not match the payment payer', { paymentId, declaredPayer: payer });
  }
  const result = await broadcastSignedDeliveryConfirmation({ rawTransaction: signedTransaction, payer: payment.payer, paymentId, proof });
  logAuditEvent({ action: 'DELIVERY_CONFIRMED', actor: req.auth!.institutionId, resource: 'payment', resourceId: paymentId, details: { payer: payment.payer, payerSigned: true }, result: 'success' });
  res.json({ success: true, data: { paymentId, action: 'delivery_confirmed', ...result } });
}));

router.post('/:paymentId/release', requirePermission('conditional_payments'), strictRateLimiter, validate(releasePaymentSchema), asyncHandler(async (req: Request, res: Response) => {
  const { paymentId, proof } = req.body as z.infer<typeof releasePaymentSchema>;
  assertRoutePaymentId(req.params.paymentId, paymentId);
  const payment = await blockchainService.getPayment(paymentId);
  if (payment.conditionType !== ConditionType.TIME_LOCK) {
    throw new ValidationError('Generic release is only permitted for time-locked payments; use the authorized condition-specific flow', { paymentId });
  }
  const result = await blockchainService.releasePayment(paymentId, proof, undefined, req.auth!.institutionId);
  logAuditEvent({ action: 'PAYMENT_RELEASED', actor: req.auth!.institutionId, resource: 'payment', resourceId: paymentId, result: 'success' });
  res.json({ success: true, data: { paymentId, action: 'released', ...result } });
}));

router.post('/:paymentId/cancel', requirePermission('conditional_payments'), strictRateLimiter, validate(refundPaymentSchema), asyncHandler(async (req: Request, res: Response) => {
  const { paymentId, reason, payer, signedTransaction } = req.body as z.infer<typeof refundPaymentSchema>;
  assertRoutePaymentId(req.params.paymentId, paymentId);
  const payment = await blockchainService.getPayment(paymentId);
  if (payment.payer.toLowerCase() !== payer.toLowerCase()) {
    throw new ValidationError('Declared payer does not match the payment payer', { paymentId, declaredPayer: payer });
  }
  const result = await broadcastSignedPaymentRefund({ rawTransaction: signedTransaction, payer: payment.payer, paymentId, reason });
  logAuditEvent({ action: 'PAYMENT_CANCELLED', actor: req.auth!.institutionId, resource: 'payment', resourceId: paymentId, details: { payerSigned: true }, result: 'success' });
  res.json({ success: true, data: { paymentId, action: 'cancelled', ...result } });
}));

router.post('/:paymentId/dispute', requirePermission('conditional_payments'), strictRateLimiter, validate(disputePaymentSchema), asyncHandler(async (req: Request, res: Response) => {
  const { paymentId, reason, actor, signedTransaction } = req.body as z.infer<typeof disputePaymentSchema>;
  assertRoutePaymentId(req.params.paymentId, paymentId);
  const payment = await blockchainService.getPayment(paymentId);
  const normalizedActor = actor.toLowerCase();
  if (normalizedActor !== payment.payer.toLowerCase() && normalizedActor !== payment.payee.toLowerCase()) {
    throw new ValidationError('Dispute actor must be the payment payer or payee', { paymentId, actor });
  }
  const result = await broadcastSignedPaymentDispute({ rawTransaction: signedTransaction, actor, paymentId, reason });
  logAuditEvent({ action: 'PAYMENT_DISPUTED', actor: req.auth!.institutionId, resource: 'payment', resourceId: paymentId, details: { reason, signedActor: actor }, result: 'success' });
  res.json({ success: true, data: { paymentId, action: 'disputed', reason, ...result } });
}));

router.post('/:paymentId/resolve', requirePermission('conditional_payments'), strictRateLimiter, validate(resolveDisputeSchema), asyncHandler(async (req: Request, res: Response) => {
  const { paymentId, releaseToPayee, arbiter, signedTransaction } = req.body as z.infer<typeof resolveDisputeSchema>;
  assertRoutePaymentId(req.params.paymentId, paymentId);
  const payment = await blockchainService.getPayment(paymentId);
  if (payment.arbiter.toLowerCase() !== arbiter.toLowerCase()) {
    throw new ValidationError('Declared arbiter does not match the payment arbiter', { paymentId, arbiter });
  }
  const result = await broadcastSignedDisputeResolution({ rawTransaction: signedTransaction, arbiter: payment.arbiter, paymentId, releaseToPayee });
  logAuditEvent({ action: 'DISPUTE_RESOLVED', actor: req.auth!.institutionId, resource: 'payment', resourceId: paymentId, details: { releaseToPayee, arbiterSigned: true }, result: 'success' });
  res.json({ success: true, data: { paymentId, action: 'dispute_resolved', releaseToPayee, ...result } });
}));

export default router;
