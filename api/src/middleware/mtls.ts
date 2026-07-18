import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config/index.js';
import { AuthenticationError, AuthorizationError } from './errors.js';
import { authenticate } from './auth.js';
import { logger } from '../utils/logger.js';

const HEADER_VERIFIED = 'x-teur-mtls-verified';
const HEADER_INSTITUTION = 'x-teur-mtls-institution-id';
const HEADER_FINGERPRINT = 'x-teur-mtls-fingerprint';
const HEADER_ISSUER = 'x-teur-mtls-issuer';
const HEADER_INGRESS_TOKEN = 'x-teur-ingress-token';
const MTLS_HEADERS = [
  HEADER_VERIFIED,
  HEADER_INSTITUTION,
  HEADER_FINGERPRINT,
  HEADER_ISSUER,
  HEADER_INGRESS_TOKEN,
];

interface MtlsIdentity {
  institutionId: string;
  fingerprintSha256: string;
  issuerId: string;
  verifiedByIngress: true;
}

declare module 'express-serve-static-core' {
  interface Request {
    mtls?: MtlsIdentity;
  }
}

function singleHeader(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  if (Array.isArray(value)) return value[0];
  return value;
}

function normalizeRemoteAddress(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.startsWith('::ffff:')) return value.substring(7);
  const zoneIndex = value.indexOf('%');
  return zoneIndex >= 0 ? value.substring(0, zoneIndex) : value;
}

function ipv4ToInt(address: string): number | undefined {
  if (isIP(address) !== 4) return undefined;
  const parts = address.split('.').map(Number);
  return (((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!) >>> 0;
}

function matchesCidr(address: string, cidr: string): boolean {
  const [network, prefixText] = cidr.trim().split('/');
  if (!network) return false;

  if (prefixText === undefined) return address === normalizeRemoteAddress(network);

  const prefix = Number(prefixText);
  const addressInt = ipv4ToInt(address);
  const networkInt = ipv4ToInt(network);
  if (addressInt === undefined || networkInt === undefined || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (addressInt & mask) === (networkInt & mask);
}

function isTrustedIngress(req: Request): boolean {
  const remoteAddress = normalizeRemoteAddress(req.socket.remoteAddress);
  if (!remoteAddress) return false;
  return config.mtls.trustedIngressCidrs.some(cidr => matchesCidr(remoteAddress, cidr));
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftDigest = createHash('sha256').update(left).digest();
  const rightDigest = createHash('sha256').update(right).digest();
  return timingSafeEqual(leftDigest, rightDigest);
}

function hasAnyMtlsHeader(req: Request): boolean {
  return MTLS_HEADERS.some(header => singleHeader(req, header) !== undefined);
}

function isProtectedRoute(req: Request): boolean {
  const method = req.method.toUpperCase();
  const path = req.path;

  if (path.startsWith('/governance')) return true;
  if (path.startsWith('/audit')) return true;
  if (path.startsWith('/admin')) return method !== 'GET';
  if (path.startsWith('/payments')) return method !== 'GET';

  if (method !== 'POST') return false;
  return [
    '/transfers/mint',
    '/transfers/burn',
    '/transfers/freeze',
    '/transfers/unfreeze',
    '/transfers/escrow',
    '/transfers/release-escrow',
    '/transfers/burn-escrow',
  ].includes(path);
}

export function verifyInstitutionalMtls(req: Request, _res: Response, next: NextFunction): void {
  if (!config.mtls.enabled) {
    if (hasAnyMtlsHeader(req)) {
      return next(new AuthenticationError('mTLS identity headers are not accepted when mTLS is disabled'));
    }
    return next();
  }

  if (!isTrustedIngress(req)) {
    if (hasAnyMtlsHeader(req)) {
      logger.warn('MTLS', 'AUTHENTICATION_FAILED', {
        path: req.path,
        method: req.method,
        errorCode: 'UNTRUSTED_INGRESS_HEADERS',
      });
      return next(new AuthenticationError('Untrusted source for mTLS identity headers'));
    }
    return next(new AuthenticationError('Privileged requests must originate from the trusted ingress'));
  }

  const ingressToken = singleHeader(req, HEADER_INGRESS_TOKEN);
  if (!ingressToken || !constantTimeEquals(ingressToken, config.mtls.ingressToken)) {
    return next(new AuthenticationError('Invalid ingress authentication token'));
  }

  const verified = singleHeader(req, HEADER_VERIFIED);
  const institutionId = singleHeader(req, HEADER_INSTITUTION);
  const fingerprint = singleHeader(req, HEADER_FINGERPRINT)?.toLowerCase();
  const issuerId = singleHeader(req, HEADER_ISSUER);

  if (verified !== 'true') return next(new AuthenticationError('Client certificate was not verified'));
  if (!institutionId || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,127}$/.test(institutionId)) {
    return next(new AuthenticationError('Invalid certificate institution identity'));
  }
  if (!fingerprint || !/^[a-f0-9]{64}$/.test(fingerprint)) {
    return next(new AuthenticationError('Invalid certificate fingerprint'));
  }
  if (!issuerId || issuerId.length > 128) return next(new AuthenticationError('Invalid certificate issuer identity'));
  if (config.mtls.revokedFingerprints.includes(fingerprint)) {
    return next(new AuthenticationError('Client certificate is revoked'));
  }

  req.mtls = {
    institutionId,
    fingerprintSha256: fingerprint,
    issuerId,
    verifiedByIngress: true,
  };
  next();
}

export function bindMtlsToApplicationIdentity(req: Request, _res: Response, next: NextFunction): void {
  if (!req.mtls) return next(new AuthenticationError('Verified client certificate required'));
  if (!req.auth) return next(new AuthenticationError('Application credential required'));
  if (req.mtls.institutionId !== req.auth.institutionId) {
    logger.warn('MTLS', 'AUTHORIZATION_DENIED', {
      institutionId: req.auth.institutionId,
      path: req.path,
      method: req.method,
      errorCode: 'INSTITUTION_IDENTITY_MISMATCH',
    });
    return next(new AuthorizationError('Certificate institution does not match application credential institution'));
  }
  next();
}

export function institutionalMtlsGate(req: Request, res: Response, next: NextFunction): void {
  if (!isProtectedRoute(req)) return next();

  verifyInstitutionalMtls(req, res, error => {
    if (error) return next(error);
    authenticate(req, res, authError => {
      if (authError) return next(authError);
      bindMtlsToApplicationIdentity(req, res, next);
    });
  });
}

export const mtlsHeaders = {
  verified: HEADER_VERIFIED,
  institution: HEADER_INSTITUTION,
  fingerprint: HEADER_FINGERPRINT,
  issuer: HEADER_ISSUER,
  ingressToken: HEADER_INGRESS_TOKEN,
} as const;
