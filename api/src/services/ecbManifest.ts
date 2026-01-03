import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import ingestLogger from '../utils/ingestLogger';

export interface ManifestEntry {
  series_id: string;
  payload_hash: string;
  retrieved_at_utc: string;
}

export interface DailyManifest {
  date: string;
  created_at_utc: string;
  entries: ManifestEntry[];
  manifest_hash: string;
  diagnostics?: Array<{ file: string; lineNumber: number; error: string; raw?: string }>;
}

export class LocalSigner {
  private keyPair: crypto.KeyObject;
  constructor() {
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    this.keyPair = privateKey;
  }
  async sign(data: Buffer) {
    const sig = crypto.sign('sha256', data, { key: this.keyPair, padding: crypto.constants.RSA_PKCS1_PADDING });
    return { signatureBase64: sig.toString('base64'), algorithm: 'rs256', keyId: 'local-dev' };
  }
}

function stableJson(obj: any): string {
  function sortKeys(x: any): any {
    if (Array.isArray(x)) return x.map(sortKeys);
    if (x && typeof x === 'object') {
      const out: any = {};
      for (const k of Object.keys(x).sort()) out[k] = sortKeys(x[k]);
      return out;
    }
    return x;
  }
  return JSON.stringify(sortKeys(obj));
}

/**
 * Generate a daily manifest from a directory of per-series JSONL mirror files.
 * Collects diagnostics for JSON parse errors or invalid timestamps/hashes instead
 * of silently ignoring them. If the number of diagnostic errors exceeds
 * `opts.errorThreshold` (default 10) the function throws to surface the issue.
 */
