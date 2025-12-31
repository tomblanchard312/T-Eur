import { Request, Response, NextFunction } from 'express';
import { logAuditEvent } from '../utils/logger.js';

/**
 * Middleware to log API requests for audit purposes
 */
export const auditMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  const correlationId = req.headers['x-correlation-id'] as string ||
    `api-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Add correlation ID to request for use in handlers
  (req as any).correlationId = correlationId;

  // Log the incoming request
  logAuditEvent({
    action: 'API_REQUEST_RECEIVED',
    actor: req.auth?.institutionId || 'anonymous',
    resource: 'api',
    resourceId: req.url,
    details: {
      method: req.method,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
    },
    result: 'success',
  });

  // Log the response when it's finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    logAuditEvent({
      action: 'API_REQUEST_COMPLETED',
      actor: req.auth?.institutionId || 'anonymous',
      resource: 'api',
      resourceId: req.url,
      details: {
        method: req.method,
        statusCode: res.statusCode,
        duration,
      },
      result: 'success',
    });
  });

  // Log errors
  res.on('error', (error) => {
    const duration = Date.now() - startTime;

    logAuditEvent({
      action: 'API_REQUEST_ERROR',
      actor: req.auth?.institutionId || 'anonymous',
      resource: 'api',
      resourceId: req.url,
      details: {
        method: req.method,
        error: error.message,
        duration,
      },
      result: 'failure',
      errorMessage: error.message,
    });
  });

  next();
};

/**
 * Middleware to log authentication events
 */
export const authAuditMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.auth) {
    logAuditEvent({
      action: 'AUTHENTICATION_SUCCESS',
      actor: req.auth!.institutionId,
      resource: 'auth',
      resourceId: req.url,
      details: {
        method: req.method,
      },
      result: 'success',
    });
  }

  next();
};

/**
 * Helper function to get correlation ID from request
 */
export const getCorrelationId = (req: Request): string => {
  return (req as any).correlationId || `fallback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Helper function to get user ID from request
 */
export const getUserId = (req: Request): string | undefined => {
  return req.auth?.institutionId;
};