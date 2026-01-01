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
export function verifyExrAccess(purpose: ExrPurpose, caller?: string) {
  if (ALLOWED_PURPOSES.has(purpose)) return;

  const msg = `EXR access denied for purpose="${purpose}"${caller ? ` caller="${caller}"` : ''}. ` +
    'ECB reference rates are published for information purposes only and must not be used for transaction pricing or settlement.';
  // Explicitly log the denial for audit trails
  logger.error('EXR access denied', { purpose, caller, code: 'EXR_ACCESS_DENIED' });
  throw new ExrAccessError(msg);
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
}) {
  verifyExrAccess(opts.purpose, opts.caller);

  const file = path.join(opts.mirrorDir, `${opts.seriesId.replace(/[^a-zA-Z0-9-_]/g, '_')}.jsonl`);
  try {
    const exists = await fs.promises.stat(file).then(s => s.isFile()).catch(() => false);
    if (!exists) {
      logger.warn('EXR normalized file not found', { seriesId: opts.seriesId, file });
      return null;
    }
    const content = await fs.promises.readFile(file, 'utf8');
    const lines = content.split(/\r?\n/).filter(Boolean);
    if (lines.length === 0) return null;
    const lastLine = lines[lines.length - 1]!;
    const last = JSON.parse(lastLine);
    // Ensure advisory flag present
    last.advisory = true;
    last.advisory_note = 'ECB reference rates are published for information purposes only and must not be used for transaction pricing or settlement.';
    // Guarantee we do not coerce rates into native numbers here
    if (Array.isArray(last.observations)) {
      last.observations = last.observations.map((o: any) => ({ period: o.period, rate_decimal: String(o.rate_decimal ?? o.value ?? '') }));
    }
    return last;
  } catch (e) {
    logger.error('Failed to read EXR normalized file', { seriesId: opts.seriesId, file, error: String(e) });
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
  logger.error('Prohibited EXR access attempt from settlement/authorization', { caller, code: 'EXR_PROHIBITED' });
  throw new ExrAccessError(msg);
}

export default { verifyExrAccess, getNormalizedExrForPurpose, denyExrForSettlement };
