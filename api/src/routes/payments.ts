import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { blockchainService, ConditionType } from '../services/blockchain.js';
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
    // OWASP: Insecure Deserialization - Never trust JSON structure or types
    // Use validated data from req.body
    const body = req.body as z.infer<typeof createConditionalPaymentSchema>;
    const { 
      payee, 
      amount, 
      conditionType, 
      conditionData, 
      expiresAt, 
      arbiter,
      idempotencyKey 
    } = body;
    
    const conditionTypeEnum = ConditionType[conditionType as keyof typeof ConditionType];
    const arbiterAddress = arbiter || parameters.default_arbiter_address;

    const correlationId = generateCorrelationId('payment');
    const userId = req.auth!.institutionId;

    const result = await blockchainService.createConditionalPayment(
      payee,
      BigInt(amount),
      conditionTypeEnum,
      conditionData,
      expiresAt,
      arbiterAddress,
      correlationId,
      userId
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
    // OWASP: Insecure Deserialization - Never trust JSON structure or types
    const body = req.body as z.infer<typeof confirmDeliverySchema>;
    const { paymentId, proof } = body;
    
    // OWASP: Broken Authentication - Use cryptographically secure correlation IDs
    const correlationId = generateCorrelationId('confirm-delivery');
    const userId = req.auth!.institutionId;
    
    const result = await blockchainService.confirmDelivery(paymentId, proof, correlationId, userId);

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
    // OWASP: Insecure Deserialization - Never trust JSON structure or types
    const body = req.body as z.infer<typeof releasePaymentSchema>;
    const { paymentId, proof } = body;
    
    // OWASP: Broken Authentication - Use cryptographically secure correlation IDs
    const correlationId = generateCorrelationId('release-payment');
    const userId = req.auth!.institutionId;
    
    const result = await blockchainService.releasePayment(paymentId, proof, correlationId, userId);

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
    // OWASP: Injection - Use strictly validated path parameters
    const { paymentId } = req.params;
    
    // OWASP: Broken Authentication - Use cryptographically secure correlation IDs
    const correlationId = generateCorrelationId('cancel-payment');
    const userId = req.auth!.institutionId;
    
    const result = await blockchainService.cancelPayment(paymentId!, correlationId, userId);

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
    // OWASP: Insecure Deserialization - Never trust JSON structure or types
    const body = req.body as z.infer<typeof disputePaymentSchema>;
    const { paymentId, reason } = body;
    
    // OWASP: Broken Authentication - Use cryptographically secure correlation IDs
    const correlationId = generateCorrelationId('dispute-payment');
    const userId = req.auth!.institutionId;
    
    const result = await blockchainService.disputePayment(paymentId, correlationId, userId);

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
    // OWASP: Insecure Deserialization - Never trust JSON structure or types
    const body = req.body as z.infer<typeof resolveDisputeSchema>;
    const { paymentId, releaseToPayee } = body;
    
    // OWASP: Broken Authentication - Use cryptographically secure correlation IDs
    const correlationId = generateCorrelationId('resolve-dispute');
    const userId = req.auth!.institutionId;
    
    const result = await blockchainService.resolveDispute(paymentId, releaseToPayee, correlationId, userId);

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
