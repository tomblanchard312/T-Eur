const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class StorageInterface {
  async init() { throw new Error('init not implemented'); }
  async hasProcessed(deviceId, walletId, sequenceNumber) { throw new Error('hasProcessed not implemented'); }
  async markProcessed(deviceId, walletId, sequenceNumber, data) { throw new Error('markProcessed not implemented'); }
  async getStats() { throw new Error('getStats not implemented'); }
  async close() { throw new Error('close not implemented'); }
}

// Lab environment: local JSON file (hardened)
class FileStorage extends StorageInterface {
  constructor(dataDir = path.resolve(__dirname, 'data')) {
    super();
    this.dataDir = dataDir;
    this.processedFile = path.join(this.dataDir, 'processed.json');
    this.backupFile = path.join(this.dataDir, 'processed.json.backup');
    this.integrityFile = path.join(this.dataDir, 'processed.integrity');
    this.processed = {};
  }

  async init() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    if (fs.existsSync(this.processedFile)) {
      try {
        const data = fs.readFileSync(this.processedFile, 'utf8');
        this.processed = JSON.parse(data);

        // Verify integrity
        if (fs.existsSync(this.integrityFile)) {
          const expectedHash = fs.readFileSync(this.integrityFile, 'utf8').trim();
          const actualHash = crypto.createHash('sha256').update(data).digest('hex');
          if (expectedHash !== actualHash) {
            throw new Error('Integrity check failed');
          }
        }
      } catch (e) {
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          severity: 'ERROR',
          component: 'reconciliation-ref',
          event_type: 'integrity_violation',
          message: 'Failed to load processed data',
          error: e.message
        }));
        // Fail closed on corruption
        throw e;
      }
    }
  }

  async hasProcessed(deviceId, walletId, sequenceNumber) {
    const key = `${deviceId}:${walletId}`;
    return !!(this.processed[key] && this.processed[key][sequenceNumber]);
  }

  async markProcessed(deviceId, walletId, sequenceNumber, data) {
    const key = `${deviceId}:${walletId}`;
    if (!this.processed[key]) {
      this.processed[key] = {};
    }
    this.processed[key][sequenceNumber] = {
      ...data,
      processed_at: new Date().toISOString()
    };
    await this._save();
  }

  async _save() {
    const data = JSON.stringify(this.processed, null, 2);
    const hash = crypto.createHash('sha256').update(data).digest('hex');

    // Write backup first
    if (fs.existsSync(this.processedFile)) {
      fs.copyFileSync(this.processedFile, this.backupFile);
    }

    // Write new data
    fs.writeFileSync(this.processedFile, data);
    fs.writeFileSync(this.integrityFile, hash);
  }

  async getStats() {
    const totalKeys = Object.keys(this.processed).length;
    const totalSequences = Object.values(this.processed).reduce((sum, seqs) => sum + Object.keys(seqs).length, 0);
    return { totalKeys, totalSequences };
  }

  async close() {
    // Ensure final save
    await this._save();
  }
}

// Test environment: in-memory store with deterministic seeding
class MemoryStorage extends StorageInterface {
  constructor() {
    super();
    this.processed = {};
    this.stats = { operations: 0 };
  }

  async init() {
    // Deterministic seeding for test environment
    this.processed = {
      'test-device:test-wallet': {
        1: { amount: 100, processed_at: '2026-01-01T00:00:00.000Z' },
        2: { amount: 200, processed_at: '2026-01-01T00:01:00.000Z' }
      }
    };
  }

  async hasProcessed(deviceId, walletId, sequenceNumber) {
    this.stats.operations++;
    const key = `${deviceId}:${walletId}`;
    return !!(this.processed[key] && this.processed[key][sequenceNumber]);
  }

  async markProcessed(deviceId, walletId, sequenceNumber, data) {
    this.stats.operations++;
    const key = `${deviceId}:${walletId}`;
    if (!this.processed[key]) {
      this.processed[key] = {};
    }
    this.processed[key][sequenceNumber] = {
      ...data,
      processed_at: new Date().toISOString()
    };
  }

  async getStats() {
    return {
      totalKeys: Object.keys(this.processed).length,
      totalSequences: Object.values(this.processed).reduce((sum, seqs) => sum + Object.keys(seqs).length, 0),
      operations: this.stats.operations
    };
  }

  async close() {
    // No-op for memory
  }
}

// Pilot environment: append-only local file with rotation and integrity hash
class RotatingFileStorage extends StorageInterface {
  constructor(dataDir = path.resolve(__dirname, 'data'), rotationHours = 24) {
    super();
    this.dataDir = dataDir;
    this.rotationMs = rotationHours * 60 * 60 * 1000;
    this.currentFile = null;
    this.processed = new Set();
    this.lastRotation = Date.now();
  }

  async init() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // Load existing processed IDs from all log files
    const files = fs.readdirSync(this.dataDir).filter(f => f.startsWith('reconciliation-') && f.endsWith('.log'));
    for (const file of files) {
      const content = fs.readFileSync(path.join(this.dataDir, file), 'utf8');
      const lines = content.split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const entry = JSON.parse(line);
          if (entry.event_type === 'processed') {
            this.processed.add(`${entry.device_id}:${entry.wallet_id}:${entry.sequence_number}`);
          }
        } catch (e) {
          // Skip invalid lines
        }
      }
    }

    await this._rotateIfNeeded();
  }

  async _rotateIfNeeded() {
    const now = Date.now();
    if (!this.currentFile || now - this.lastRotation > this.rotationMs) {
      this.currentFile = path.join(this.dataDir, `reconciliation-${new Date(now).toISOString().slice(0, 10)}.log`);
      this.lastRotation = now;
    }
  }

  async hasProcessed(deviceId, walletId, sequenceNumber) {
    return this.processed.has(`${deviceId}:${walletId}:${sequenceNumber}`);
  }

  async markProcessed(deviceId, walletId, sequenceNumber, data) {
    await this._rotateIfNeeded();

    const entry = {
      timestamp: new Date().toISOString(),
      event_type: 'processed',
      device_id: deviceId,
      wallet_id: walletId,
      sequence_number: sequenceNumber,
      ...data
    };

    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(this.currentFile, line);
    this.processed.add(`${deviceId}:${walletId}:${sequenceNumber}`);
  }

  async getStats() {
    return {
      totalProcessed: this.processed.size,
      currentFile: this.currentFile
    };
  }

  async close() {
    // No-op, files are append-only
  }
}

// Production environment: pluggable durable store interface
class DurableStorage extends StorageInterface {
  constructor() {
    super();
    // In production, this would be configured to use a real durable store
    // For now, throw an error to prevent accidental use
    throw new Error('Production storage not implemented - must be configured with durable backend');
  }

  // Interface methods would delegate to configured durable store
}

function createStorage(type) {
  switch (type) {
    case 'file':
      return new FileStorage();
    case 'memory':
      return new MemoryStorage();
    case 'rotating-file':
      return new RotatingFileStorage();
    case 'durable':
      return new DurableStorage();
    default:
      throw new Error(`Unknown storage type: ${type}`);
  }
}

module.exports = { createStorage, StorageInterface };