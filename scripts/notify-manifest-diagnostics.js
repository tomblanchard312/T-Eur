#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function usage() {
  console.error('Usage: node scripts/notify-manifest-diagnostics.js --manifestDir <dir> --date <YYYY-MM-DD> --webhook <url>');
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
  console.log(`No diagnostics found at ${diagPath}`);
  process.exit(0);
}

const lines = fs.readFileSync(diagPath, 'utf8').split(/\r?\n/).filter(Boolean);
const count = lines.length;
const samples = lines.slice(0, 10).map(l => {
  try { return JSON.parse(l); } catch (e) { return { raw: l }; }
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
    console.log('No webhook configured; printing payload:\n', JSON.stringify(payload, null, 2));
    process.exit(0);
  }

  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error('Webhook POST failed', res.status, await res.text());
      process.exit(3);
    }
    console.log('Alert posted to webhook, diagnostics_count=', count);
  } catch (e) {
    console.error('Failed to POST webhook', String(e));
    process.exit(4);
  }
}

send();
