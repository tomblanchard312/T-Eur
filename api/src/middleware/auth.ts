import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AuthenticationError, AuthorizationError } from './errors.js';
import { logger } from '../utils/logger.js';

// Simulated API key store (in production, use database)
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
    };
  }
}

// Initialize demo API keys for development
function initDemoKeys() {
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

  demoKeys.forEach(key => apiKeys.set(key.keyId, key));
  logger.info('Initialized demo API keys', { count: demoKeys.length });
}

initDemoKeys();

// API Key authentication
export function apiKeyAuth(req: Request, _res: Response, next: NextFunction) {
  const apiKey = req.headers[config.auth.apiKeyHeader.toLowerCase()] as string;
  
  if (!apiKey) {
    return next(new AuthenticationError('API key required'));
  }

  const keyRecord = apiKeys.get(apiKey);
  
  if (!keyRecord) {
    logger.warn('Invalid API key attempt', { 
      ip: req.ip, 
      path: req.path,
      keyPrefix: apiKey.substring(0, 8),
    });
    return next(new AuthenticationError('Invalid API key'));
  }

  if (!keyRecord.isActive) {
    return next(new AuthenticationError('API key is inactive'));
  }

  req.auth = {
    institutionId: keyRecord.institutionId,
    institutionName: keyRecord.institutionName,
    roles: keyRecord.roles,
    permissions: keyRecord.permissions,
  };

  next();
}

// JWT authentication (for session-based access)
export function jwtAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AuthenticationError('Bearer token required'));
  }

  const token = authHeader.substring(7);

  try {
    const payload = jwt.verify(token, config.auth.jwtSecret) as JwtPayload;
    
    req.auth = {
      institutionId: payload.institutionId,
      institutionName: payload.sub,
      roles: payload.roles,
      permissions: payload.permissions,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AuthenticationError('Token expired'));
    }
    return next(new AuthenticationError('Invalid token'));
  }
}

// Combined auth (API key or JWT)
export function authenticate(req: Request, res: Response, next: NextFunction) {
  const hasApiKey = !!req.headers[config.auth.apiKeyHeader.toLowerCase()];
  const hasBearer = req.headers.authorization?.startsWith('Bearer ');

  if (hasApiKey) {
    return apiKeyAuth(req, res, next);
  } else if (hasBearer) {
    return jwtAuth(req, res, next);
  } else {
    return next(new AuthenticationError('Authentication required (API key or Bearer token)'));
  }
}

// Permission check middleware
export function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      return next(new AuthenticationError());
    }

    const hasWildcard = req.auth.permissions.includes('*');
    const hasPermission = hasWildcard || requiredPermissions.every(
      perm => req.auth!.permissions.includes(perm)
    );

    if (!hasPermission) {
      logger.warn('Permission denied', {
        institutionId: req.auth.institutionId,
        required: requiredPermissions,
        actual: req.auth.permissions,
        path: req.path,
      });
      return next(new AuthorizationError(
        `Required permissions: ${requiredPermissions.join(', ')}`
      ));
    }

    next();
  };
}

// Role check middleware
export function requireRole(...requiredRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) {
      return next(new AuthenticationError());
    }

    const hasRole = requiredRoles.some(role => req.auth!.roles.includes(role));

    if (!hasRole) {
      return next(new AuthorizationError(
        `Required roles: ${requiredRoles.join(' or ')}`
      ));
    }

    next();
  };
}

// Generate JWT for authenticated session
export function generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  // @ts-expect-error - expiresIn type is compatible at runtime
  return jwt.sign(payload, config.auth.jwtSecret, { expiresIn: config.auth.jwtExpiresIn });
}
