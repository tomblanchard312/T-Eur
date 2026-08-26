import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { blockchainService } from '../services/blockchain.js';
import { broadcastSignedTransfer } from '../services/signedTransaction.js';
import { authenticate, requirePermission, requireRole, validateKeyRole } from '../middleware/auth.js';
import { validate, asyncHandler } from '../middleware/errors.js';
import { idempotency, strictRateLimiter } from '../middleware/common.js';
import { logAuditEvent } from '../utils/logger.js';
import { generateCorrelationId } from '../utils/crypto.js';
import { KeyRole } from '../services/governance.js';
import {
  mintSchema,
  burnSchema,
  transferSchema,
  freezeAccountSchema,
  unfreezeAccountSchema,
  escrowFundsSchema,
  releaseEscrowedFundsSchema,
  burnEscrowedFundsSchema,
  accountParamSchema,
  executeWaterfallSchema,
  executeReverseWaterfallSchema,
  getBalanceSchema,
} from '../schemas/index.js';

const router = Router();

router.use(authenticate);

router.post(
  '/mint',
  requirePermission('mint'),
  requireRole('ECB_ADMIN', 'NCB_OPERATOR'),
  validateKeyRole(KeyRole.OPERATIONAL),
  strictRateLimiter,
  idempotency,
  validate(mintSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof mintSchema>;
    const { to, amount, justification, idempotencyKey } = body;
    const correlationId = generateCorrelationId('mint');
    const userId = req.auth!.institutionId;
    const result = await blockchainService.mint(to, BigInt(amount), justification, idempotencyKey, correlationId, userId);

    logAuditEvent({
      action: 'TOKENS_MINTED',
      actor: req.auth!.institutionId,
      resource: 'token',
      resourceId: to,
      details: { amount, amountFormatted: `€${(amount / 100).toFixed(2)}`, idempotencyKey },
      result: 'success',
    });

    res.status(201).json({ success: true, data: { to, amount, amountFormatted: `€${(amount / 100).toFixed(2)}`, ...result } });
  })
);

router.post(
  '/burn',
  requirePermission('burn'),
  requireRole('ECB_ADMIN', 'NCB_OPERATOR'),
  validateKeyRole(KeyRole.OPERATIONAL),
  strictRateLimiter,
  idempotency,
  validate(burnSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof burnSchema>;
    const { from, amount, idempotencyKey } = body;
    const correlationId = generateCorrelationId('burn');
    const userId = req.auth!.institutionId;
    const result = await blockchainService.burn(from, BigInt(amount), idempotencyKey, correlationId, userId);

    logAuditEvent({ action: 'TOKENS_BURNED', actor: req.auth!.institutionId, resource: 'token', resourceId: from, details: { amount, amountFormatted: `€${(amount / 100).toFixed(2)}`, idempotencyKey }, result: 'success' });
    res.json({ success: true, data: { from, amount, amountFormatted: `€${(amount / 100).toFixed(2)}`, ...result } });
  })
);

router.post('/freeze', requirePermission('freeze'), requireRole('ECB_ADMIN'), validateKeyRole(KeyRole.ISSUING), strictRateLimiter, validate(freezeAccountSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof freezeAccountSchema>;
  const { account, reason } = body;
  const correlationId = generateCorrelationId('freeze');
  const userId = req.auth!.institutionId;
  const result = await blockchainService.freezeAccount(account, reason, correlationId, userId);
  logAuditEvent({ action: 'ACCOUNT_FROZEN', actor: req.auth!.institutionId, resource: 'account', resourceId: account, details: { reason }, result: 'success' });
  res.json({ success: true, data: { account, reason, ...result } });
}));

router.post('/unfreeze', requirePermission('freeze'), requireRole('ECB_ADMIN'), strictRateLimiter, validate(unfreezeAccountSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof unfreezeAccountSchema>;
  const { account } = body;
  const correlationId = generateCorrelationId('unfreeze');
  const userId = req.auth!.institutionId;
  const result = await blockchainService.unfreezeAccount(account, correlationId, userId);
  logAuditEvent({ action: 'ACCOUNT_UNFROZEN', actor: req.auth!.institutionId, resource: 'account', resourceId: account, result: 'success' });
  res.json({ success: true, data: { account, ...result } });
}));

router.post('/escrow', requirePermission('escrow'), requireRole('ECB_ADMIN'), strictRateLimiter, validate(escrowFundsSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof escrowFundsSchema>;
  const { account, amount, legalBasis, expiry } = body;
  const correlationId = generateCorrelationId('escrow');
  const userId = req.auth!.institutionId;
  const result = await blockchainService.escrowFunds(account, BigInt(amount), legalBasis, BigInt(expiry), correlationId, userId);
  logAuditEvent({ action: 'FUNDS_ESCROWED', actor: req.auth!.institutionId, resource: 'account', resourceId: account, details: { amount, amountFormatted: `€${(amount / 100).toFixed(2)}`, legalBasis, expiry }, result: 'success' });
  res.json({ success: true, data: { account, amount, amountFormatted: `€${(amount / 100).toFixed(2)}`, legalBasis, expiry, ...result } });
}));

router.post('/release-escrow', requirePermission('escrow'), requireRole('ECB_ADMIN'), strictRateLimiter, validate(releaseEscrowedFundsSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof releaseEscrowedFundsSchema>;
  const { account, to } = body;
  const correlationId = generateCorrelationId('release-escrow');
  const userId = req.auth!.institutionId;
  const result = await blockchainService.releaseEscrowedFunds(account, to, correlationId, userId);
  logAuditEvent({ action: 'ESCROWED_FUNDS_RELEASED', actor: req.auth!.institutionId, resource: 'account', resourceId: account, details: { to }, result: 'success' });
  res.json({ success: true, data: { account, to, ...result } });
}));

