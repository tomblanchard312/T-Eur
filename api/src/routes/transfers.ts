import { Router, Request, Response } from 'express';
import { blockchainService } from '../services/blockchain.js';
import { authenticate, requirePermission, requireRole } from '../middleware/auth.js';
import { validate, asyncHandler } from '../middleware/errors.js';
import { idempotency, strictRateLimiter } from '../middleware/common.js';
import { logAuditEvent } from '../utils/logger.js';
import {
  mintSchema,
  burnSchema,
  transferSchema,
  executeWaterfallSchema,
  executeReverseWaterfallSchema,
  getBalanceSchema,
} from '../schemas/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @openapi
 * /transfers/mint:
 *   post:
 *     summary: Mint new tEUR tokens (NCB/ECB only)
 *     tags: [Transfers]
 *     security:
 *       - apiKey: []
 */
router.post(
  '/mint',
  requirePermission('mint'),
  requireRole('ECB_ADMIN', 'NCB_OPERATOR'),
  strictRateLimiter,
  idempotency,
  validate(mintSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { to, amount, idempotencyKey } = req.body;
    
    const correlationId = `mint-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const userId = req.auth!.institutionId;
    
    const result = await blockchainService.mint(to, BigInt(amount), correlationId, userId);

    logAuditEvent({
      action: 'TOKENS_MINTED',
      actor: req.auth!.institutionId,
      resource: 'token',
      resourceId: to,
      details: { amount, amountFormatted: `€${(amount / 100).toFixed(2)}`, idempotencyKey },
      result: 'success',
    });

    res.status(201).json({
      success: true,
      data: {
        to,
        amount,
        amountFormatted: `€${(amount / 100).toFixed(2)}`,
        ...result,
      },
    });
  })
);

/**
 * @openapi
 * /transfers/burn:
 *   post:
 *     summary: Burn tEUR tokens (NCB/ECB only)
 *     tags: [Transfers]
 */
router.post(
  '/burn',
  requirePermission('burn'),
  requireRole('ECB_ADMIN', 'NCB_OPERATOR'),
  strictRateLimiter,
  idempotency,
  validate(burnSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { from, amount, idempotencyKey } = req.body;
    
    const correlationId = `burn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const userId = req.auth!.institutionId;
    
    const result = await blockchainService.burn(from, BigInt(amount), correlationId, userId);

    logAuditEvent({
      action: 'TOKENS_BURNED',
      actor: req.auth!.institutionId,
      resource: 'token',
      resourceId: from,
      details: { amount, amountFormatted: `€${(amount / 100).toFixed(2)}`, idempotencyKey },
      result: 'success',
    });

    res.json({
      success: true,
      data: {
        from,
        amount,
        amountFormatted: `€${(amount / 100).toFixed(2)}`,
        ...result,
      },
    });
  })
);

/**
 * @openapi
 * /transfers:
 *   post:
 *     summary: Transfer tEUR between wallets
 *     tags: [Transfers]
 */
router.post(
  '/',
  requirePermission('transfer'),
  strictRateLimiter,
  idempotency,
  validate(transferSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { from, to, amount, idempotencyKey } = req.body;
    
    const correlationId = `transfer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const userId = req.auth!.institutionId;
    
    // For now, the operator performs the transfer
    // In production, this would require the sender's signature
    const result = await blockchainService.transfer(to, BigInt(amount), correlationId, userId);

    logAuditEvent({
      action: 'TOKENS_TRANSFERRED',
      actor: req.auth!.institutionId,
      resource: 'transfer',
      details: { from, to, amount, amountFormatted: `€${(amount / 100).toFixed(2)}`, idempotencyKey },
      result: 'success',
    });

    res.status(201).json({
      success: true,
      data: {
        from,
        to,
        amount,
        amountFormatted: `€${(amount / 100).toFixed(2)}`,
        ...result,
      },
    });
  })
);

/**
 * @openapi
 * /transfers/waterfall:
 *   post:
 *     summary: Execute waterfall (sweep excess to linked bank)
 *     tags: [Transfers]
 */
router.post(
  '/waterfall',
  requirePermission('waterfall'),
  strictRateLimiter,
  validate(executeWaterfallSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { wallet } = req.body;
    
    const correlationId = `waterfall-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const userId = req.auth!.institutionId;
    
    const result = await blockchainService.executeWaterfall(wallet, correlationId, userId);

    logAuditEvent({
      action: 'WATERFALL_EXECUTED',
      actor: req.auth!.institutionId,
      resource: 'wallet',
      resourceId: wallet,
      result: 'success',
    });

    res.json({
      success: true,
      data: {
        wallet,
        operation: 'waterfall',
        ...result,
      },
    });
  })
);

/**
 * @openapi
 * /transfers/reverse-waterfall:
 *   post:
 *     summary: Execute reverse waterfall (fund wallet from linked bank)
 *     tags: [Transfers]
 */
router.post(
  '/reverse-waterfall',
  requirePermission('waterfall'),
  strictRateLimiter,
  idempotency,
  validate(executeReverseWaterfallSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { wallet, amount, idempotencyKey } = req.body;
    
    const correlationId = `reverse-waterfall-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const userId = req.auth!.institutionId;
    
    const result = await blockchainService.executeReverseWaterfall(wallet, BigInt(amount), correlationId, userId);

    logAuditEvent({
      action: 'REVERSE_WATERFALL_EXECUTED',
      actor: req.auth!.institutionId,
      resource: 'wallet',
      resourceId: wallet,
      details: { amount, amountFormatted: `€${(amount / 100).toFixed(2)}`, idempotencyKey },
      result: 'success',
    });

    res.json({
      success: true,
      data: {
        wallet,
        amount,
        amountFormatted: `€${(amount / 100).toFixed(2)}`,
        operation: 'reverse-waterfall',
        ...result,
      },
    });
  })
);

/**
 * @openapi
 * /transfers/balance/{address}:
 *   get:
 *     summary: Get balance for an address
 *     tags: [Transfers]
 */
router.get(
  '/balance/:address',
  requirePermission('read'),
  validate(getBalanceSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;
    
    const balance = await blockchainService.balanceOf(address!);

    res.json({
      success: true,
      data: {
        address,
        balance,
        balanceFormatted: `€${(Number(balance) / 100).toFixed(2)}`,
      },
    });
  })
);

/**
 * @openapi
 * /transfers/total-supply:
 *   get:
 *     summary: Get total supply of tEUR
 *     tags: [Transfers]
 */
router.get(
  '/total-supply',
  requirePermission('read'),
  asyncHandler(async (_req: Request, res: Response) => {
    const totalSupply = await blockchainService.totalSupply();

    res.json({
      success: true,
      data: {
        totalSupply,
        totalSupplyFormatted: `€${(Number(totalSupply) / 100).toFixed(2)}`,
      },
    });
  })
);

export default router;
