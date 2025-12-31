import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate, asyncHandler } from '../middleware/errors.js';
import { logAuditEvent } from '../utils/logger.js';

const router = Router();

const ALERTS_LOG = path.join(process.cwd(), 'logs', 'alerts.jsonl');

interface FraudAlert {
  id: string;
  timestamp: string;
  transaction: {
    amount: number;
    from: string;
    to: string;
  };
  status: 'active' | 'overridden';
  overridden_by?: string;
  override_reason?: string;
  override_timestamp?: string;
}

/**
 * Analyze transaction for fraud
 */
router.post(
  '/analyze',
  asyncHandler(async (req: Request, res: Response) => {
    const { amount, from, to } = req.body;

    // Check if amount exceeds threshold (200000 cents = 2000 EUR)
    if (amount > 200000) {
      const alert: FraudAlert = {
        id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        transaction: { amount, from, to },
        status: 'active'
      };

      // Append to log file
      const logLine = JSON.stringify(alert) + '\n';
      fs.appendFileSync(ALERTS_LOG, logLine);

      logAuditEvent({
        action: 'fraud_alert_created',
        actor: 'system',
        resource: 'fraud_alert',
        resourceId: alert.id,
        details: { amount, from, to },
        result: 'success'
      });

      res.status(201).json({ id: alert.id });
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
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { agent_id, reason } = req.body;

    // Read all alerts
    if (!fs.existsSync(ALERTS_LOG)) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    const alerts: FraudAlert[] = fs.readFileSync(ALERTS_LOG, 'utf8')
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));

    const alertIndex = alerts.findIndex(a => a.id === id);
    if (alertIndex === -1) {
      res.status(404).json({ error: 'Alert not found' });
      return;
    }

    const alert = alerts[alertIndex]!;

    // Update alert
    alert.status = 'overridden';
    alert.overridden_by = agent_id;
    alert.override_reason = reason;
    alert.override_timestamp = new Date().toISOString();

    // Rewrite log file
    const logContent = alerts.map(a => JSON.stringify(a)).join('\n') + '\n';
    fs.writeFileSync(ALERTS_LOG, logContent);

    logAuditEvent({
      action: 'fraud_alert_overridden',
      actor: agent_id,
      resource: 'fraud_alert',
      ...(id && { resourceId: id }),
      details: { reason },
      result: 'success'
    });

    res.json({
      updated: alert
    });
  })
);

export default router;