router.post('/burn-escrow', requirePermission('escrow'), requireRole('ECB_ADMIN'), strictRateLimiter, validate(burnEscrowedFundsSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof burnEscrowedFundsSchema>;
  const { account } = body;
  const correlationId = generateCorrelationId('burn-escrow');
  const userId = req.auth!.institutionId;
  const result = await blockchainService.burnEscrowedFunds(account, correlationId, userId);
  logAuditEvent({ action: 'ESCROWED_FUNDS_BURNED', actor: req.auth!.institutionId, resource: 'account', resourceId: account, result: 'success' });
  res.json({ success: true, data: { account, ...result } });
}));

router.get('/frozen/:account', requirePermission('read'), asyncHandler(async (req: Request, res: Response) => {
  const { account } = req.params;
  const validated = accountParamSchema.parse({ account });
  const isFrozen = await blockchainService.isAccountFrozen(validated.account);
  res.json({ success: true, data: { account: validated.account, isFrozen } });
}));

router.get('/escrow/:account', requirePermission('read'), asyncHandler(async (req: Request, res: Response) => {
  const { account } = req.params;
  const validated = accountParamSchema.parse({ account });
  const escrowedBalance = await blockchainService.getEscrowedBalance(validated.account);
  const escrowTotal = await blockchainService.getEscrowTotal(validated.account);
  res.json({ success: true, data: { account: validated.account, escrowedBalance: { amount: escrowedBalance.amount.toString(), amountFormatted: `€${(Number(escrowedBalance.amount) / 100).toFixed(2)}`, legalBasis: escrowedBalance.legalBasis, expiry: escrowedBalance.expiry.toString() }, escrowTotal: escrowTotal.toString(), escrowTotalFormatted: `€${(Number(escrowTotal) / 100).toFixed(2)}` } });
}));

router.post(
  '/',
  requirePermission('transfer'),
  strictRateLimiter,
  idempotency,
  validate(transferSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof transferSchema>;
    const { from, to, amount, idempotencyKey, signedTransaction } = body;

    // Custody is preserved by requiring a transaction signed by `from` that
    // calls TokenizedEuro.transfer(to, amount). The gateway only validates and
    // relays it; the shared operator key never acquires authority over payer funds.
    const result = await broadcastSignedTransfer({
      rawTransaction: signedTransaction,
      payer: from,
      to,
      amount: BigInt(amount),
    });

    logAuditEvent({
      action: 'TOKENS_TRANSFERRED',
      actor: req.auth!.institutionId,
      resource: 'transfer',
      details: { from, to, amount, amountFormatted: `€${(amount / 100).toFixed(2)}`, idempotencyKey, payerSigned: true },
      result: 'success',
    });

    res.status(201).json({ success: true, data: { from, to, amount, amountFormatted: `€${(amount / 100).toFixed(2)}`, txHash: result.txHash, blockNumber: result.blockNumber } });
  })
);

router.post('/waterfall', requirePermission('waterfall'), strictRateLimiter, validate(executeWaterfallSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof executeWaterfallSchema>;
  const { wallet } = body;
  const correlationId = generateCorrelationId('waterfall');
  const userId = req.auth!.institutionId;
  const result = await blockchainService.executeWaterfall(wallet, correlationId, userId);
  logAuditEvent({ action: 'WATERFALL_EXECUTED', actor: req.auth!.institutionId, resource: 'wallet', resourceId: wallet, result: 'success' });
  res.json({ success: true, data: { wallet, operation: 'waterfall', ...result } });
}));

router.post('/reverse-waterfall', requirePermission('waterfall'), strictRateLimiter, idempotency, validate(executeReverseWaterfallSchema), asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as z.infer<typeof executeReverseWaterfallSchema>;
  const { wallet, amount, idempotencyKey } = body;
  const correlationId = generateCorrelationId('reverse-waterfall');
  const userId = req.auth!.institutionId;
  const result = await blockchainService.executeReverseWaterfall(wallet, BigInt(amount), idempotencyKey, correlationId, userId);
  logAuditEvent({ action: 'REVERSE_WATERFALL_EXECUTED', actor: req.auth!.institutionId, resource: 'wallet', resourceId: wallet, details: { amount, amountFormatted: `€${(amount / 100).toFixed(2)}`, idempotencyKey }, result: 'success' });
  res.json({ success: true, data: { wallet, amount, amountFormatted: `€${(amount / 100).toFixed(2)}`, operation: 'reverse-waterfall', ...result } });
}));

router.get('/balance/:address', requirePermission('read'), validate(getBalanceSchema, 'params'), asyncHandler(async (req: Request, res: Response) => {
  const { address } = req.params;
  const balance = await blockchainService.balanceOf(address!);
  res.json({ success: true, data: { address, balance, balanceFormatted: `€${(Number(balance) / 100).toFixed(2)}` } });
}));

router.get('/total-supply', requirePermission('read'), asyncHandler(async (_req: Request, res: Response) => {
  const totalSupply = await blockchainService.totalSupply();
  res.json({ success: true, data: { totalSupply, totalSupplyFormatted: `€${(Number(totalSupply) / 100).toFixed(2)}` } });
}));

export default router;
