import { describe, it, expect } from 'vitest';
import { blockchainService } from '../src/services/blockchain.js';

// Stateful availability validation requires an initialized deployment and is
// not a unit test. Keep it explicit until the emergency integration fixture is
// provisioned in CI.
describe.skip('System Availability Post-Emergency Simulations', () => {
  const testUser = '0x1234567890123456789012345678901234567890';

  it('should allow balance queries even if the system is paused', async () => {
    const balance = await blockchainService.balanceOf(testUser);
    expect(balance).toBeDefined();
    expect(typeof balance).toBe('string');
  });

  it('should allow checking freeze status even if the system is paused', async () => {
    const isFrozen = await blockchainService.isAccountFrozen(testUser);
    expect(typeof isFrozen).toBe('boolean');
  });

  it('should allow checking total supply even if the system is paused', async () => {
    const supply = await blockchainService.totalSupply();
    expect(supply).toBeDefined();
    expect(typeof supply).toBe('string');
  });

  it('should allow retrieving escrow info even if the system is paused', async () => {
    const escrowInfo = await blockchainService.getEscrowedBalance(testUser);
    expect(escrowInfo).toBeDefined();
    expect(escrowInfo.amount).toBeDefined();
  });
});
