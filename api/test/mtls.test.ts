import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

const validFingerprint = 'a'.repeat(64);
const revokedFingerprint = 'b'.repeat(64);

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.MTLS_ENABLED = 'true';
  process.env.MTLS_TRUSTED_INGRESS_CIDRS = '127.0.0.1/32,10.40.0.0/16';
  process.env.MTLS_INGRESS_TOKEN = 'test-ingress-token-that-is-at-least-32-characters';
  process.env.MTLS_REVOKED_FINGERPRINTS = revokedFingerprint;
  process.env.ALLOW_DEMO_IDENTITIES = 'true';
});

function request(overrides: Partial<Request> = {}): Request {
  return {
    method: 'POST',
    path: '/transfers/mint',
    originalUrl: '/api/v1/transfers/mint',
    headers: {
      'x-api-key': 'demo-bank-key',
      'x-teur-mtls-verified': 'true',
      'x-teur-mtls-institution-id': 'bank-de-01',
      'x-teur-mtls-fingerprint': validFingerprint,
      'x-teur-mtls-issuer': 'teur-institutional-ca-01',
      'x-teur-ingress-token': 'test-ingress-token-that-is-at-least-32-characters',
    },
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides,
  } as unknown as Request;
}

function invoke(
  middleware: (req: Request, res: Response, next: NextFunction) => void,
  req: Request,
): Promise<unknown> {
  return new Promise(resolve => {
    middleware(req, {} as Response, (error?: unknown) => resolve(error));
  });
}

describe('institutional mTLS', () => {
  it('accepts a verified certificate from a trusted ingress when institutions match', async () => {
    vi.resetModules();
    const { institutionalMtlsGate } = await import('../src/middleware/mtls.js');
    const req = request();

    const error = await invoke(institutionalMtlsGate, req);

    expect(error).toBeUndefined();
    expect(req.auth?.institutionId).toBe('bank-de-01');
    expect(req.mtls).toEqual({
      institutionId: 'bank-de-01',
      fingerprintSha256: validFingerprint,
      issuerId: 'teur-institutional-ca-01',
      verifiedByIngress: true,
    });
  });

  it('rejects certificate headers sent from an untrusted source', async () => {
    vi.resetModules();
    const { institutionalMtlsGate } = await import('../src/middleware/mtls.js');
    const req = request({ socket: { remoteAddress: '203.0.113.10' } as Request['socket'] });

    const error = await invoke(institutionalMtlsGate, req);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('Untrusted source');
  });

  it('rejects a revoked certificate fingerprint', async () => {
    vi.resetModules();
    const { institutionalMtlsGate } = await import('../src/middleware/mtls.js');
    const req = request({
      headers: {
        ...request().headers,
        'x-teur-mtls-fingerprint': revokedFingerprint,
      },
    });

    const error = await invoke(institutionalMtlsGate, req);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('revoked');
  });

  it('rejects a certificate institution that differs from the application credential', async () => {
    vi.resetModules();
    const { institutionalMtlsGate } = await import('../src/middleware/mtls.js');
    const req = request({
      headers: {
        ...request().headers,
        'x-teur-mtls-institution-id': 'different-bank',
      },
    });

    const error = await invoke(institutionalMtlsGate, req);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain('does not match');
  });

  it('rejects protected requests without verified certificate metadata', async () => {
    vi.resetModules();
    const { institutionalMtlsGate } = await import('../src/middleware/mtls.js');
    const req = request({ headers: { 'x-api-key': 'demo-bank-key' } });

    const error = await invoke(institutionalMtlsGate, req);

    expect(error).toBeInstanceOf(Error);
  });

  it('does not require mTLS for ordinary wallet transfers', async () => {
    vi.resetModules();
    const { institutionalMtlsGate } = await import('../src/middleware/mtls.js');
    const req = request({ path: '/transfers', originalUrl: '/api/v1/transfers', headers: {} });

    const error = await invoke(institutionalMtlsGate, req);

    expect(error).toBeUndefined();
  });
});
