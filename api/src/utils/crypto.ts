import crypto from 'crypto';

/**
 * Generate a secure, unique correlation ID for tracking operations across services.
 * Uses cryptographically secure random UUIDs.
 */
export function generateCorrelationId(prefix?: string): string {
  const uuid = crypto.randomUUID();
  return prefix ? `${prefix}-${uuid}` : uuid;
}
