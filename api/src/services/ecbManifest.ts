import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Manifest entry for a single ingested series payload.
 * - `series_id`: logical series identifier (as stored in the mirror record)
 * - `payload_hash`: sha256 hex of the raw payload bytes
 * - `retrieved_at_utc`: ISO 8601 timestamp in UTC when the payload was retrieved
 */
export interface ManifestEntry {
  series_id: string;
  payload_hash: string;
  retrieved_at_utc: string;
}

/**
 * Manifest object covering a single day. The `entries` array lists all series
 * that were ingested during the given UTC date.
 *
 * The manifest serialization is intentionally deterministic: keys are sorted
 * and entries are written in a stable order (sorted by series_id, then timestamp,
 * then payload hash). The manifest bytes are what you sign with an HSM-backed key
 * in production to provide an auditable signature.
 */
export interface DailyManifest {
  date: string; // YYYY-MM-DD (UTC)
  created_at_utc: string; // ISO timestamp when manifest was generated
  entries: ManifestEntry[];
  manifest_hash: string; // sha256 hex of the canonical serialization
}

/**
 * Signer interface placeholder.
 * In production, implement this interface with an HSM-backed signer that
 * performs signing with a protected key. The `sign` method accepts the manifest
 * bytes and returns a signature object. Do NOT implement or wire a software
 * private key into production deployments.
 */
export interface Signer {
  /**
   * Sign raw bytes and return a base64-encoded signature along with metadata.
   */
  sign(data: Buffer): Promise<{ signatureBase64: string; algorithm: string; keyId?: string }>;
}

/**
 * Local (development) signer which uses an ephemeral keypair. This MUST NOT be
 * used in production; provided only to allow testing and demo flows.
 */
export class LocalSigner implements Signer {
  private keyPair: crypto.KeyObject;

  constructor() {
    // generate a temporary RSA keypair for dev only
    const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    this.keyPair = privateKey;
  }

  async sign(data: Buffer) {
    const sig = crypto.sign('sha256', data, { key: this.keyPair, padding: crypto.constants.RSA_PKCS1_PADDING });
    return { signatureBase64: sig.toString('base64'), algorithm: 'rs256', keyId: 'local-dev' };
  }
}

/**
 * Utility: deterministic JSON serialization with sorted keys.
 */
function stableJson(obj: any): string {
  function sortKeys(x: any): any {
    if (Array.isArray(x)) return x.map(sortKeys);
    if (x && typeof x === 'object') {
      const out: any = {};
      for (const k of Object.keys(x).sort()) {
        out[k] = sortKeys(x[k]);
      }
      return out;
    }
    return x;
  }
  return JSON.stringify(sortKeys(obj));
}

/**
 * Build a daily manifest by scanning a directory of mirrored JSONL records.
 * - `mirrorDir` is the directory where ingestion writes per-series JSONL files
 *   (each line is a serialized MirroredECBRecord.toSerializable()).
 * - `dateUtc` is a YYYY-MM-DD string identifying the UTC day to include.
 * - `manifestDir` is the directory where manifests will be written.
 * - `signer` is optional; when provided the produced manifest will be signed
 *   and a companion .sig.json file will be written alongside the manifest.
 *
 * Failure and immutability semantics:
 * - If the manifest file for the date already exists, this function fails (manifest is append-only/immutable).
 * - Manifest is written atomically by writing to a temp file and renaming into place.
 */
export async function generateDailyManifest(opts: {
  mirrorDir: string;
  dateUtc: string; // YYYY-MM-DD
  manifestDir?: string;
  signer?: Signer;
}): Promise<DailyManifest> {
  const mirrorDir = opts.mirrorDir;
  const date = opts.dateUtc;
  const manifestDir = opts.manifestDir || path.join(mirrorDir, 'manifests');

  await fs.promises.mkdir(manifestDir, { recursive: true });

  const manifestPath = path.join(manifestDir, `manifest-${date}.ndjson`);
  const sigPath = path.join(manifestDir, `manifest-${date}.sig.json`);

  // Enforce append-only: do not overwrite existing manifest
  if (fs.existsSync(manifestPath)) {
    throw new Error(`Manifest already exists for date ${date}: ${manifestPath}`);
  }

  // Scan mirror directory for JSONL files
  const files = await fs.promises.readdir(mirrorDir);
  const entries: ManifestEntry[] = [];

  for (const fname of files) {
    const full = path.join(mirrorDir, fname);
    const stat = await fs.promises.stat(full);
    if (stat.isFile() && fname.endsWith('.jsonl')) {
      const content = await fs.promises.readFile(full, 'utf8');
      const lines = content.split(/\r?\n/).filter(Boolean);
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          // obj should be the serializable MirroredECBRecord
          const retrieved = obj.retrievedAtUtc || obj.retrieved_at_utc || obj.retrievedAt || obj.retrieved;
          if (!retrieved) continue;
          // check date portion in UTC
          const dt = new Date(retrieved);
          if (isNaN(dt.getTime())) continue;
          const y = dt.getUTCFullYear();
          const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
          const d = String(dt.getUTCDate()).padStart(2, '0');
          const lineDate = `${y}-${m}-${d}`;
          if (lineDate !== date) continue;

          const seriesId = obj.seriesId || obj.series_id || path.basename(fname, '.jsonl');
          const payloadHash = obj.rawPayloadHash && obj.rawPayloadHash.hex ? obj.rawPayloadHash.hex : (obj.raw_payload_hash && obj.raw_payload_hash.hex);
          if (!payloadHash) continue;

          entries.push({ series_id: seriesId, payload_hash: payloadHash, retrieved_at_utc: retrieved });
        } catch (e) {
          // ignore parse errors for unrelated files
          continue;
        }
      }
    }
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

  // Deterministic serialization: each entry as stable JSON object per line, keys sorted.
  const lines = entries.map(e => stableJson({ series_id: e.series_id, payload_hash: e.payload_hash, retrieved_at_utc: e.retrieved_at_utc }));
  const manifestBytes = Buffer.from(lines.join('\n') + '\n', 'utf8');
  const manifestHash = crypto.createHash('sha256').update(manifestBytes).digest('hex');

  const manifest: DailyManifest = {
    date,
    created_at_utc: new Date().toISOString(),
    entries,
    manifest_hash: manifestHash,
  };

  // Write manifest atomically to enforce immutability.
  const tmpPath = manifestPath + '.tmp';
  await fs.promises.writeFile(tmpPath, manifestBytes, { encoding: 'utf8', mode: 0o444 });
  // Atomic rename
  await fs.promises.rename(tmpPath, manifestPath);

  // Optionally sign using provided signer and write signature metadata next to manifest.
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

  // Ensure target manifest file is not writable (best-effort)
  try {
    await fs.promises.chmod(manifestPath, 0o444);
  } catch (e) {
    // ignore (platform may not support POSIX perms)
  }

  return manifest;
}

export default { generateDailyManifest, LocalSigner };
