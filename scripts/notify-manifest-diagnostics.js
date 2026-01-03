#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ingestLogger = require('./ingestLogger');

function usage() {
  ingestLogger.log('error', 'usage', { error_category: 'bad_invocation' });
  process.exit(2);
}

function parseArgs() {
  const out = {};
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--manifestDir' || a === '--manifest' || a === '-m') out.manifestDir = args[++i];
    else if (a === '--date' || a === '-d') out.date = args[++i];
    else if (a === '--webhook' || a === '-w') out.webhook = args[++i];
  }
  return out;
}

const argv = parseArgs();
const manifestDir = argv.manifestDir || argv.m;
const date = argv.date || argv.d;
const webhook = argv.webhook || process.env.MANIFEST_ALERT_WEBHOOK;

if (!manifestDir || !date) usage();

const diagPath = path.join(manifestDir, `manifest-${date}.diagnostics.jsonl`);
if (!fs.existsSync(diagPath)) {
  ingestLogger.log('info', 'no_diagnostics', { diagnostics_path: diagPath });
  process.exit(0);
}

const lines = fs.readFileSync(diagPath, 'utf8').split(/\r?\n/).filter(Boolean);
const count = lines.length;
const samples = lines.slice(0, 10).map((l, idx) => {
  try {
    const parsed = JSON.parse(l);
    return {
      seriesId: parsed.seriesId || undefined,
      error_category: parsed.error || parsed.error_category || 'parse_error',
      line_number: idx + 1,
    };
  } catch (e) {
    return { error_category: 'parse_error', line_number: idx + 1 };
  }
});

const payload = {
  date,
  diagnostics_count: count,
  samples,
  diagnostics_path: diagPath,
  created_at_utc: new Date().toISOString(),
};

async function send() {
  if (!webhook) {
    ingestLogger.log('info', 'no_webhook', { diagnostics_path: diagPath, diagnostics_count: count, created_at_utc: payload.created_at_utc });
    process.exit(0);
  }

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      ingestLogger.log('error', 'webhook_post_failed', { http_status: res.status, error_category: 'webhook_failure', retryable: res.status >= 500 });
      process.exit(3);
    }
    ingestLogger.log('info', 'webhook_posted', { diagnostics_count: count });
  } catch (e) {
    ingestLogger.log('error', 'webhook_post_exception', { error_category: 'webhook_exception', retryable: true });
    process.exit(4);
  }
}

send();
