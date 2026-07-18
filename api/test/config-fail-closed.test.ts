import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };

function clearSecurityConfiguration(): void {
  for (const name of [
    'BLOCKCHAIN_RPC_URL',
    'BLOCKCHAIN_CHAIN_ID',
    'BLOCKCHAIN_OPERATOR_PRIVATE_KEY',
    'CONTRACT_PERMISSIONING',
    'CONTRACT_WALLET_REGISTRY',
    'CONTRACT_TOKENIZED_EURO',
    'CONTRACT_CONDITIONAL_PAYMENTS',
    'JWT_SECRET',
    'JWT_ISSUER',
    'JWT_AUDIENCE',
  ]) {
    delete process.env[name];
  }
}

describe('configuration fail-closed behavior', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    clearSecurityConfiguration();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it.each(['staging', 'production'])('rejects missing security configuration in %s', async nodeEnv => {
    process.env.NODE_ENV = nodeEnv;
    await expect(import('../src/config/index.js')).rejects.toThrow('Invalid configuration');
  });

  it('permits local defaults in test mode', async () => {
    process.env.NODE_ENV = 'test';
    const { config } = await import('../src/config/index.js');
    expect(config.nodeEnv).toBe('test');
    expect(config.blockchain.rpcUrl).toBe('http://localhost:8545');
  });

  it('loads production only when all required values are supplied', async () => {
    process.env.NODE_ENV = 'production';
    process.env.BLOCKCHAIN_RPC_URL = 'https://rpc.example.invalid';
    process.env.BLOCKCHAIN_CHAIN_ID = '1';
    process.env.BLOCKCHAIN_OPERATOR_PRIVATE_KEY = `0x${'1'.repeat(64)}`;
    process.env.CONTRACT_PERMISSIONING = `0x${'1'.repeat(40)}`;
    process.env.CONTRACT_WALLET_REGISTRY = `0x${'2'.repeat(40)}`;
    process.env.CONTRACT_TOKENIZED_EURO = `0x${'3'.repeat(40)}`;
    process.env.CONTRACT_CONDITIONAL_PAYMENTS = `0x${'4'.repeat(40)}`;
    process.env.JWT_SECRET = 'production-test-secret-that-is-long-enough';
    process.env.JWT_ISSUER = 'teur-test-issuer';
    process.env.JWT_AUDIENCE = 'teur-test-audience';
    process.env.CORS_ORIGIN = 'https://dashboard.example.invalid';

    const { config } = await import('../src/config/index.js');
    expect(config.nodeEnv).toBe('production');
    expect(config.allowDemoIdentities).toBe(false);
    expect(config.cors.origin).not.toBe('*');
  });
});
