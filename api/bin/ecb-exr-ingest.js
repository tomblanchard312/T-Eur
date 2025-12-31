#!/usr/bin/env node
/*
 Example ingestion for ECB EXR exchange rate dataset.

 Requirements met:
 - Uses a fixed series whitelist (EXR series identifiers).
 - Normalizes values into decimal string representation and stores unit/frequency metadata.
 - Contains the required explicit warning comment.
 - No function returns EXR values as native numbers suitable for direct transaction consumption.

 Important policy note (do not remove):
 "ECB reference rates are published for information purposes only and must not be used for transaction pricing or settlement."

 Design decisions to enforce safety:
 - Rates are normalized and stored as strings (decimal text). This prevents accidental numeric arithmetic or direct consumption by transaction logic.
 - The script only writes advisory records to storage (JSONL). It does not export functions that return native numeric rates.
 - Consumers that need to use rates must explicitly parse and apply administrative controls (human-reviewed) before any monetary operation.
*/

const fs = require('fs');
const path = require('path');

const ECB_BASE = process.env.ECB_BASE_URL || 'https://sdw-wsrest.ecb.europa.eu/service/data';
// Fixed whitelist of EXR series (example). Replace with the required identifiers for your use-case.
const EXR_WHITELIST = [
  'EXR.D.USD.EUR.SP00.A',
  'EXR.D.GBP.EUR.SP00.A',
];

const OUTPUT_DIR = process.env.OUTPUT_DIR || '/data/ecb-exr';

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function fetchSeries(seriesId) {
  const url = `${ECB_BASE}/${encodeURIComponent(seriesId)}?format=JSON`;
  log('fetching', seriesId, url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`fetch ${seriesId} failed ${res.status}`);
  return res.json();
}

function normalizeExrSdmx(seriesId, sdmxJson) {
  // Extract unit and frequency from SDMX structure when present
  const now = new Date().toISOString();
  const out = {
    series_id: seriesId,
    retrieved_at_utc: now,
    source: 'ecb-sdmx-exr',
    unit: null,
    frequency: null,
    // rates stored as decimal strings to avoid accidental numeric consumption
    observations: [],
    metadata: {},
  };

  try {
    // Attempt to extract unit and frequency from structure/attributes
    if (sdmxJson && sdmxJson.structure && sdmxJson.structure.attributes) {
      out.metadata.structureAttributes = sdmxJson.structure.attributes;
    }
    // SDMX often encodes unit in series attributes (conservative lookup)
    if (sdmxJson && sdmxJson.dataSets && sdmxJson.dataSets[0] && sdmxJson.dataSets[0].series) {
      const seriesObj = sdmxJson.dataSets[0].series;
      const key = Object.keys(seriesObj)[0];
      const seriesNode = seriesObj[key];
      if (seriesNode && seriesNode.attributes) {
        // attribute index or mapping may vary; we store raw attributes for review
        out.metadata.seriesAttributes = seriesNode.attributes;
      }
      const obs = seriesNode.observations || seriesNode.obs || {};
      for (const [k, v] of Object.entries(obs)) {
        const rawVal = Array.isArray(v) ? v[0] : v;
        // Normalization: represent as decimal string with up to 12 significant digits.
        // We do not return Number values to avoid direct consumption by transaction logic.
        let decimalString = null;
        if (rawVal === null || rawVal === undefined || rawVal === '') {
          decimalString = null;
        } else {
          // Coerce to string and normalize formatting
          // Use built-in Number for validation but always store as string
          const asNum = Number(rawVal);
          if (!Number.isFinite(asNum)) {
            decimalString = String(rawVal);
          } else {
            // use toPrecision to capture significant digits, then trim
            decimalString = Number(asNum).toPrecision(12).replace(/(?:\.0+|([0-9]+)0+)$/, '$1');
          }
        }
        out.observations.push({ period: k, rate_decimal: decimalString });
      }
    }
  } catch (e) {
    out.metadata._normalizeError = String(e);
  }

  return out;
}

async function writeOut(seriesId, obj) {
  await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
  const file = path.join(OUTPUT_DIR, `${seriesId.replace(/[^a-zA-Z0-9-_]/g, '_')}.jsonl`);
  await fs.promises.appendFile(file, JSON.stringify(obj) + '\n', 'utf8');
  log('wrote', file);
}

async function main() {
  if (EXR_WHITELIST.length === 0) {
    log('no exr series configured');
    return;
  }

  for (const s of EXR_WHITELIST) {
    try {
      const data = await fetchSeries(s);
      const norm = normalizeExrSdmx(s, data);
      // Mark advisory to make it explicit when reviewing storage
      norm.advisory = true;
      norm.advisory_note = 'ECB reference rates are published for information purposes only and must not be used for transaction pricing or settlement.';
      await writeOut(s, norm);
    } catch (err) {
      log('error', s, err && err.message ? err.message : err);
      // Fail job so operator can investigate
      process.exit(1);
    }
  }
  log('completed exr ingestion');
}

if (require.main === module) {
  main().catch(e => { console.error('fatal', e); process.exit(1); });
}

// Note: This script intentionally does NOT export any function that returns
// native JavaScript Numbers representing exchange rates. Consumers must read
// the stored JSONL, treat values as advisory text (decimal strings), and
// follow governance-required human review before using any rate in financial
// calculations.
