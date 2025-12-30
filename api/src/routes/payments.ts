import { Router, Request, Response } from 'express';
import { blockchainService, ConditionType } from '../services/blockchain.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate, asyncHandler, NotFoundError } from '../middleware/errors.js';
import { idempotency, strictRateLimiter } from '../middleware/common.js';
import { logAuditEvent } from '../utils/logger.js';
import {
  createConditionalPaymentSchema,
  confirmDeliverySchema,
  releasePaymentSchema,
  disputePaymentSchema,
  resolveDisputeSchema,
  getPaymentSchema,
} from '../schemas/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @openapi
 * /payments:
 *   post:
 *     summary: Create a conditional payment (escrow)
 *     tags: [Conditional Payments]
 */
router.post(
  '/',
  requirePermission('conditional_payments'),
  strictRateLimiter,
  idempotency,
  validate(createConditionalPaymentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { 
      payee, 
      amount, 
      conditionType, 
      conditionData, 
      expiresAt, 
      arbiter,
      idempotencyKey 
    } = req.body;
    
    const conditionTypeEnum = ConditionType[conditionType as keyof typeof ConditionType];
    const arbiterAddress = arbiter || '0x0000000000000000000000000000000000000000';

    const result = await blockchainService.createConditionalPayment(
      payee,
      BigInt(amount),
      conditionTypeEnum,
      conditionData,
      expiresAt,
      arbiterAddress
    );

    logAuditEvent({
      action: 'CONDITIONAL_PAYMENT_CREATED',
      actor: req.auth!.institutionId,
      resource: 'payment',
      resourceId: result.paymentId,
      details: { 
        payee, 
        amount, 
        amountFormatted: `€${(amount / 100).toFixed(2)}`,
        conditionType,
        expiresAt: new Date(expiresAt * 1000).toISOString(),
        idempotencyKey,
      },
      result: 'success',
    });

    res.status(201).json({
      success: true,
      data: {
        paymentId: result.paymentId,
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

/**
 * @openapi
 * /payments/{paymentId}:
 *   get:
 *     summary: Get payment details
 *     tags: [Conditional Payments]
 */
router.get(
  '/:paymentId',
  requirePermission('read'),
  validate(getPaymentSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { paymentId } = req.params;
    
    try {
      const payment = await blockchainService.getPayment(paymentId!);
      
      res.json({
        success: true,
        data: {
          paymentId,
          ...payment,
          amountFormatted: `€${(Number(payment.amount) / 100).toFixed(2)}`,
        },
      });
    } catch {
      throw new NotFoundError('Payment', paymentId);
    }
  })
);

/**
 * @openapi
 * /payments/{paymentId}/confirm-delivery:
 *   post:
 *     summary: Confirm delivery for a conditional payment
 *     tags: [Conditional Payments]
 */
router.post(
  '/:paymentId/confirm-delivery',
  requirePermission('conditional_payments'),
  strictRateLimiter,
  validate(confirmDeliverySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { paymentId, proof } = req.body;
    
    const result = await blockchainService.confirmDelivery(paymentId, proof);

    logAuditEvent({
      action: 'DELIVERY_CONFIRMED',
      actor: req.auth!.institutionId,
      resource: 'payment',
      resourceId: paymentId,
      result: 'success',
    });

    res.json({
      success: true,
      data: {
        paymentId,
        action: 'delivery_confirmed',
        ...result,
      },
    });
  })
);

/**
 * @openapi
 * /payments/{paymentId}/release:
 *   post:
 *     summary: Release funds from conditional payment
 *     tags: [Conditional Payments]
 */
router.post(
  '/:paymentId/release',
  requirePermission('conditional_payments'),
  strictRateLimiter,
  validate(releasePaymentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { paymentId, proof } = req.body;
    
    const result = await blockchainService.releasePayment(paymentId, proof);

    logAuditEvent({
      action: 'PAYMENT_RELEASED',
      actor: req.auth!.institutionId,
      resource: 'payment',
      resourceId: paymentId,
      result: 'success',
    });

    res.json({
      success: true,
      data: {
        paymentId,
        action: 'released',
        ...result,
      },
    });
  })
);

/**
 * @openapi
 * /payments/{paymentId}/cancel:
 *   post:
 *     summary: Cancel a conditional payment
 *     tags: [Conditional Payments]
 */
router.post(
  '/:paymentId/cancel',
  requirePermission('conditional_payments'),
  strictRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { paymentId } = req.params;
    
    const result = await blockchainService.cancelPayment(paymentId!);

    logAuditEvent({
      action: 'PAYMENT_CANCELLED',
      actor: req.auth!.institutionId,
      resource: 'payment',
      resourceId: paymentId!,
      result: 'success',
    });

    res.json({
      success: true,
      data: {
        paymentId,
        action: 'cancelled',
        ...result,
      },
    });
  })
);

/**
 * @openapi
 * /payments/{paymentId}/dispute:
 *   post:
 *     summary: Dispute a conditional payment
 *     tags: [Conditional Payments]
 */
router.post(
  '/:paymentId/dispute',
  requirePermission('conditional_payments'),
  strictRateLimiter,
  validate(disputePaymentSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { paymentId, reason } = req.body;
    
    const result = await blockchainService.disputePayment(paymentId);

    logAuditEvent({
      action: 'PAYMENT_DISPUTED',
      actor: req.auth!.institutionId,
      resource: 'payment',
      resourceId: paymentId,
      details: { reason },
      result: 'success',
    });

    res.json({
      success: true,
      data: {
        paymentId,
        action: 'disputed',
        reason,
        ...result,
      },
    });
  })
);

/**
 * @openapi
 * /payments/{paymentId}/resolve:
 *   post:
 *     summary: Resolve a disputed payment (arbiter only)
 *     tags: [Conditional Payments]
 */
router.post(
  '/:paymentId/resolve',
  requirePermission('conditional_payments'),
  strictRateLimiter,
  validate(resolveDisputeSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { paymentId, releaseToPayee } = req.body;
    
    const result = await blockchainService.resolveDispute(paymentId, releaseToPayee);

    logAuditEvent({
      action: 'DISPUTE_RESOLVED',
      actor: req.auth!.institutionId,
      resource: 'payment',
      resourceId: paymentId,
      details: { releaseToPayee },
      result: 'success',
    });

    res.json({
      success: true,
      data: {
        paymentId,
        action: 'dispute_resolved',
        releaseToPayee,
        ...result,
      },
    });
  })
);

export default router;
