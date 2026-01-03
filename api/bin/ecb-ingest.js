#!/usr/bin/env node
// Lightweight ECB reference data ingestion script
// - Pulls a whitelist of SDMX series from ECB SDMX REST API (SDMX-JSON)
// - Normalizes into a canonical time-series JSON structure and writes JSONL files to OUTPUT_DIR
// - Exits non-zero when ECB endpoints are unavailable (explicit failure behavior)

const fs = require('fs');
const path = require('path');

const ECB_BASE_URL = process.env.ECB_BASE_URL || 'https://sdw-wsrest.ecb.europa.eu/service/data';
const SERIES_WHITELIST = (process.env.SERIES_WHITELIST || '').split(',').map(s => s.trim()).filter(Boolean);
const OUTPUT_DIR = process.env.OUTPUT_DIR || '/data/ecb';

function log(event, context = {}) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'ecb-ingest',
    event,
    ...context
  }));
}

async function fetchSeries(seriesId) {
  const url = `${ECB_BASE_URL}/${encodeURIComponent(seriesId)}?format=JSON`; // SDMX-JSON
  log('FETCH_SERIES_INITIATED', { seriesId, url });
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`HTTP ${res.status} when fetching ${seriesId}: ${text}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function normalizeSdmxJson(seriesId, sdmx) {
  // Best-effort extraction. SDMX-JSON schemas vary; we conservatively extract dataset/series observations.
  const now = new Date().toISOString();
  const canonical = {
    seriesId,
    retrievedAt: now,
    source: 'ecb-sdmx',
    frequency: null,
    metadata: {},
    observations: [],
  };

  try {
    // metadata from header if available
    if (sdmx && sdmx.structure && sdmx.structure.dimensions) {
      canonical.metadata.structureDimensions = sdmx.structure.dimensions;
    }

    // dataSets -> series
    const dataSets = sdmx.dataSets || [];
    if (dataSets.length > 0 && dataSets[0].series) {
      // find first matching series key
      const seriesObj = dataSets[0].series;
      const keys = Object.keys(seriesObj);
      if (keys.length > 0) {
        const first = seriesObj[keys[0]];
        // observations in first.observations or first.obs
        const obs = first.observations || first.obs || {};
        for (const [k, v] of Object.entries(obs)) {
          // SDMX observations keys are usually index-based or period strings
          const value = Array.isArray(v) ? v[0] : v;
          canonical.observations.push({ period: k, value: value === null ? null : Number(value) });
        }
      }
    }

    // fallback: if sdmx.data contains observations array
    if (canonical.observations.length === 0 && sdmx.data) {
      // try common patterns
      if (Array.isArray(sdmx.data)) {
        for (const d of sdmx.data) {
          if (d.period && d.value !== undefined) canonical.observations.push({ period: d.period, value: Number(d.value) });
        }
      }
    }

    // frequency detection
    canonical.frequency = sdmx.structure && sdmx.structure.attributes ? 'unknown' : canonical.frequency;
  } catch (e) {
    // keep best-effort canonical so far
    canonical.metadata._normalizeError = String(e);
  }

  return canonical;
}

async function writeCanonical(seriesId, obj) {
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  const file = path.join(OUTPUT_DIR, `${seriesId.replace(/[^a-zA-Z0-9-_]/g, '_')}.jsonl`);
  const line = JSON.stringify(obj) + '\n';
  await fs.promises.appendFile(file, line, 'utf8');
  log('CANONICAL_RECORD_WRITTEN', { seriesId, file });
}

async function run() {
  if (SERIES_WHITELIST.length === 0) {
    log('INGEST_SKIPPED', { reason: 'No series configured in SERIES_WHITELIST' });
    return;
  }

  for (const seriesId of SERIES_WHITELIST) {
    try {
      const sdmx = await fetchSeries(seriesId);
      const canonical = normalizeSdmxJson(seriesId, sdmx);
      await writeCanonical(seriesId, canonical);
    } catch (err) {
      // Explicit failure behavior: when ECB endpoints are unavailable or return errors, fail the job.
      log('INGEST_FAILED', { seriesId, error: err && err.message ? err.message : String(err) });
      // exit non-zero so Kubernetes CronJob will mark as failed and can be retried according to backoffPolicy
      process.exit(1);
    }
  }
  log('INGEST_COMPLETED', { count: SERIES_WHITELIST.length });
}

if (require.main === module) {
  run().catch(e => {
    console.error('Unhandled error in ingest:', e);
    process.exit(1);
  });
}
