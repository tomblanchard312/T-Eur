import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { AuthenticationError, AuthorizationError } from './errors.js';
import { logger } from '../utils/logger.js';
import { governanceService, KeyRole, GovernanceError, KeyStatus } from '../services/governance.js';

// Simulated API key store (in production, use database)
// Resource management: explicit bound for in-memory key store to prevent DoS
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

// Initialize demo API keys for development
function initDemoKeys() {
  // Security: Never initialize demo keys in production
  if (config.nodeEnv === 'production') {
    return;
  }

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

  demoKeys.forEach(key => {
    if (apiKeys.size < MAX_API_KEYS) {
      apiKeys.set(key.keyId, key);
      
      // Also register in Governance Service for unified enforcement
      try {
        governanceService.registerKey({
          keyId: key.keyId,
          publicKey: `0xPUB_${key.keyId}`,
          role: mapToGovernanceRole(key.roles[0]!),
          ownerId: key.institutionId,
          expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000),
        }, 'ecb-root-01');
      } catch (e) {
        // Ignore if already registered
      }
    } else {
      // OWASP: Security Logging and Monitoring - Log resource limit issues
      logger.error('AUTH_MIDDLEWARE', 'INTERNAL_SERVER_ERROR', { 
        resourceId: key.keyId, 
        errorCode: 'API_KEY_LIMIT_EXCEEDED' 
      });
    }
  });
  logger.info('AUTH_MIDDLEWARE', 'RESOURCE_CREATED', { 
    count: Math.min(demoKeys.length, MAX_API_KEYS) 
  });
}

function mapToGovernanceRole(role: string): KeyRole {
  switch (role) {
    case 'ECB_ADMIN': return KeyRole.ISSUING;
    case 'NCB_OPERATOR': return KeyRole.OPERATIONAL;
    case 'BANK_OPERATOR': return KeyRole.PARTICIPANT;
    case 'PSP_OPERATOR': return KeyRole.PARTICIPANT;
    default: return KeyRole.WALLET;
  }
}

initDemoKeys();

// API Key authentication
export function apiKeyAuth(req: Request, _res: Response, next: NextFunction) {
  // OWASP: Broken Authentication - Use secure header for API keys
  const apiKey = req.headers[config.auth.apiKeyHeader.toLowerCase()] as string;
  
  if (!apiKey) {
    return next(new AuthenticationError('API key required'));
  }

  // OWASP: Broken Authentication - Constant-time lookup via Map
  const keyRecord = apiKeys.get(apiKey);
  
  if (!keyRecord) {
    // OWASP: Security Logging and Monitoring - Log failed auth attempts
    logger.warn('AUTH_MIDDLEWARE', 'AUTHENTICATION_FAILED', { 
      path: req.path,
      method: req.method,
      // Only log prefix to avoid leaking full key in logs
      resourceId: apiKey.substring(0, 8),
    });
    return next(new AuthenticationError('Invalid API key'));
  }

  if (!keyRecord.isActive) {
    return next(new AuthenticationError('API key is inactive'));
  }

  // OWASP: Broken Access Control - Populate auth context for downstream checks
  req.auth = {
    institutionId: keyRecord.institutionId,
    institutionName: keyRecord.institutionName,
    roles: keyRecord.roles,
    permissions: keyRecord.permissions,
    keyId: keyRecord.keyId,
  };

  next();
}

// JWT authentication (for session-based access)
export function jwtAuth(req: Request, _res: Response, next: NextFunction) {
  // OWASP: Broken Authentication - Use standard Bearer token
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new AuthenticationError('Bearer token required'));
  }

  const token = authHeader.substring(7);

  try {
    // OWASP: Sensitive Data Exposure - Verify JWT with strong secret
    const payload = jwt.verify(token, config.auth.jwtSecret) as JwtPayload;
    
    req.auth = {
      institutionId: payload.institutionId,
      institutionName: payload.sub,
      roles: payload.roles,
      permissions: payload.permissions,
    };

    next();
  } catch (error) {
    // OWASP: Security Logging and Monitoring - Log JWT failures
    logger.warn('AUTH_MIDDLEWARE', 'AUTHENTICATION_FAILED', { 
      path: req.path,
      method: req.method,
      errorCode: error instanceof jwt.TokenExpiredError ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN'
    });
    
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

/**
 * ECB-grade Governance: Validate Key Role
 * 
 * Enforces that the key used for the request is bound to the required role
 * in the sovereign key hierarchy.
 */
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
          errorCode: error.code
        });
        return next(new AuthorizationError(error.message));
      }
      next(error);
    }
  };
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
      logger.warn('API_GATEWAY', 'AUTHORIZATION_DENIED', {
        institutionId: req.auth.institutionId,
        details: {
          required: requiredPermissions.join(','),
          actual: req.auth.permissions.join(','),
        },
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

