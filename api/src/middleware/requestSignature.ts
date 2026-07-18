import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { config } from '../config/index.js';
import { AuthenticationError } from './errors.js';
import { logger } from '../utils/logger.js';

const TIMESTAMP_HEADER = 'x-teur-timestamp';
const NONCE_HEADER = 'x-teur-nonce';
const SIGNATURE_HEADER = 'x-teur-signature';
const MAX_NONCES = 10_000;
const usedNonces = new Map<string, number>();

function firstHeader(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function signingEnabled(): boolean {
  const configured = process.env['REQUIRE_HMAC_SIGNATURES'];
  if (configured !== undefined) return configured.toLowerCase() === 'true';
  return config.nodeEnv === 'staging' || config.nodeEnv === 'production';
}

function maxSkewMilliseconds(): number {
  const value = Number(process.env['HMAC_MAX_SKEW_SECONDS'] ?? 300);
  return Number.isFinite(value) && value > 0 ? Math.min(value, 900) * 1000 : 300_000;
}

function signingSecret(): string | undefined {
  return process.env['HMAC_SHARED_SECRET'];
}

function cleanExpiredNonces(now: number): void {
  for (const [key, expiresAt] of usedNonces) {
    if (expiresAt <= now) usedNonces.delete(key);
  }

  while (usedNonces.size > MAX_NONCES) {
    const oldest = usedNonces.keys().next().value as string | undefined;
    if (!oldest) break;
    usedNonces.delete(oldest);
  }
}

function bodyDigest(req: Request): string {
  const rawBody = req.rawBody ?? Buffer.alloc(0);
  return createHash('sha256').update(rawBody).digest('hex');
}

export function requestSignature(req: Request, _res: Response, next: NextFunction) {
  if (!signingEnabled()) return next();
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
  if (req.headers.authorization?.startsWith('Bearer ')) return next();

  const secret = signingSecret();
  if (!secret || secret.length < 32) {
    logger.error('AUTH_MIDDLEWARE', 'INTERNAL_SERVER_ERROR', {
      errorCode: 'HMAC_SECRET_NOT_CONFIGURED',
    });
    return next(new AuthenticationError('Request signing is unavailable'));
  }

  const keyIdHeader = config.auth.apiKeyHeader.toLowerCase();
  const keyId = firstHeader(req, keyIdHeader);
  const timestamp = firstHeader(req, TIMESTAMP_HEADER);
  const nonce = firstHeader(req, NONCE_HEADER);
  const suppliedSignature = firstHeader(req, SIGNATURE_HEADER);

  if (!keyId || !timestamp || !nonce || !suppliedSignature) {
    return next(new AuthenticationError('Signed API requests require key, timestamp, nonce, and signature headers'));
  }

  if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce) || !/^v1=[a-fA-F0-9]{64}$/.test(suppliedSignature)) {
    return next(new AuthenticationError('Invalid request signature format'));
  }

  const timestampMs = Number(timestamp);
  const now = Date.now();
  const maxSkew = maxSkewMilliseconds();
  if (!Number.isFinite(timestampMs) || Math.abs(now - timestampMs) > maxSkew) {
    return next(new AuthenticationError('Request signature timestamp is outside the allowed window'));
  }

  cleanExpiredNonces(now);
  const nonceKey = `${keyId}:${nonce}`;
  if (usedNonces.has(nonceKey)) {
    return next(new AuthenticationError('Request signature nonce has already been used'));
  }

  const canonical = [
    'v1',
    keyId,
    timestamp,
    nonce,
    req.method.toUpperCase(),
    req.originalUrl,
    bodyDigest(req),
  ].join('\n');

  const expected = createHmac('sha256', secret).update(canonical).digest();
  const supplied = Buffer.from(suppliedSignature.substring(3), 'hex');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    logger.warn('AUTH_MIDDLEWARE', 'AUTHENTICATION_FAILED', {
      errorCode: 'INVALID_HMAC_SIGNATURE',
      path: req.path,
      method: req.method,
      resourceId: keyId.substring(0, 8),
    });
    return next(new AuthenticationError('Invalid request signature'));
  }

  usedNonces.set(nonceKey, now + maxSkew);
  next();
}

declare module 'express-serve-static-core' {
  interface Request {
    rawBody?: Buffer;
  }
}
