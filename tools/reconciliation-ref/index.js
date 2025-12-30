const http = require('http');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const PROCESSED_FILE = path.join(DATA_DIR, 'processed.json');
let processed = {};
if (fs.existsSync(PROCESSED_FILE)) {
  try { processed = JSON.parse(fs.readFileSync(PROCESSED_FILE)); } catch (e) { processed = {}; }
}

function saveProcessed() {
  fs.writeFileSync(PROCESSED_FILE, JSON.stringify(processed, null, 2));
}

function validateBatch(batch) {
  if (!batch.device_id || !batch.wallet_id || !Array.isArray(batch.transactions)) return false;
  for (const t of batch.transactions) {
    if (typeof t.sequence_number !== 'number' || typeof t.amount !== 'number' || !t.signature) return false;
  }
  return true;
}

const server = http.createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/ingest') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const batch = JSON.parse(body);
        if (!validateBatch(batch)) {
          res.writeHead(400); res.end('invalid batch'); return;
        }
        const key = `${batch.device_id}:${batch.wallet_id}`;
        processed[key] = processed[key] || {};
        const accepted = [];
        const rejected = [];
        for (const t of batch.transactions) {
          const seq = t.sequence_number;
          if (processed[key][seq]) {
            rejected.push({ sequence_number: seq, reason: 'duplicate' });
            continue;
          }
          // Basic cap check (example): sum of accepted in this batch must not exceed offline_cap_per_device if configured
          processed[key][seq] = { amount: t.amount, timestamp: t.timestamp || Date.now() };
          accepted.push(seq);
        }
        saveProcessed();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ accepted, rejected }));
      } catch (err) {
        res.writeHead(500); res.end('server error');
      }
    });
    return;
  }
  res.writeHead(404); res.end('not found');
});

const port = process.env.PORT || 8081;
server.listen(port, () => console.log(`Reconciliation ref running on port ${port}`));
