import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AuthenticationError, AuthorizationError } from './errors.js';
import { logger } from '../utils/logger.js';
import { governanceService, KeyRole, GovernanceError } from '../services/governance.js';

const MAX_API_KEYS = 1000;
const apiKeys = new Map<string, ApiKeyRecord>();

interface ApiKeyRecord {
  keyId: string;
  institutionId: string;
  institutionName: string;
  roles: string[];
  permissions: string[];
  rateLimit: number;
  isActive: boolean;
  createdAt: Date;
}

interface JwtPayload {
  sub: string;
  institutionId: string;
  roles: string[];
  permissions: string[];
  keyId?: string;
  iat: number;
  exp: number;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: {
      institutionId: string;
      institutionName: string;
      roles: string[];
      permissions: string[];
      keyId?: string;
    };
  }
}

function mapToGovernanceRole(role: string): KeyRole {
  switch (role) {
    case 'ECB_ADMIN': return KeyRole.ISSUING;
    case 'NCB_OPERATOR': return KeyRole.OPERATIONAL;
    case 'BANK_OPERATOR':
    case 'PSP_OPERATOR': return KeyRole.PARTICIPANT;
    default: return KeyRole.WALLET;
  }
}

function initDemoKeys() {
  if (!config.allowDemoIdentities) return;

  const demoKeys: ApiKeyRecord[] = [
    {
      keyId: 'demo-ecb-key',
      institutionId: 'ecb-core',
      institutionName: 'European Central Bank',
      roles: ['ECB_ADMIN'],
      permissions: ['*'],
      rateLimit: 10000,
      isActive: true,
      createdAt: new Date(),
    },
    {
      keyId: 'demo-ncb-de-key',
      institutionId: 'ncb-de',
      institutionName: 'Deutsche Bundesbank',
      roles: ['NCB_OPERATOR'],
      permissions: ['mint', 'burn', 'waterfall', 'read'],
      rateLimit: 5000,
      isActive: true,
      createdAt: new Date(),
    },
    {
      keyId: 'demo-bank-key',
      institutionId: 'bank-de-01',
      institutionName: 'Deutsche Bank AG',
      roles: ['BANK_OPERATOR'],
      permissions: ['transfer', 'waterfall', 'conditional_payments', 'read'],
      rateLimit: 1000,
      isActive: true,
      createdAt: new Date(),
    },
    {
      keyId: 'demo-psp-key',
      institutionId: 'psp-eu-01',
      institutionName: 'European Payment Services',
      roles: ['PSP_OPERATOR'],
      permissions: ['register_wallet', 'read'],
      rateLimit: 2000,
      isActive: true,
      createdAt: new Date(),
    },
  ];

  for (const key of demoKeys) {
    if (apiKeys.size >= MAX_API_KEYS) {
      logger.error('AUTH_MIDDLEWARE', 'INTERNAL_SERVER_ERROR', {
        resourceId: key.keyId,
        errorCode: 'API_KEY_LIMIT_EXCEEDED',
      });
      break;
    }

    apiKeys.set(key.keyId, key);
    try {
      governanceService.registerKey({
        keyId: key.keyId,
        publicKey: `0xPUB_${key.keyId}`,
        role: mapToGovernanceRole(key.roles[0]!),
        ownerId: key.institutionId,
        expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000),
      }, 'ecb-root-01');
    } catch (error) {
      logger.warn('AUTH_MIDDLEWARE', 'RESOURCE_UPDATED', {
        resourceId: key.keyId,
        errorCode: 'DEMO_GOVERNANCE_KEY_NOT_REGISTERED',
        details: { error: error instanceof Error ? error.name : 'unknown' },
      });
    }
  }

  logger.warn('AUTH_MIDDLEWARE', 'RESOURCE_CREATED', {
    count: Math.min(demoKeys.length, MAX_API_KEYS),
    details: { mode: 'demo-identities-enabled' },
  });
}

initDemoKeys();

