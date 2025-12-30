import { Router, Request, Response } from 'express';
import { blockchainService, WalletType } from '../services/blockchain.js';
import { authenticate, requirePermission } from '../middleware/auth.js';
import { validate, asyncHandler, NotFoundError } from '../middleware/errors.js';
import { idempotency, strictRateLimiter } from '../middleware/common.js';
import { logAuditEvent } from '../utils/logger.js';
import {
  registerWalletSchema,
  deactivateWalletSchema,
  updateLinkedBankSchema,
  getWalletInfoSchema,
} from '../schemas/index.js';

const router = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @openapi
 * /wallets:
 *   post:
 *     summary: Register a new wallet
 *     tags: [Wallets]
 *     security:
 *       - apiKey: []
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterWallet'
 */
router.post(
  '/',
  requirePermission('register_wallet'),
  strictRateLimiter,
  idempotency,
  validate(registerWalletSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { wallet, walletType, linkedBankAccount, kycHash, idempotencyKey } = req.body;
    
    const walletTypeEnum = WalletType[walletType as keyof typeof WalletType];
    const linkedBank = linkedBankAccount || wallet; // Self-linked if not specified

    const result = await blockchainService.registerWallet(
      wallet,
      walletTypeEnum,
      linkedBank,
      kycHash
    );

    logAuditEvent({
      action: 'WALLET_REGISTERED',
      actor: req.auth!.institutionId,
      resource: 'wallet',
      resourceId: wallet,
      details: { walletType, linkedBank, idempotencyKey },
      result: 'success',
    });

    res.status(201).json({
      success: true,
      data: {
        wallet,
        walletType,
        linkedBank,
        ...result,
      },
    });
  })
);

/**
 * @openapi
 * /wallets/{address}:
 *   get:
 *     summary: Get wallet information
 *     tags: [Wallets]
 */
router.get(
  '/:address',
  requirePermission('read'),
  validate(getWalletInfoSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;
    
    const isRegistered = await blockchainService.isRegistered(address!);
    if (!isRegistered) {
      throw new NotFoundError('Wallet', address!);
    }

    const [walletInfo, holdingLimit, balance] = await Promise.all([
      blockchainService.getWalletInfo(address!),
      blockchainService.getHoldingLimit(address!),
      blockchainService.balanceOf(address!),
    ]);

    res.json({
      success: true,
      data: {
        address,
        ...walletInfo,
        holdingLimit,
        balance,
        balanceFormatted: `€${(Number(balance) / 100).toFixed(2)}`,
        holdingLimitFormatted: `€${(Number(holdingLimit) / 100).toFixed(2)}`,
      },
    });
  })
);

/**
 * @openapi
 * /wallets/{address}/balance:
 *   get:
 *     summary: Get wallet balance
 *     tags: [Wallets]
 */
router.get(
  '/:address/balance',
  requirePermission('read'),
  validate(getWalletInfoSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;
    
    const balance = await blockchainService.balanceOf(address!);
    const holdingLimit = await blockchainService.getHoldingLimit(address!);

    res.json({
      success: true,
      data: {
        address,
        balance,
        balanceFormatted: `€${(Number(balance) / 100).toFixed(2)}`,
        holdingLimit,
        holdingLimitFormatted: `€${(Number(holdingLimit) / 100).toFixed(2)}`,
        utilizationPercent: Number(holdingLimit) > 0 
          ? ((Number(balance) / Number(holdingLimit)) * 100).toFixed(2)
          : '0',
      },
    });
  })
);

/**
 * @openapi
 * /wallets/{address}/deactivate:
 *   post:
 *     summary: Deactivate a wallet
 *     tags: [Wallets]
 */
router.post(
  '/:address/deactivate',
  requirePermission('register_wallet'),
  strictRateLimiter,
  validate(deactivateWalletSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { wallet, reason } = req.body;
    
    const result = await blockchainService.deactivateWallet(wallet);

    logAuditEvent({
      action: 'WALLET_DEACTIVATED',
      actor: req.auth!.institutionId,
      resource: 'wallet',
      resourceId: wallet,
      details: { reason },
      result: 'success',
    });

    res.json({
      success: true,
      data: {
        wallet,
        status: 'deactivated',
        reason,
        ...result,
      },
    });
  })
);

/**
 * @openapi
 * /wallets/{address}/reactivate:
 *   post:
 *     summary: Reactivate a wallet
 *     tags: [Wallets]
 */
router.post(
  '/:address/reactivate',
  requirePermission('register_wallet'),
  strictRateLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const { address } = req.params;
    
    const result = await blockchainService.reactivateWallet(address!);

    logAuditEvent({
      action: 'WALLET_REACTIVATED',
      actor: req.auth!.institutionId,
      resource: 'wallet',
      resourceId: address!,
      result: 'success',
    });

    res.json({
      success: true,
      data: {
        wallet: address,
        status: 'active',
        ...result,
      },
    });
  })
);

/**
 * @openapi
 * /wallets/{address}/linked-bank:
 *   put:
 *     summary: Update linked bank account
 *     tags: [Wallets]
 */
router.put(
  '/:address/linked-bank',
  requirePermission('register_wallet'),
  strictRateLimiter,
  idempotency,
  validate(updateLinkedBankSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { wallet, newBankAccount } = req.body;
    
    const result = await blockchainService.updateLinkedBank(wallet, newBankAccount);

    logAuditEvent({
      action: 'LINKED_BANK_UPDATED',
      actor: req.auth!.institutionId,
      resource: 'wallet',
      resourceId: wallet,
      details: { newBankAccount },
      result: 'success',
    });

    res.json({
      success: true,
      data: {
        wallet,
        newBankAccount,
        ...result,
      },
    });
  })
);

export default router;
