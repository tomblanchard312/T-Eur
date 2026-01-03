import { Router, Request, Response } from 'express';
import { authenticate, requirePermission, requireRole } from '../middleware/auth.js';
import { validate, asyncHandler } from '../middleware/errors.js';
import { strictRateLimiter } from '../middleware/common.js';
import { logAuditEvent } from '../utils/logger.js';
import { auditService } from '../services/audit.js';
import { z } from 'zod';

const router = Router();

// All routes require authentication and admin role
router.use(authenticate);
router.use(requireRole('ECB_ADMIN'));

/**
 * Query audit logs schema
 */
const queryAuditLogsSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  userId: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  result: z.enum(['success', 'failure']).optional(),
  correlationId: z.string().optional(),
  limit: z.coerce.number().min(1).max(1000).default(100),
  offset: z.coerce.number().min(0).default(0),
}).strict(); // OWASP: Injection Risks - Reject unknown fields

/**
 * @openapi
 * /audit/logs:
 *   get:
 *     summary: Query audit logs (Admin only)
 *     tags: [Audit]
 *     security:
 *       - apiKey: []
 */
router.get(
  '/logs',
  requirePermission('audit_read'),
  strictRateLimiter,
  validate(queryAuditLogsSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    // OWASP: Insecure Deserialization - Never trust JSON structure or types
    // Use validated data from req.query
    const query = req.query as unknown as z.infer<typeof queryAuditLogsSchema>;

    const { logs, total } = await auditService.queryLogs({
      startDate: query.startDate,
      endDate: query.endDate,
      userId: query.userId,
      action: query.action,
      resource: query.resource,
      result: query.result,
      correlationId: query.correlationId,
      limit: query.limit,
      offset: query.offset,
    });

    logAuditEvent({
      action: 'AUDIT_LOGS_QUERIED',
      actor: req.auth!.institutionId,
      resource: 'audit',
      details: {
        query: { 
          startDate: query.startDate, 
          endDate: query.endDate, 
          userId: query.userId, 
          action: query.action, 
          limit: query.limit, 
          offset: query.offset 
        },
        resultsCount: logs.length,
        totalMatching: total,
      },
      result: 'success',
    });

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          limit: query.limit,
          offset: query.offset,
          total,
        },
      },
    });
  })
);

/**
 * @openapi
 * /audit/transactions/{correlationId}:
 *   get:
 *     summary: Get transaction audit trail by correlation ID (Admin only)
 *     tags: [Audit]
 *     security:
 *       - apiKey: []
 */
router.get(
  '/transactions/:correlationId',
  requirePermission('audit_read'),
  strictRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { correlationId } = req.params;

    // In a real implementation, this would query for all events with the correlation ID
    const transactionTrail = [
      {
        id: 'event-1',
        timestamp: new Date(Date.now() - 5000).toISOString(),
        action: 'API_REQUEST_RECEIVED',
        details: { method: 'POST', url: '/api/transfers/mint' },
      },
      {
        id: 'event-2',
        timestamp: new Date(Date.now() - 4000).toISOString(),
        action: 'BLOCKCHAIN_TRANSACTION_INITIATED',
        details: { method: 'mint', contract: 'TokenizedEuro' },
      },
      {
        id: 'event-3',
        timestamp: new Date(Date.now() - 3000).toISOString(),
        action: 'BLOCKCHAIN_TRANSACTION_COMPLETED',
        details: { txHash: '0xabc...', blockNumber: 12345 },
      },
      {
        id: 'event-4',
        timestamp: new Date(Date.now() - 2000).toISOString(),
        action: 'API_REQUEST_COMPLETED',
        details: { statusCode: 200 },
      },
    ];

    logAuditEvent({
      action: 'TRANSACTION_AUDIT_TRAIL_QUERIED',
      actor: req.auth!.institutionId,
      resource: 'audit',
      ...(correlationId && { resourceId: correlationId }),
      result: 'success',
    });

    res.json({
      success: true,
      data: {
        correlationId,
        events: transactionTrail,
      },
    });
  })
);

/**
 * @openapi
 * /audit/summary:
 *   get:
 *     summary: Get audit summary statistics (Admin only)
 *     tags: [Audit]
 *     security:
 *       - apiKey: []
 */
router.get(
  '/summary',
  requirePermission('audit_read'),
  strictRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    // In a real implementation, this would aggregate audit data
    const summary = {
      totalEvents: 1250,
      eventsByType: {
        API_REQUEST_RECEIVED: 500,
        BLOCKCHAIN_TRANSACTION_COMPLETED: 200,
        TOKENS_MINTED: 50,
        WALLET_REGISTERED: 25,
      },
      eventsByResult: {
        success: 1200,
        failure: 50,
      },
      recentActivity: {
        lastHour: 45,
        lastDay: 234,
        lastWeek: 1250,
      },
    };

    logAuditEvent({
      action: 'AUDIT_SUMMARY_QUERIED',
      actor: req.auth!.institutionId,
      resource: 'audit',
      result: 'success',
    });

    res.json({
      success: true,
      data: summary,
    });
  })
);

export default router;