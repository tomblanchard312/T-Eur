import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ValidationError extends ApiError {
  constructor(message: string, details: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(401, 'AUTHENTICATION_ERROR', message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApiError {
  constructor(message: string = 'Insufficient permissions') {
    super(403, 'AUTHORIZATION_ERROR', message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, id?: string) {
    super(404, 'NOT_FOUND', id ? `${resource} with id ${id} not found` : `${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends ApiError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
    this.name = 'ConflictError';
  }
}

export class BlockchainError extends ApiError {
  constructor(message: string, details?: unknown) {
    super(502, 'BLOCKCHAIN_ERROR', message, details);
    this.name = 'BlockchainError';
  }
}

// Validation middleware factory
export function validate<T>(schema: ZodSchema<T>, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const data = schema.parse(req[source]);
      req[source] = data;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(new ValidationError('Request validation failed', error.errors));
      } else {
        next(error);
      }
    }
  };
}

// Global error handler
// Allow unused `_next` parameter to satisfy Express middleware signature
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Mark `_next` as used to satisfy linter while keeping signature
  void _next;
  const requestId = req.headers['x-request-id'] || 'unknown';
  
  if (err instanceof ApiError) {
    // OWASP: Security Logging and Monitoring - Log API errors with structured context
    logger.warn('API_GATEWAY', 'VALIDATION_FAILED', {
      correlationId: requestId as string,
      errorCode: err.code,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
    });

    res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        requestId,
      },
    });
    return;
  }

  // Unexpected errors
  // OWASP: Security Logging and Monitoring - Log unexpected errors without leaking sensitive info
  // Financial System Safety: Preserve full error context in secure logs for forensic analysis.
  logger.error('API_GATEWAY', 'INTERNAL_SERVER_ERROR', {
    correlationId: requestId as string,
    errorCode: 'UNEXPECTED_ERROR',
    path: req.path,
    method: req.method,
    details: {
      name: err.name,
      message: err.message,
      stack: config.nodeEnv === 'production' ? undefined : err.stack,
    },
    // Sanitized: log error name but not full stack trace in production logs
    resourceId: err.name,
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
      requestId,
    },
  });
}

// Async handler wrapper
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
