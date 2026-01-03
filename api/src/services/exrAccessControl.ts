import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger.js';

/**
 * Guardrails for EXR data access.
 *
 * Rules:
 * - EXR data is advisory only. It must not be used for transaction pricing or settlement.
 * - Only modules/components with purpose `reporting` or `analytics` are allowed access.
 * - Any access attempt from `settlement` or `authorization` (or unspecified) will fail-fast,
 *   be logged explicitly, and throw an `ExrAccessError`.
 *
 * Rationale:
 * - ECB reference rates are published for information purposes only and must not be used for
 *   transaction pricing or settlement. Allowing those values into settlement/authorization
 *   code paths risks financial instability and auditability gaps.
 */

export type ExrPurpose = 'reporting' | 'analytics' | 'settlement' | 'authorization' | 'other';

export class ExrAccessError extends Error {
  public readonly code = 'EXR_ACCESS_DENIED';
  constructor(message: string) {
    super(message);
    this.name = 'ExrAccessError';
  }
}

const ALLOWED_PURPOSES: Set<ExrPurpose> = new Set(['reporting', 'analytics']);

/**
 * Verify access purpose. Throws ExrAccessError if not allowed.
 */
export function verifyExrAccess(purpose: ExrPurpose, caller?: string): void {
  if (ALLOWED_PURPOSES.has(purpose)) return;

  const msg = `EXR access denied for purpose="${purpose}"${caller ? ` caller="${caller}"` : ''}. ` +
    'ECB reference rates are published for information purposes only and must not be used for transaction pricing or settlement.';
  // Explicitly log the denial for audit trails
  // OWASP: Security Logging and Monitoring - Log authorization failures
  logger.error('EXR_SERVICE', 'AUTHORIZATION_DENIED', { 
    purpose, 
    caller, 
    errorCode: 'EXR_ACCESS_DENIED' 
  });
  throw new ExrAccessError(msg);
}

interface ExrObservation {
  period: string;
  rate_decimal: string;
}

interface NormalizedExr {
  series_id: string;
  observations: ExrObservation[];
  advisory: boolean;
  advisory_note: string;
  [key: string]: unknown;
}

/**
 * Read the last line of a file efficiently without loading the whole file into memory.
 * This is critical for production-grade systems to avoid DoS via large files.
 * Uses a fixed-size buffer to ensure bounded memory usage.
 */
async function readLastLine(filePath: string): Promise<string | null> {
  let handle: fs.promises.FileHandle | null = null;
  try {
    const stats = await fs.promises.stat(filePath);
    if (stats.size === 0) return null;

    handle = await fs.promises.open(filePath, 'r');
    // Read the last 4KB of the file. Most EXR JSONL lines are < 1KB.
    const bufferSize = Math.min(stats.size, 4096);
    const buffer = Buffer.alloc(bufferSize);
    
    const { bytesRead } = await handle.read(buffer, 0, bufferSize, stats.size - bufferSize);
    const content = buffer.toString('utf8', 0, bytesRead);
    
    const lines = content.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return null;
    
    return lines[lines.length - 1] ?? null;
  } catch (error) {
    // OWASP: Security Logging and Monitoring - Log file operation failures
    logger.error('EXR_SERVICE', 'FILE_OPERATION_FAILED', { 
      path: filePath, 
      errorCode: String(error) 
    });
    return null;
  } finally {
    if (handle) {
      await handle.close().catch(err => logger.error('EXR_SERVICE', 'FILE_OPERATION_FAILED', { 
        path: filePath, 
        errorCode: String(err) 
      }));
    }
  }
}

/**
 * Read the normalized EXR JSONL file for a given seriesId from mirror directory.
 * Returns the latest normalized object found. Values are returned as decimal strings
 * (not native numbers) to avoid accidental numeric consumption in transactional flows.
 *
 * Note: This function enforces access control via `purpose` and will throw for disallowed callers.
 */
export async function getNormalizedExrForPurpose(opts: {
  seriesId: string;
  mirrorDir: string; // directory where ingestion writes jsonl files
  purpose: ExrPurpose;
  caller?: string; // optional identifier for logging/audit
}): Promise<NormalizedExr | null> {
  verifyExrAccess(opts.purpose, opts.caller);

  // Strict sanitization of seriesId to prevent path traversal and injection
  if (!/^[a-zA-Z0-9._-]+$/.test(opts.seriesId)) {
    // OWASP: Injection - Log validation failures
    logger.error('EXR_SERVICE', 'VALIDATION_FAILED', { 
      seriesId: opts.seriesId, 
      caller: opts.caller 
    });
    throw new ExrAccessError(`Invalid seriesId format: ${opts.seriesId}`);
  }

  const fileName = `${opts.seriesId}.jsonl`;
  const filePath = path.join(opts.mirrorDir, fileName);

  // Security: Ensure the resolved path is still within the mirror directory
  const resolvedPath = path.resolve(filePath);
  const resolvedMirrorDir = path.resolve(opts.mirrorDir);
  if (!resolvedPath.startsWith(resolvedMirrorDir)) {
    // OWASP: Security Logging and Monitoring - Log security alerts
    logger.error('EXR_SERVICE', 'SECURITY_ALERT', { 
      seriesId: opts.seriesId, 
      path: filePath, 
      caller: opts.caller 
    });
    throw new ExrAccessError('Invalid EXR file path');
  }

  try {
    const lastLine = await readLastLine(resolvedPath);
    if (!lastLine) {
      logger.warn('EXR_SERVICE', 'FILE_OPERATION_FAILED', { 
        seriesId: opts.seriesId, 
        path: filePath 
      });
      return null;
    }

    const last = JSON.parse(lastLine);
    
    // Enforce advisory metadata
    const result: NormalizedExr = {
      ...last,
      advisory: true,
      advisory_note: 'ECB reference rates are published for information purposes only and must not be used for transaction pricing or settlement.',
      series_id: String(last.series_id || opts.seriesId),
      observations: []
    };

    // Guarantee we do not coerce rates into native numbers here to prevent precision loss or accidental use in math
    if (Array.isArray(last.observations)) {
      result.observations = last.observations.map((o: unknown) => {
        const obs = o as Record<string, unknown>;
        return {
          period: String(obs['period'] || ''),
          rate_decimal: String(obs['rate_decimal'] ?? obs['value'] ?? '')
        };
      });
    }

    return result;
  } catch (e) {
    // OWASP: Security Logging and Monitoring - Log internal errors
    logger.error('EXR_SERVICE', 'INTERNAL_SERVER_ERROR', { 
      seriesId: opts.seriesId, 
      path: filePath, 
      errorCode: String(e) 
    });
    throw e;
  }
}

/**
 * Convenience helper that should be used by settlement/authorization modules
 * to enforce that they never call EXR access APIs. It always denies.
 */
export function denyExrForSettlement(caller?: string): never {
  const msg = 'Access to ECB EXR data is prohibited in settlement and authorization code paths. ' +
    'Use approved internal reference data workflows and operator-reviewed parameters.';
  // OWASP: Security Logging and Monitoring - Log security alerts for prohibited access
  logger.error('EXR_SERVICE', 'SECURITY_ALERT', { 
    caller, 
    errorCode: 'EXR_PROHIBITED' 
  });
  throw new ExrAccessError(msg);
}

export default { verifyExrAccess, getNormalizedExrForPurpose, denyExrForSettlement };
