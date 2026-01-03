import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate, asyncHandler, NotFoundError } from '../middleware/errors.js';
import { logAuditEvent } from '../utils/logger.js';
import { fraudService } from '../services/fraud.js';

const router = Router();

// OWASP: Injection Risks - Strict validation schemas
const analyzeTransactionSchema = z.object({
  amount: z.number().int().positive(),
  from: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  to: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
}).strict();

const overrideAlertSchema = z.object({
  agent_id: z.string().min(1),
  reason: z.string().min(10).max(1000),
}).strict();

/**
 * Analyze transaction for fraud
 */
router.post(
  '/analyze',
  validate(analyzeTransactionSchema),
  asyncHandler(async (req: Request, res: Response) => {
    // OWASP: Insecure Deserialization - Never trust JSON structure or types
    const { amount, from, to } = req.body as z.infer<typeof analyzeTransactionSchema>;

    // Check if amount exceeds threshold (200000 cents = 2000 EUR)
    if (amount > 200000) {
      const alertId = await fraudService.createAlert(amount, from, to);

      logAuditEvent({
        action: 'FRAUD_ALERT_CREATED',
        actor: 'system',
        resource: 'fraud_alert',
        resourceId: alertId,
        details: { amount, from, to },
        result: 'success'
      });

      res.status(201).json({ id: alertId });
      return;
    }

    // No alert needed
    res.status(204).send();
  })
);

// All other routes require authentication
router.use(authenticate);

/**
 * Override a fraud alert
 */
router.post(
  '/alerts/:id/override',
  requirePermission('admin_override'),
  validate(overrideAlertSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { agent_id, reason } = req.body as z.infer<typeof overrideAlertSchema>;

    if (!id || !agent_id) {
      throw new Error('Missing required parameters');
    }

    const success = await fraudService.overrideAlert(id, agent_id, reason);
    
    if (!success) {
      throw new NotFoundError('FraudAlert', id);
    }

    logAuditEvent({
      action: 'FRAUD_ALERT_OVERRIDDEN',
      actor: req.auth!.institutionId,
      resource: 'fraud_alert',
      resourceId: id,
      details: { agent_id, reason },
      result: 'success'
    });

    res.json({
      success: true,
      data: {
        id,
        status: 'overridden',
        overridden_by: agent_id,
        overridden_at: new Date().toISOString(),
      },
    });
  })
);

export default router;