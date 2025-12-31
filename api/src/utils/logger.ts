import winston from 'winston';
import { config } from '../config/index.js';

const { combine, timestamp, printf, colorize, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  printf(({ level, message, timestamp, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

const prodFormat = combine(
  timestamp(),
  json()
);

export const logger = winston.createLogger({
  level: config.logLevel,
  format: config.nodeEnv === 'production' ? prodFormat : devFormat,
  defaultMeta: { service: 'teur-api-gateway' },
  transports: [
    new winston.transports.Console(),
    // In production, add file or external logging
    ...(config.nodeEnv === 'production' ? [
      new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
      new winston.transports.File({ filename: 'logs/combined.log' }),
    ] : []),
  ],
});

// Audit logger for regulatory compliance
export const auditLogger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp(),
    json()
  ),
  defaultMeta: { type: 'audit' },
  transports: [
    new winston.transports.File({ filename: 'logs/audit.log' }),
    new winston.transports.Console({ level: 'debug' }),
  ],
});

export function logAuditEvent(
  event: {
    action: string;
    actor: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    result: 'success' | 'failure';
    errorMessage?: string;
  },
  extra?: Record<string, unknown>
) {
  auditLogger.info('Audit event', {
    ...event,
    ...(extra || {}),
    timestamp: new Date().toISOString(),
  });
}
