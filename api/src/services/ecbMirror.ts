import crypto from 'crypto';

/**
 * Canonical schema for mirrored ECB reference data.
 *
 * Notes:
 * - This representation stores both: the raw payload bytes as received from the ECB
 *   (for auditability and re-play), and a normalized representation used by consumers.
 * - The SHA-256 of the raw payload is computed and stored. The hash is deterministic
 *   because it is computed over the exact raw bytes received from the network and
 *   recorded alongside the retrieval timestamp and source URL.
 *
 * Rationale for hashing (legal & audit):
 * - Immutability proof: Storing the SHA-256 of the raw payload provides a compact,
 *   tamper-evident fingerprint of the data. Auditors can verify that the stored
 *   raw bytes correspond to a historical ingestion event by recomputing the hash.
 * - Non-repudiation: A recorded hash tied to retrieval metadata (timestamp, source URL)
 *   supports chains of evidence that the data was observed at a particular time.
 * - Deterministic reproducibility: The hash is computed in a deterministic manner
 *   (algorithm identifier + raw bytes) so that independent verification yields the
 *   same result regardless of runtime environment.
 * - Legal defensibility: In regulatory contexts, keeping the original payload and
 *   its cryptographic digest helps demonstrate that downstream actions were taken
 *   based on untampered, verifiable inputs.
 */

/** Normalized observation record (canonical simplified schema) */
export interface CanonicalObservation {
  period: string; // e.g. '2025-12'
  value: number | null;
}

export interface CanonicalSeries {
  seriesId: string;
  retrievedAtUtc: string; // ISO 8601 UTC timestamp
  source: string; // e.g. 'ecb-sdmx'
  provenance: {
    sourceUrl: string; // exact URL used to fetch
    datasetId?: string; // dataset identifier when available
    seriesKey?: string; // series key or dimension values
  };
  metadata: Record<string, unknown>;
  observations: CanonicalObservation[];
}

export interface RawPayloadHash {
  algorithm: 'sha256';
  hex: string; // lowercase hex digest
}

/**
 * MirroredECBRecord: stores raw payload, its SHA-256, normalized records and provenance.
 *
 * Serialization note: `rawPayload` is stored as a base64 string when serializing to
 * JSON to ensure byte-preserving transport/storage. JSON consumers MUST decode base64
 * before re-hashing for verification.
 */
export class MirroredECBRecord {
  public readonly seriesId: string; // logical series identifier (SDMX conceptId)
  public readonly retrievedAtUtc: string; // ISO string in UTC
  public readonly provenance: {
    sourceUrl: string;
    datasetId?: string;
    seriesKey?: string;
  };

  // raw payload bytes as received from the source. Keep as Buffer in memory.
  private readonly rawPayload: Buffer;

  // SHA-256 computed over rawPayload bytes. Deterministic and auditable.
  public readonly rawPayloadHash: RawPayloadHash;

  // Normalized canonical series derived from rawPayload.
  public readonly normalized?: CanonicalSeries;

  // Optional hash of the normalized representation to allow independent verification
  // of the transformation step (i.e., that normalization produced a particular output).
  public readonly normalizedHash?: RawPayloadHash;

  constructor(params: {
    seriesId: string;
    rawPayload: Buffer | Uint8Array | string;
    sourceUrl: string;
    datasetId?: string;
    seriesKey?: string;
    normalized?: CanonicalSeries;
    retrievedAtUtc?: string; // if not provided, will be set to now (UTC)
  }) {
    this.seriesId = params.seriesId;
    this.retrievedAtUtc = params.retrievedAtUtc || new Date().toISOString();
    this.provenance = {
      sourceUrl: params.sourceUrl,
      datasetId: params.datasetId,
      seriesKey: params.seriesKey,
    };

    // normalize rawPayload into Buffer; caller should pass the raw bytes exactly as received
    if (typeof params.rawPayload === 'string') {
      // assume caller passed the raw body string (utf8) — convert to Buffer
      this.rawPayload = Buffer.from(params.rawPayload, 'utf8');
    } else {
      this.rawPayload = Buffer.from(params.rawPayload);
    }

    // compute the canonical raw payload hash
    this.rawPayloadHash = { algorithm: 'sha256', hex: MirroredECBRecord.computeSha256Hex(this.rawPayload) };

    this.normalized = params.normalized;
    if (this.normalized) {
      const normalizedJson = MirroredECBRecord.canonicalizeNormalized(this.normalized);
      this.normalizedHash = { algorithm: 'sha256', hex: MirroredECBRecord.computeSha256Hex(Buffer.from(normalizedJson, 'utf8')) };
    }
  }

  /**
   * Compute SHA-256 hex digest for given bytes.
   * Deterministic: uses UTF-8 for string inputs and raw bytes for Buffer inputs.
   */
  public static computeSha256Hex(input: Buffer | Uint8Array | string): string {
    const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : Buffer.from(input);
    return crypto.createHash('sha256').update(buf).digest('hex');
  }

  /**
   * Canonicalize the normalized representation for deterministic hashing.
   * Rules:
   * - JSON stringify with stable key ordering (Object.keys sorted)
   * - Use ISO8601 timestamps (already used for `retrievedAtUtc`)
   * - Ensure numbers have a stable representation (JS `JSON.stringify` is adequate for numbers)
   */
  public static canonicalizeNormalized(normalized: CanonicalSeries): string {
    function sortKeys(obj: any): any {
      if (Array.isArray(obj)) return obj.map(sortKeys);
      if (obj && typeof obj === 'object') {
        const out: any = {};
        for (const key of Object.keys(obj).sort()) {
          out[key] = sortKeys(obj[key]);
        }
        return out;
      }
      return obj;
    }

    const stable = sortKeys(normalized);
    return JSON.stringify(stable);
  }

  /**
   * Serialize for storage/transport. `rawPayload` is base64-encoded to preserve bytes.
   */
  public toSerializable(): Record<string, unknown> {
    return {
      seriesId: this.seriesId,
      retrievedAtUtc: this.retrievedAtUtc,
      provenance: this.provenance,
      rawPayloadBase64: this.rawPayload.toString('base64'),
      rawPayloadHash: this.rawPayloadHash,
      normalized: this.normalized,
      normalizedHash: this.normalizedHash,
    };
  }

  /**
   * Recompute the raw payload hash from stored base64 payload (useful in verification flows).
   */
  public static verifyRawPayloadBase64(base64: string, expectedHex: string): boolean {
    const buf = Buffer.from(base64, 'base64');
    const hex = MirroredECBRecord.computeSha256Hex(buf);
    return hex === expectedHex;
  }
}

export default MirroredECBRecord;