export async function generateDailyManifest(opts: {
  mirrorDir: string;
  dateUtc: string; // YYYY-MM-DD
  manifestDir?: string;
  signer?: { sign(data: Buffer): Promise<{ signatureBase64: string; algorithm: string; keyId: string }> };
  errorThreshold?: number;
}): Promise<DailyManifest> {
  const mirrorDir = opts.mirrorDir;
  const date = opts.dateUtc;
  const manifestDir = opts.manifestDir || path.join(mirrorDir, 'manifests');
  const errorThreshold = opts.errorThreshold ?? 10;

  await fs.promises.mkdir(manifestDir, { recursive: true });
  const manifestPath = path.join(manifestDir, `manifest-${date}.ndjson`);
  const sigPath = path.join(manifestDir, `manifest-${date}.sig.json`);
  const diagnosticsPath = path.join(manifestDir, `manifest-${date}.diagnostics.jsonl`);

  if (fs.existsSync(manifestPath)) throw new Error(`Manifest already exists for date ${date}: ${manifestPath}`);

  const files = await fs.promises.readdir(mirrorDir);
  const entries: ManifestEntry[] = [];
  const diagnostics: Array<{ file: string; lineNumber: number; error: string; raw?: string }> = [];

  // Counters for reporting and policy decisions (explicit types to satisfy strict checks)
  const counters: {
    total_lines_read: number;
    parsed_ok: number;
    parse_errors: number;
    missing_retrieved_timestamp: number;
    invalid_timestamps: number;
    missing_payload_hash: number;
    invalid_payload_hash: number;
  } = {
    total_lines_read: 0,
    parsed_ok: 0,
    parse_errors: 0,
    missing_retrieved_timestamp: 0,
    invalid_timestamps: 0,
    missing_payload_hash: 0,
    invalid_payload_hash: 0,
  };

  // Helper to record a rejected record: persist to diagnostics and emit a structured log
  function rejectRecord(fname: string, lineNumber: number, reason: string, severity: 'warn' | 'error', rawLine?: string) {
    // Store raw for operator diagnostics only (not emitted in logs). This keeps an auditable trail
    // while ensuring logs emitted to streaming systems do NOT contain raw payloads.
    const diag: { file: string; lineNumber: number; error: string; raw?: string } = { file: fname, lineNumber, error: reason };
    if (rawLine !== undefined) diag.raw = rawLine;
    diagnostics.push(diag);

    // Map reason -> counter increment
    if (reason.includes('json parse') || reason.includes('payload hash')) {
      if (reason.includes('json parse')) counters.parse_errors++;
      if (reason.includes('missing payload')) counters.missing_payload_hash++;
      if (reason.includes('invalid payload')) counters.invalid_payload_hash++;
    } else if (reason.includes('retrieved')) {
      counters.missing_retrieved_timestamp++;
    } else if (reason.includes('invalid timestamp')) {
      counters.invalid_timestamps++;
    }

    // Emit structured log WITHOUT raw payload
    // Use stable event names for downstream processing and alerts
    const eventName = (() => {
      if (reason.includes('json parse')) return 'manifest_record_invalid_json';
      if (reason.includes('missing payload')) return 'manifest_record_missing_payload_hash';
      if (reason.includes('invalid payload')) return 'manifest_record_invalid_payload_hash';
      if (reason.includes('retrieved')) return 'manifest_record_missing_retrieved_timestamp';
      if (reason.includes('invalid timestamp')) return 'manifest_record_invalid_timestamp';
      return 'manifest_record_rejected';
    })();

    const ctx: Record<string, unknown> = {
      error_category: reason,
      retryable: false,
      line_number: lineNumber,
      diagnostics_path: diagnosticsPath,
    };
    ingestLogger.log(severity === 'error' ? 'error' : 'warn', eventName, ctx);
  }

  for (const fname of files) {
    const full = path.join(mirrorDir, fname);
    const stat = await fs.promises.stat(full);
    if (!stat.isFile() || !fname.endsWith('.jsonl')) continue;

    const content = await fs.promises.readFile(full, 'utf8');
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      if (!raw || !raw.trim()) continue;
      counters.total_lines_read++;

      // Step 1: Parse JSON with explicit error handling
      let obj: any;
      try {
        obj = JSON.parse(raw);
      } catch (e: any) {
        // Classification rule: JSON parse failure -> ERROR (corrupted input)
        rejectRecord(fname, i + 1, `json parse error: ${String(e?.message || e)}`, 'error', raw);
        continue; // move on to next line but do not silently drop
      }

      counters.parsed_ok++;

      // Step 2: Validate required retrieved timestamp
      const retrieved = obj.retrievedAtUtc || obj.retrieved_at_utc || obj.retrievedAt || obj.retrieved;
      if (!retrieved) {
        // Missing required field -> WARN (schema violation)
        rejectRecord(fname, i + 1, 'missing retrieved timestamp', 'warn', raw);
        continue;
      }

      // Step 3: Validate timestamp format and date matching
      const dt = new Date(retrieved);
      if (isNaN(dt.getTime())) {
        // Invalid timestamp -> WARN (data quality issue)
        rejectRecord(fname, i + 1, `invalid timestamp: ${String(retrieved)}`, 'warn', raw);
        continue;
      }
      const y = dt.getUTCFullYear();
      const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
      const d = String(dt.getUTCDate()).padStart(2, '0');
      const lineDate = `${y}-${m}-${d}`;
      if (lineDate !== date) {
        // Not an error for other dates; skip but record as a WARN so we have visibility
        // This is a deliberate, auditable decision: skipping out-of-date records must be visible.
        rejectRecord(fname, i + 1, `record date ${lineDate} does not match manifest date ${date}`, 'warn', raw);
        continue;
      }

      // Step 4: Validate payload hash presence and format
      const payloadHash = obj.rawPayloadHash && obj.rawPayloadHash.hex ? obj.rawPayloadHash.hex : (obj.raw_payload_hash && obj.raw_payload_hash.hex);
      if (!payloadHash) {
        // Missing hash -> ERROR (integrity violation)
        rejectRecord(fname, i + 1, 'missing payload hash', 'error', raw);
        continue;
      }
      if (!/^[0-9a-f]{64}$/.test(payloadHash)) {
        // Invalid hash format -> ERROR (integrity violation)
        rejectRecord(fname, i + 1, `invalid payload hash format: ${String(payloadHash)}`, 'error', raw);
        continue;
      }

      // Passed all validations; preserve successful record exactly as before
      const seriesId = obj.seriesId || obj.series_id || path.basename(fname, '.jsonl');
      entries.push({ series_id: seriesId, payload_hash: payloadHash, retrieved_at_utc: retrieved });
    }
  }

  // If there are diagnostics, write them to diagnostics file for operators/auditors
  if (diagnostics.length > 0) {
    try {
      const diagLines = diagnostics.map(d => stableJson(d)).join('\n') + '\n';
      await fs.promises.writeFile(diagnosticsPath, diagLines, { encoding: 'utf8', mode: 0o444 });
      ingestLogger.log('info', 'diagnostics_written', { diagnostics_path: diagnosticsPath, diagnostics_count: diagnostics.length });
    }
    catch (e) {
      // structured log but do not fail for diagnostics write issues
      ingestLogger.log('error', 'diagnostics_write_failed', { error_category: 'io_error', retryable: false });
    }
  }

  // Emit final summary for the run. This provides deterministic, machine-parsable
  // observability for auditors and operators. Raw payloads are NOT included.
  const integrityErrors = (counters.parse_errors || 0) + (counters.missing_payload_hash || 0) + (counters.invalid_payload_hash || 0);
  const summary = {
    total_lines_read: counters.total_lines_read || 0,
    parsed_ok: counters.parsed_ok || 0,
    parse_errors: counters.parse_errors || 0,
    missing_retrieved_timestamp: counters.missing_retrieved_timestamp || 0,
    invalid_timestamps: counters.invalid_timestamps || 0,
    missing_payload_hash: counters.missing_payload_hash || 0,
    invalid_payload_hash: counters.invalid_payload_hash || 0,
    entries_in_manifest: entries.length,
    diagnostics_written: diagnostics.length,
    integrity_errors: integrityErrors,
  };

  ingestLogger.log('info', 'manifest_processing_summary', summary as any);

  // Fail the job only if integrity violations exceed configured threshold.
  if (integrityErrors > errorThreshold) {
    ingestLogger.log('error', 'manifest_integrity_threshold_exceeded', { diagnostics_count: diagnostics.length, diagnostics_path: diagnosticsPath, error_category: 'integrity_threshold_exceeded', retryable: false });
    throw new Error(`Integrity violations (${integrityErrors}) exceeded threshold (${errorThreshold}) for date ${date}`);
  }

  // Sort entries deterministically
  entries.sort((a, b) => {
    if (a.series_id < b.series_id) return -1;
    if (a.series_id > b.series_id) return 1;
    if (a.retrieved_at_utc < b.retrieved_at_utc) return -1;
    if (a.retrieved_at_utc > b.retrieved_at_utc) return 1;
    if (a.payload_hash < b.payload_hash) return -1;
    if (a.payload_hash > b.payload_hash) return 1;
    return 0;
  });

  const lines = entries.map(e => stableJson({ series_id: e.series_id, payload_hash: e.payload_hash, retrieved_at_utc: e.retrieved_at_utc }));
  const manifestBytes = Buffer.from(lines.join('\n') + '\n', 'utf8');
  const manifestHash = crypto.createHash('sha256').update(manifestBytes).digest('hex');

  const manifest: DailyManifest = {
    date,
    created_at_utc: new Date().toISOString(),
    entries,
    manifest_hash: manifestHash,
  };

  if (diagnostics.length > 0) manifest.diagnostics = diagnostics;

  // Write manifest atomically and set read-only mode (best-effort)
  const tmpPath = manifestPath + '.tmp';
  await fs.promises.writeFile(tmpPath, manifestBytes, { encoding: 'utf8', mode: 0o444 });
  await fs.promises.rename(tmpPath, manifestPath);

  if (opts.signer) {
    const sig = await opts.signer.sign(manifestBytes);
    const sigObj = {
      manifest: path.basename(manifestPath),
      manifest_hash: manifestHash,
      signer: { algorithm: sig.algorithm, keyId: sig.keyId },
      signature: sig.signatureBase64,
      created_at_utc: new Date().toISOString(),
    };
    await fs.promises.writeFile(sigPath, stableJson(sigObj) + '\n', { encoding: 'utf8', mode: 0o444 });
  }

  try {
    await fs.promises.chmod(manifestPath, 0o444);
  }
  catch (e) {
    // ignore
  }

  return manifest;
}

export default { generateDailyManifest, LocalSigner };
