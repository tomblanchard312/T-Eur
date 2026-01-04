const http = require('http');
const config = require('./config');
const { createStorage } = require('./storage');
const { validateReconciliationBatch } = require('./validation');

let storage;
let stats = {
  ingestsAccepted: 0,
  ingestsRejected: 0,
  duplicatesDetected: 0,
  integrityViolations: 0
};

function logEvent(severity, eventType, data = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    severity,
    component: 'reconciliation-ref',
    event_type: eventType,
    correlation_id: data.correlation_id || 'system',
    ...data
  };
  console.log(JSON.stringify(entry));
}

async function initializeService() {
  try {
    storage = createStorage(config.storageType);
    await storage.init();
    logEvent('INFO', 'service_startup', {
      environment: config.environment,
      storage_type: config.storageType
    });
  } catch (error) {
    logEvent('ERROR', 'service_startup_failed', {
      error: error.message
    });
    process.exit(1);
  }
}

function generateCorrelationId() {
  return `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function handleIngest(req, res, correlationId) {
  const chunks = [];
  let totalSize = 0;
  const maxSize = parseSize(config.maxRequestSize);

  req.on('data', (chunk) => {
    totalSize += chunk.length;
    if (totalSize > maxSize) {
      logEvent('WARN', 'request_too_large', { correlation_id: correlationId, size: totalSize });
      res.writeHead(413, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Request body too large',
        correlation_id: correlationId
      }));
      req.destroy();
      return;
    }
    chunks.push(chunk);
  });

  req.on('end', async () => {
    try {
      const body = Buffer.concat(chunks).toString();
      const batch = JSON.parse(body);

      // Validate batch
      const validation = validateReconciliationBatch(batch, config.maxBatchSize);
      if (!validation.valid) {
        stats.ingestsRejected++;
        logEvent('WARN', 'ingest_rejected', {
          correlation_id: correlationId,
          reason: 'validation_failed',
          error: validation.error
        });
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: validation.error,
          correlation_id: correlationId
        }));
        return;
      }

      // Process transactions
      const accepted = [];
      const rejected = [];

      for (const transaction of batch.transactions) {
        const { sequence_number, amount, signature, timestamp } = transaction;

        // Check for duplicates
        const isDuplicate = await storage.hasProcessed(batch.device_id, batch.wallet_id, sequence_number);
        if (isDuplicate) {
          stats.duplicatesDetected++;
          rejected.push({
            sequence_number,
            reason: 'duplicate_sequence_number'
          });
          logEvent('WARN', 'duplicate_detected', {
            correlation_id: correlationId,
            device_id: batch.device_id,
            wallet_id: batch.wallet_id,
            sequence_number
          });
          continue;
        }

        // Mark as processed
        await storage.markProcessed(batch.device_id, batch.wallet_id, sequence_number, {
          amount,
          signature,
          timestamp: timestamp || new Date().toISOString()
        });

        accepted.push(sequence_number);
      }

      stats.ingestsAccepted++;
      logEvent('INFO', 'ingest_accepted', {
        correlation_id: correlationId,
        device_id: batch.device_id,
        wallet_id: batch.wallet_id,
        accepted_count: accepted.length,
        rejected_count: rejected.length
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        accepted,
        rejected,
        correlation_id: correlationId
      }));

    } catch (error) {
      stats.ingestsRejected++;
      logEvent('ERROR', 'ingest_error', {
        correlation_id: correlationId,
        error: error.message
      });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Internal server error',
        correlation_id: correlationId
      }));
    }
  });
}

async function handleHealth(req, res) {
  try {
    const storageStats = await storage.getStats();
    const isHealthy = true; // Could add more health checks

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: isHealthy ? 'healthy' : 'unhealthy',
      environment: config.environment,
      timestamp: new Date().toISOString(),
      storage: storageStats
    }));
  } catch (error) {
    res.writeHead(503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    }));
  }
}

async function handleMetrics(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    ingests_accepted: stats.ingestsAccepted,
    ingests_rejected: stats.ingestsRejected,
    duplicates_detected: stats.duplicatesDetected,
    integrity_violations: stats.integrityViolations,
    timestamp: new Date().toISOString()
  }));
}

function parseSize(sizeStr) {
  const units = { 'b': 1, 'kb': 1024, 'mb': 1024 * 1024, 'gb': 1024 * 1024 * 1024 };
  const match = sizeStr.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) return 1024 * 1024; // Default 1MB
  return parseFloat(match[1]) * (units[match[2]] || 1);
}

const server = http.createServer(async (req, res) => {
  const correlationId = generateCorrelationId();

  // CORS headers for API access
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/ingest') {
    await handleIngest(req, res, correlationId);
  } else if (req.method === 'GET' && req.url === '/health') {
    await handleHealth(req, res);
  } else if (req.method === 'GET' && req.url === '/metrics') {
    await handleMetrics(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: 'Not found',
      correlation_id: correlationId
    }));
  }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logEvent('INFO', 'service_shutdown', { reason: 'SIGTERM' });
  if (storage) {
    await storage.close();
  }
  server.close(() => process.exit(0));
});

process.on('SIGINT', async () => {
  logEvent('INFO', 'service_shutdown', { reason: 'SIGINT' });
  if (storage) {
    await storage.close();
  }
  server.close(() => process.exit(0));
});

// Initialize and start
initializeService().then(() => {
  const port = process.env.PORT || 8081;
  server.listen(port, () => {
    logEvent('INFO', 'service_listening', { port });
  });
}).catch((error) => {
  logEvent('ERROR', 'initialization_failed', { error: error.message });
  process.exit(1);
});
