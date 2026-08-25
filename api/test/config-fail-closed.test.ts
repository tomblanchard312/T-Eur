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
    'MTLS_ENABLED',
    'MTLS_TRUSTED_INGRESS_CIDRS',
    'MTLS_INGRESS_TOKEN',
    'SIGNER_BACKEND',
    'SIGNER_KMS_KEY_ID',
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
    // Institutional mTLS is mandatory outside development/test, and enabling it
    // requires a trusted ingress range plus a >=32 character ingress token.
    process.env.MTLS_TRUSTED_INGRESS_CIDRS = '10.0.0.0/8';
    process.env.MTLS_INGRESS_TOKEN = 'x'.repeat(32);
    // Production defaults to the KMS signer backend, which needs a key id.
    process.env.SIGNER_KMS_KEY_ID = 'arn:aws:kms:eu-central-1:000000000000:key/test';

    const { config } = await import('../src/config/index.js');
    expect(config.nodeEnv).toBe('production');
    expect(config.allowDemoIdentities).toBe(false);
    expect(config.cors.origin).not.toBe('*');
    expect(config.mtls.enabled).toBe(true);
    expect(config.blockchain.signerBackend).toBe('kms');
  });

  it('rejects raw key material in production', async () => {
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
    process.env.MTLS_TRUSTED_INGRESS_CIDRS = '10.0.0.0/8';
    process.env.MTLS_INGRESS_TOKEN = 'x'.repeat(32);
    process.env.SIGNER_BACKEND = 'env';

    await expect(import('../src/config/index.js')).rejects.toThrow('Invalid configuration');
  });

  it('treats the string "false" as false, not as a truthy string', async () => {
    // z.coerce.boolean() is Boolean(value), so "false" parsed as true and every
    // documented way of disabling a control switched it on instead.
    process.env.NODE_ENV = 'test';
    process.env.CORS_CREDENTIALS = 'false';
    process.env.ENABLE_API_DOCS = 'false';
    process.env.ALLOW_DEMO_IDENTITIES = 'false';

    const { config } = await import('../src/config/index.js');
    expect(config.cors.credentials).toBe(false);
    expect(config.enableApiDocs).toBe(false);
    expect(config.allowDemoIdentities).toBe(false);
  });

  it('rejects production when mTLS is enabled without a trusted ingress range', async () => {
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
    process.env.MTLS_INGRESS_TOKEN = 'x'.repeat(32);

    await expect(import('../src/config/index.js')).rejects.toThrow('Invalid configuration');
  });
});
