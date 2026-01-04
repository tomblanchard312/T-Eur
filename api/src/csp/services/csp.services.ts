import { AuditEvent, OperatorIdentity } from '../types';
import winston from 'winston';
import { Request } from 'express';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'csp-audit' },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/csp-audit.log' })
  ],
});

export class AuditService {
  static emit(event: AuditEvent) {
    logger.info('AUDIT_EVENT', event);
  }

  static createBaseEvent(req: Request, identity: OperatorIdentity, actionType: string): Partial<AuditEvent> {
    return {
      timestamp: new Date().toISOString(),
      actor: {
        id: identity.id,
        role: identity.role,
        cn: identity.cn,
      },
      action: {
        type: actionType,
        stage: 'requested',
      },
      context: {
        correlationId: req.header('X-Correlation-Id') || 'unknown',
        requestId: req.header('X-Request-Id') || 'unknown',
        ip: req.ip || 'unknown',
      },
    };
  }
}

export class IdempotencyService {
  private static store = new Map<string, { status: number; body: any; timestamp: number }>();
  private static RETENTION_MS = 24 * 60 * 60 * 1000; // 24 hours

  static check(requestId: string) {
    const cached = this.store.get(requestId);
    if (cached && (Date.now() - cached.timestamp < this.RETENTION_MS)) {
      return cached;
    }
    return null;
  }

  static save(requestId: string, status: number, body: any) {
    this.store.set(requestId, { status, body, timestamp: Date.now() });
  }
}
