import rateLimit from 'express-rate-limit';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

// Request ID middleware
export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers['x-request-id'] as string) || uuidv4();
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-Id', id);
  next();
}

// Request logging middleware
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();
  const requestId = req.headers['x-request-id'];

  // Log request
  logger.info('Incoming request', {
    requestId,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    institutionId: req.auth?.institutionId,
  });

  // Log response on finish
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel]('Request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      institutionId: req.auth?.institutionId,
    });
  });

  next();
}

// Standard rate limiter
export const standardRateLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Rate limit by institution if authenticated, otherwise by IP
    return req.auth?.institutionId || req.ip || 'unknown';
  },
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        retryAfter: Math.ceil(config.rateLimit.windowMs / 1000),
      },
    });
  },
});

// Strict rate limiter for sensitive operations
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.auth?.institutionId || req.ip || 'unknown',
  handler: (_req, res) => {
    res.status(429).json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded for sensitive operation',
        retryAfter: 60,
      },
    });
  },
});

// Idempotency key tracking (in production, use Redis or database)
const idempotencyStore = new Map<string, { response: unknown; timestamp: number }>();

// Clean up old idempotency keys every hour
setInterval(() => {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [key, value] of idempotencyStore) {
    if (value.timestamp < oneHourAgo) {
      idempotencyStore.delete(key);
    }
  }
}, 60 * 60 * 1000);

export function idempotency(req: Request, res: Response, next: NextFunction) {
  // Only apply to POST/PUT/PATCH requests
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return next();
  }

  const idempotencyKey = req.body?.idempotencyKey;
  if (!idempotencyKey) {
    return next();
  }

  const cacheKey = `${req.auth?.institutionId || 'anon'}:${req.path}:${idempotencyKey}`;
  const cached = idempotencyStore.get(cacheKey);

  if (cached) {
    logger.info('Returning cached idempotent response', {
      requestId: req.headers['x-request-id'],
      idempotencyKey,
    });
    res.setHeader('X-Idempotency-Replayed', 'true');
    res.json(cached.response);
    return;
  }

  // Store original json method
  const originalJson = res.json.bind(res);
  
  // Override json to cache response
  res.json = (body: unknown) => {
    // Only cache successful responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      idempotencyStore.set(cacheKey, {
        response: body,
        timestamp: Date.now(),
      });
    }
    return originalJson(body);
  };

  next();
}
