import { Router, Request, Response } from 'express';
import { governanceService, KeyRole } from '../services/governance.js';
import { authenticate, requireRole, validateKeyRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errors.js';
import { z } from 'zod';

const router = Router();

// All governance routes require ECB_ADMIN role and ISSUING key
router.use(authenticate);
router.use(requireRole('ECB_ADMIN'));
router.use(validateKeyRole(KeyRole.ISSUING));

const RegisterKeySchema = z.object({
  keyId: z.string().min(8),
  publicKey: z.string().startsWith('0x'),
  role: z.nativeEnum(KeyRole),
  ownerId: z.string(),
  expiresAt: z.number().optional(),
});

const RevokeKeySchema = z.object({
  keyId: z.string(),
  reason: z.string(),
});

/**
 * @openapi
 * /governance/keys:
 *   post:
 *     summary: Register a new key in the sovereign hierarchy
 *     tags: [Governance]
 */
router.post(
  '/keys',
  asyncHandler(async (req: Request, res: Response) => {
    const data = RegisterKeySchema.parse(req.body);
    const actorId = req.auth?.keyId;

    if (!actorId) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const key = governanceService.registerKey({
      ...data,
      expiresAt: data.expiresAt || Date.now() + (365 * 24 * 60 * 60 * 1000),
    }, actorId);

    res.status(201).json({
      success: true,
      data: key,
    });
    return;
  })
);

/**
 * @openapi
 * /governance/keys/{keyId}/revoke:
 *   post:
 *     summary: Revoke a key (Emergency Disablement)
 *     tags: [Governance]
 */
router.post(
  '/keys/:keyId/revoke',
  asyncHandler(async (req: Request, res: Response) => {
    const { keyId } = req.params;
    const { reason } = RevokeKeySchema.parse(req.body);
    const actorId = req.auth?.keyId;

    if (!keyId || !actorId) {
      res.status(400).json({ success: false, error: 'Missing required parameters' });
      return;
    }

    governanceService.revokeKey(keyId, reason, actorId);

    res.json({
      success: true,
      message: `Key ${keyId} revoked successfully`,
    });
    return;
  })
);

/**
 * @openapi
 * /governance/keys:
 *   get:
 *     summary: List all keys (Audit)
 *     tags: [Governance]
 */
router.get(
  '/keys',
  asyncHandler(async (_req: Request, res: Response) => {
    // In a real app, this would query a database
    // For now, we'll return a placeholder or implement a list method in GovernanceService
    res.json({
      success: true,
      message: 'Key listing requires database integration',
    });
    return;
  })
);

/**
 * @openapi
 * /governance/keys/{keyId}:
 *   get:
 *     summary: Get key details
 *     tags: [Governance]
 */
router.get(
  '/keys/:keyId',
  asyncHandler(async (req: Request, res: Response) => {
    const { keyId } = req.params;
    if (!keyId) {
      res.status(400).json({ success: false, error: 'Key ID is required' });
      return;
    }

    const key = governanceService.getKey(keyId);

    if (!key) {
      res.status(404).json({
        success: false,
        error: 'Key not found',
      });
      return;
    }

    res.json({
      success: true,
      data: key,
    });
    return;
  })
);

export default router;
