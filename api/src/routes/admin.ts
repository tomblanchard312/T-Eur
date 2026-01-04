import { Router, Request, Response } from 'express';
import { blockchainService, ROLES } from '../services/blockchain.js';
import { authenticate, requireRole, validateKeyRole } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errors.js';
import { strictRateLimiter } from '../middleware/common.js';
import { logAuditEvent } from '../utils/logger.js';
import { KeyRole } from '../services/governance.js';

const router = Router();

// All admin routes require authentication and ECB/NCB role
router.use(authenticate);
router.use(requireRole('ECB_ADMIN', 'NCB_OPERATOR'));
router.use(validateKeyRole(KeyRole.OPERATIONAL)); // Minimum role for admin operations

/**
 * @openapi
 * /admin/system/status:
 *   get:
 *     summary: Get system status
 *     tags: [Admin]
 */
router.get(
  '/system/status',
  asyncHandler(async (_req: Request, res: Response) => {
    const [blockNumber, totalSupply, isPaused, gasPrice] = await Promise.all([
      blockchainService.getBlockNumber(),
      blockchainService.totalSupply(),
      blockchainService.isPaused(),
      blockchainService.getGasPrice(),
    ]);

    res.json({
      success: true,
      data: {
        blockchain: {
          blockNumber,
          gasPrice,
          operator: blockchainService.getOperatorAddress(),
        },
        token: {
          totalSupply,
          totalSupplyFormatted: `€${(Number(totalSupply) / 100).toFixed(2)}`,
          isPaused,
        },
        api: {
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
          version: '1.0.0',
        },
      },
    });
  })
);

/**
 * @openapi
 * /admin/system/pause:
 *   post:
 *     summary: Pause token operations (emergency)
 *     tags: [Admin]
 */
router.post(
  '/system/pause',
  requireRole('ECB_ADMIN'),
  validateKeyRole(KeyRole.ISSUING), // ECB-only emergency power
  strictRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await blockchainService.pause();

    logAuditEvent({
      action: 'SYSTEM_PAUSED',
      actor: req.auth!.institutionId,
      resource: 'system',
      result: 'success',
    });

    res.json({
      success: true,
      data: {
        action: 'paused',
        ...result,
      },
    });
  })
);

/**
 * @openapi
 * /admin/system/unpause:
 *   post:
 *     summary: Resume token operations
 *     tags: [Admin]
 */
router.post(
  '/system/unpause',
  requireRole('ECB_ADMIN'),
  validateKeyRole(KeyRole.ISSUING), // ECB-only emergency power
  strictRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await blockchainService.unpause();

    logAuditEvent({
      action: 'SYSTEM_UNPAUSED',
      actor: req.auth!.institutionId,
      resource: 'system',
      result: 'success',
    });

    res.json({
      success: true,
      data: {
        action: 'unpaused',
        ...result,
      },
    });
  })
);

/**
 * @openapi
 * /admin/roles/grant:
 *   post:
 *     summary: Grant a role to an address
 *     tags: [Admin]
 */
router.post(
  '/roles/grant',
  requireRole('ECB_ADMIN'),
  strictRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { role, account } = req.body;
    
    const roleHash = ROLES[role as keyof typeof ROLES];
    if (!roleHash) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLE', message: `Unknown role: ${role}` },
      });
      return;
    }

    const result = await blockchainService.grantRole(roleHash, account);

    logAuditEvent({
      action: 'ROLE_GRANTED',
      actor: req.auth!.institutionId,
      resource: 'role',
      resourceId: account,
      details: { role },
      result: 'success',
    });

    res.json({
      success: true,
      data: {
        role,
        account,
        action: 'granted',
        ...result,
      },
    });
  })
);

/**
 * @openapi
 * /admin/roles/revoke:
 *   post:
 *     summary: Revoke a role from an address
 *     tags: [Admin]
 */
router.post(
  '/roles/revoke',
  requireRole('ECB_ADMIN'),
  strictRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { role, account } = req.body;
    
    const roleHash = ROLES[role as keyof typeof ROLES];
    if (!roleHash) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLE', message: `Unknown role: ${role}` },
      });
      return;
    }

    const result = await blockchainService.revokeRole(roleHash, account);

    logAuditEvent({
      action: 'ROLE_REVOKED',
      actor: req.auth!.institutionId,
      resource: 'role',
      resourceId: account,
      details: { role },
      result: 'success',
    });

    res.json({
      success: true,
      data: {
        role,
        account,
        action: 'revoked',
        ...result,
      },
    });
  })
);

/**
 * @openapi
 * /admin/roles/check:
 *   get:
 *     summary: Check if an address has a specific role
 *     tags: [Admin]
 */
router.get(
  '/roles/check',
  asyncHandler(async (req: Request, res: Response) => {
    const { role, account } = req.query as { role: string; account: string };
    
    const roleHash = ROLES[role as keyof typeof ROLES];
    if (!roleHash) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_ROLE', message: `Unknown role: ${role}` },
      });
      return;
    }

    const hasRole = await blockchainService.hasRole(roleHash, account);

    res.json({
      success: true,
      data: {
        role,
        account,
        hasRole,
      },
    });
  })
);

/**
 * @openapi
 * /admin/roles/available:
 *   get:
 *     summary: List all available roles
 *     tags: [Admin]
 */
router.get(
  '/roles/available',
  asyncHandler(async (_req: Request, res: Response) => {
    const roles = Object.entries(ROLES).map(([name, hash]) => ({
      name,
      hash,
    }));

    res.json({
      success: true,
      data: { roles },
    });
  })
);

export default router;