export function apiKeyAuth(req: Request, _res: Response, next: NextFunction) {
  const headerValue = req.headers[config.auth.apiKeyHeader.toLowerCase()];
  const apiKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;

  if (!apiKey) return next(new AuthenticationError('API key required'));

  const keyRecord = apiKeys.get(apiKey);
  if (!keyRecord) {
    logger.warn('AUTH_MIDDLEWARE', 'AUTHENTICATION_FAILED', {
      path: req.path,
      method: req.method,
      resourceId: apiKey.substring(0, 8),
    });
    return next(new AuthenticationError('Invalid API key'));
  }

  if (!keyRecord.isActive) return next(new AuthenticationError('API key is inactive'));

  req.auth = {
    institutionId: keyRecord.institutionId,
    institutionName: keyRecord.institutionName,
    roles: [...keyRecord.roles],
    permissions: [...keyRecord.permissions],
    keyId: keyRecord.keyId,
  };
  next();
}

export function jwtAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AuthenticationError('Bearer token required'));
  }

  const token = authHeader.substring(7);
  try {
    const payload = jwt.verify(token, config.auth.jwtSecret, {
      algorithms: ['HS256'],
      issuer: config.auth.jwtIssuer,
      audience: config.auth.jwtAudience,
    }) as JwtPayload;

    if (!payload.sub || !payload.institutionId || !Array.isArray(payload.roles) || !Array.isArray(payload.permissions)) {
      return next(new AuthenticationError('Invalid token claims'));
    }

    req.auth = {
      institutionId: payload.institutionId,
      institutionName: payload.sub,
      roles: [...payload.roles],
      permissions: [...payload.permissions],
      keyId: payload.keyId,
    };
    next();
  } catch (error) {
    logger.warn('AUTH_MIDDLEWARE', 'AUTHENTICATION_FAILED', {
      path: req.path,
      method: req.method,
      errorCode: error instanceof jwt.TokenExpiredError ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
    });
    return next(new AuthenticationError(error instanceof jwt.TokenExpiredError ? 'Token expired' : 'Invalid token'));
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction) {
  const hasApiKey = Boolean(req.headers[config.auth.apiKeyHeader.toLowerCase()]);
  const hasBearer = req.headers.authorization?.startsWith('Bearer ');

  if (hasApiKey) return apiKeyAuth(req, res, next);
  if (hasBearer) return jwtAuth(req, res, next);
  return next(new AuthenticationError('Authentication required (API key or Bearer token)'));
}

export function validateKeyRole(requiredRole: KeyRole) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth?.keyId) {
      return next(new AuthenticationError('Key ID required for governance validation'));
    }

    try {
      governanceService.validateKeyUsage(req.auth.keyId, requiredRole);
      next();
    } catch (error) {
      if (error instanceof GovernanceError) {
        logger.warn('AUTH_MIDDLEWARE', 'KEY_VALIDATION_FAILED', {
          keyId: req.auth.keyId.substring(0, 8),
          requiredRole,
          errorCode: error.code,
        });
        return next(new AuthorizationError(error.message));
      }
      next(error);
    }
  };
}

export function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new AuthenticationError());

    const hasWildcard = req.auth.permissions.includes('*');
    const hasPermission = hasWildcard || requiredPermissions.every(
      permission => req.auth!.permissions.includes(permission),
    );

    if (!hasPermission) {
      logger.warn('API_GATEWAY', 'AUTHORIZATION_DENIED', {
        institutionId: req.auth.institutionId,
        details: {
          required: requiredPermissions.join(','),
          actual: req.auth.permissions.join(','),
        },
        path: req.path,
      });
      return next(new AuthorizationError(`Required permissions: ${requiredPermissions.join(', ')}`));
    }
    next();
  };
}

export function requireRole(...requiredRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new AuthenticationError());
    if (!requiredRoles.some(role => req.auth!.roles.includes(role))) {
      return next(new AuthorizationError(`Required roles: ${requiredRoles.join(' or ')}`));
    }
    next();
  };
}

export function generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, config.auth.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: config.auth.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    issuer: config.auth.jwtIssuer,
    audience: config.auth.jwtAudience,
  });
}
