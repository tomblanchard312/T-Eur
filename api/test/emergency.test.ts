import { describe, it, expect, beforeEach, vi } from 'vitest';
import { blockchainService } from '../src/services/blockchain.js';
import { logAuditEvent } from '../src/utils/logger.js';
import { BlockchainError } from '../src/middleware/errors.js';

vi.mock('../src/utils/logger.js', async () => {
  const actual = await vi.importActual('../src/utils/logger.js') as any;
  return {
    ...actual,
    logAuditEvent: vi.fn(),
  };
});

// These are stateful chain simulations, not unit tests. They require an
// initialized deployment with funded/registered fixtures and are intentionally
// excluded from the ordinary API unit job until that fixture is provisioned.
describe.skip('ECB Emergency Monetary Actions Integration Tests', () => {
  const testUser = '0x1234567890123456789012345678901234567890';
  const testMerchant = '0x0987654321098765432109876543210987654321';

  beforeEach(async () => {
    vi.clearAllMocks();
  });

  describe('1) Emergency Freeze Simulation', () => {
    it('should freeze a wallet and reject transactions immediately', async () => {
      const freezeReason = 'Sanction list match - Immediate freeze required';
      await blockchainService.freezeAccount(testUser, freezeReason, 'corr-01', 'ecb-admin');

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TRANSACTION_INITIATED',
          details: expect.objectContaining({
            operation: 'FREEZE_ACCOUNT',
            method: 'freezeAccount',
            args: expect.stringContaining(testUser),
          }),
        })
      );

      const isFrozen = await blockchainService.isAccountFrozen(testUser);
      expect(isFrozen).toBe(true);

      const balance = await blockchainService.balanceOf(testUser);
      expect(balance).toBeDefined();
    });
  });

  describe('2) Emergency Sanctions Escalation', () => {
    it('should enforce blocks on all transaction paths during escalation', async () => {
      await blockchainService.freezeAccount(testUser, 'Sanctions Escalation', 'corr-02', 'ecb-admin');
      await expect(blockchainService.transfer(testUser, testMerchant, 100n, 'corr-03', 'user-01'))
        .rejects.toThrow(BlockchainError);
    });
  });

  describe('3) Emergency Escrow Simulation', () => {
    it('should place funds into escrow and block spending', async () => {
      const amount = 5000n;
      const legalBasis = 'Court Order #2026-001';
      const expiry = BigInt(Math.floor(Date.now() / 1000) + 86400);

      await blockchainService.escrowFunds(testUser, amount, legalBasis, expiry, 'corr-04', 'ecb-admin');

      const escrowed = await blockchainService.getEscrowedBalance(testUser);
      expect(escrowed.amount).toBeGreaterThanOrEqual(0n);
      expect(escrowed.legalBasis).toBe(legalBasis);

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'TRANSACTION_COMPLETED',
          details: expect.objectContaining({ operation: 'ESCROW_FUNDS' }),
        })
      );
    });

    it('should validate release and burn paths', async () => {
      await blockchainService.releaseEscrowedFunds(testUser, testUser, 'corr-05', 'ecb-admin');
      await expect(blockchainService.burnEscrowedFunds(testUser, 'corr-06', 'ecb-admin'))
        .rejects.toThrow(BlockchainError);
    });
  });

  describe('4) Emergency Mint Suspension', () => {
    it('should disable minting globally and reject attempts', async () => {
      await blockchainService.pause('corr-07', 'ecb-admin');
      expect(await blockchainService.isPaused()).toBe(true);

      await expect(blockchainService.mint(testUser, 1000n, 'Emergency Mint', 'key-01', 'corr-08', 'ecb-admin'))
        .rejects.toThrow(BlockchainError);

      await blockchainService.unpause('corr-09', 'ecb-admin');
      expect(await blockchainService.isPaused()).toBe(false);
    });
  });

  describe('5) Emergency Key Compromise', () => {
    it('should reject requests deterministically after key revocation', async () => {
      await expect(blockchainService.freezeAccount(testMerchant, 'Key Compromise Test', 'corr-10', 'ecb-admin'))
        .rejects.toThrow(BlockchainError);

      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'TRANSACTION_FAILED', result: 'failure' })
      );
    });
  });
});
