import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { generateCorrelationId } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

export interface FraudAlert {
  id: string;
  timestamp: string;
  transaction: {
    amount: number;
    from: string;
    to: string;
  };
  status: 'active' | 'overridden';
  overridden_by?: string;
  override_reason?: string;
  override_timestamp?: string;
}

export class FraudService {
  private readonly alertsLog = path.join(process.cwd(), 'logs', 'alerts.jsonl');
  private readonly MAX_ALERTS_TO_SCAN = 10000;

  constructor() {
    const logDir = path.dirname(this.alertsLog);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }

  async createAlert(amount: number, from: string, to: string): Promise<string> {
    const alert: FraudAlert = {
      id: generateCorrelationId('alert'),
      timestamp: new Date().toISOString(),
      transaction: { amount, from, to },
      status: 'active'
    };

    const logLine = JSON.stringify(alert) + '\n';
    try {
      await fs.promises.appendFile(this.alertsLog, logLine);
    } catch (error) {
      // Financial System Safety: Fail-closed on security logging failure.
      // If we cannot record a fraud alert, we MUST block the operation.
      logger.error('FRAUD_SERVICE', 'FILE_OPERATION_FAILED', {
        path: this.alertsLog,
        errorCode: 'ALERT_PERSISTENCE_FAILED',
        error: String(error)
      });
      throw new Error('CRITICAL: Failed to persist fraud alert. Operation blocked for security.');
    }

    // OWASP: Security Logging and Monitoring - Log security alerts
    logger.warn('FRAUD_SERVICE', 'SECURITY_ALERT', {
      resourceId: alert.id,
      // Sanitized: log that an alert was created, but not the PII/financial data here
      errorCode: 'FRAUD_ALERT_CREATED'
    });

    return alert.id;
  }

  async getAlert(id: string): Promise<FraudAlert | null> {
    if (!fs.existsSync(this.alertsLog)) return null;

    const fileStream = fs.createReadStream(this.alertsLog);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    try {
      let scanned = 0;
      for await (const line of rl) {
        scanned++;
        if (scanned > this.MAX_ALERTS_TO_SCAN) break;
        if (!line.trim()) continue;

        try {
          const alert = JSON.parse(line) as FraudAlert;
          if (alert.id === id) return alert;
        } catch (e) {
          // OWASP: Security Logging and Monitoring - Log file corruption
          logger.error('FRAUD_SERVICE', 'FILE_OPERATION_FAILED', {
            path: this.alertsLog,
            errorCode: 'JSON_PARSE_ERROR'
          });
          continue;
        }
      }
    } finally {
      rl.close();
      fileStream.destroy();
    }

    return null;
  }

  async overrideAlert(id: string, agentId: string, reason: string): Promise<boolean> {
    if (!fs.existsSync(this.alertsLog)) return false;

    // In a real production system, we would use a database.
    // For this implementation, we'll read and write to a temp file to avoid memory issues.
    const tempFile = `${this.alertsLog}.tmp`;
    const fileStream = fs.createReadStream(this.alertsLog);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const outStream = fs.createWriteStream(tempFile);
    let found = false;

    try {
      for await (const line of rl) {
        if (!line.trim()) continue;

        try {
          const alert = JSON.parse(line) as FraudAlert;
          if (alert.id === id && alert.status === 'active') {
            alert.status = 'overridden';
            alert.overridden_by = agentId;
            alert.override_reason = reason;
            alert.override_timestamp = new Date().toISOString();
            found = true;

            // OWASP: Security Logging and Monitoring - Log security overrides
            logger.info('FRAUD_SERVICE', 'RESOURCE_UPDATED', {
              resourceId: id,
              userId: agentId,
              errorCode: 'FRAUD_ALERT_OVERRIDDEN'
            });
          }
          outStream.write(JSON.stringify(alert) + '\n');
        } catch (e) {
          outStream.write(line + '\n');
        }
      }
    } finally {
      rl.close();
      fileStream.destroy();
      outStream.end();
    }

    if (found) {
      await fs.promises.rename(tempFile, this.alertsLog);
    } else {
      await fs.promises.unlink(tempFile);
    }

    return found;
  }
}

export const fraudService = new FraudService();
