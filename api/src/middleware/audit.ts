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
  logAuditEvent('API_REQUEST_RECEIVED', {
    correlationId,
    userId: req.auth?.institutionId,
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    timestamp: new Date().toISOString(),
  });

  // Log the response when it's finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;

    logAuditEvent('API_REQUEST_COMPLETED', {
      correlationId,
      userId: req.auth?.institutionId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      timestamp: new Date().toISOString(),
    });
  });

  // Log errors
  res.on('error', (error) => {
    const duration = Date.now() - startTime;

    logAuditEvent('API_REQUEST_ERROR', {
      correlationId,
      userId: req.auth?.institutionId,
      method: req.method,
      url: req.url,
      error: error.message,
      duration,
      timestamp: new Date().toISOString(),
    });
  });

  next();
};

/**
 * Middleware to log authentication events
 */
export const authAuditMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.auth) {
    logAuditEvent('AUTHENTICATION_SUCCESS', {
      correlationId: (req as any).correlationId,
      userId: req.auth.institutionId,
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString(),
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