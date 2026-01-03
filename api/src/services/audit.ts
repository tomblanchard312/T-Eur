import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { logger, logAuditEvent, AuditAction } from '../utils/logger.js';

/**
 * Audit service for managing transaction and system audit logs
 */
export class AuditService {
  /**
   * Query audit logs from the log file.
   * This is a production-grade implementation that reads the log file line-by-line
   * to avoid memory issues with large log files.
   */
  async queryLogs(filters: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    action?: string;
    resource?: string;
    result?: 'success' | 'failure';
    correlationId?: string;
    limit: number;
    offset: number;
  }): Promise<{ logs: any[]; total: number }> {
    const logPath = path.resolve('logs/audit.log');
    const logs: any[] = [];
    let totalMatching = 0;

    try {
      await fs.promises.access(logPath, fs.constants.R_OK);
    } catch {
      return { logs: [], total: 0 };
    }

    const fileStream = fs.createReadStream(logPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    const startTime = filters.startDate ? new Date(filters.startDate).getTime() : 0;
    const endTime = filters.endDate ? new Date(filters.endDate).getTime() : Infinity;

    // Resource management: limit the total number of lines scanned to prevent DoS on massive log files.
    // 100,000 lines is a reasonable upper bound for a single request in this context.
    const MAX_LINES_TO_SCAN = 100000;
    let linesScanned = 0;

    try {
      for await (const line of rl) {
        linesScanned++;
        if (linesScanned > MAX_LINES_TO_SCAN) {
          logger.warn('AUDIT_SERVICE', 'INTERNAL_SERVER_ERROR', { 
            errorCode: 'SCAN_LIMIT_REACHED',
            details: { maxLines: MAX_LINES_TO_SCAN, filters }
          });
          break;
        }

        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          const entryTime = new Date(entry.timestamp).getTime();

          // Apply filters
          if (entryTime < startTime || entryTime > endTime) continue;
          if (filters.userId && entry.actor !== filters.userId) continue;
          if (filters.action && entry.action !== filters.action) continue;
          if (filters.resource && entry.resource !== filters.resource) continue;
          if (filters.result && entry.result !== filters.result) continue;
          if (filters.correlationId && entry.resourceId !== filters.correlationId) continue;

          if (totalMatching >= filters.offset && logs.length < filters.limit) {
            logs.push(entry);
          }
          
          totalMatching++;
        } catch (e) {
          // Skip malformed lines
          continue;
        }
      }
    } finally {
      rl.close();
      fileStream.destroy();
    }

    return {
      logs,
      total: totalMatching
    };
  }

  /**
   * Log a transaction event with full context
   */
  async logTransactionEvent(
    correlationId: string,
    userId: string | undefined,
    transactionDetails: {
      type: string;
      amount?: string;
      from?: string;
      to?: string;
      asset?: string;
      txHash?: string;
      blockNumber?: number;
      contract?: string;
      method?: string;
      status: 'initiated' | 'pending' | 'completed' | 'failed';
      error?: string;
      metadata?: Record<string, any>;
    }
  ) {
    const actionMap: Record<string, AuditAction> = {
      initiated: 'TRANSACTION_INITIATED',
      pending: 'TRANSACTION_PENDING',
      completed: 'TRANSACTION_COMPLETED',
      failed: 'TRANSACTION_FAILED',
    };

    logAuditEvent({
      action: actionMap[transactionDetails.status] || 'TRANSACTION_INITIATED',
      actor: userId || 'system',
      resource: 'transaction',
      resourceId: correlationId,
      details: {
        transactionType: transactionDetails.type,
        amount: transactionDetails.amount,
        from: transactionDetails.from,
        to: transactionDetails.to,
        asset: transactionDetails.asset || 'tEUR',
        txHash: transactionDetails.txHash,
        blockNumber: transactionDetails.blockNumber,
        contract: transactionDetails.contract,
        method: transactionDetails.method,
        status: transactionDetails.status,
        error: transactionDetails.error,
        metadata: transactionDetails.metadata,
      },
      result: transactionDetails.status === 'failed' ? 'failure' : 'success',
      ...(transactionDetails.error && { errorMessage: transactionDetails.error }),
    });
  }

  /**
   * Log a compliance event
   */
  async logComplianceEvent(
    correlationId: string,
    userId: string | undefined,
    complianceDetails: {
      regulation?: string;
      requirement?: string;
      checkType: 'kyc' | 'aml' | 'sanctions' | 'holding_limit' | 'transaction_limit' | 'other';
      result: 'pass' | 'fail' | 'warning' | 'review_required';
      details?: Record<string, any>;
    }
  ) {
    const actionMap: Record<string, AuditAction> = {
      pass: 'COMPLIANCE_CHECK_PASSED',
      fail: 'COMPLIANCE_CHECK_FAILED',
      warning: 'COMPLIANCE_CHECK_WARNING',
      review_required: 'COMPLIANCE_CHECK_REVIEW_REQUIRED',
    };

    logAuditEvent({
      action: actionMap[complianceDetails.result] || 'COMPLIANCE_CHECK_PASSED',
      actor: userId || 'system',
      resource: 'compliance',
      resourceId: correlationId,
      details: {
        regulation: complianceDetails.regulation,
        requirement: complianceDetails.requirement,
        checkType: complianceDetails.checkType,
        result: complianceDetails.result,
        details: complianceDetails.details,
      },
      result: complianceDetails.result === 'fail' ? 'failure' : 'success',
    });
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(
    correlationId: string,
    userId: string | undefined,
    securityDetails: {
      threatType: 'unauthorized_access' | 'suspicious_activity' | 'rate_limit_exceeded' | 'invalid_signature' | 'other';
      severity: 'low' | 'medium' | 'high' | 'critical';
      source: string;
      details?: Record<string, any>;
    }
  ) {
    logAuditEvent({
      action: 'SECURITY_THREAT_DETECTED',
      actor: userId || 'system',
      resource: 'security',
      resourceId: correlationId,
      details: {
        threatType: securityDetails.threatType,
        severity: securityDetails.severity,
        source: securityDetails.source,
        details: securityDetails.details,
      },
      result: securityDetails.severity === 'critical' ? 'failure' : 'success',
    });
  }

  /**
   * Log an operational event
   */
  async logOperationalEvent(
    correlationId: string,
    userId: string | undefined,
    operationalDetails: {
      component: string;
      operation: string;
      result: 'success' | 'failure' | 'degraded';
      duration?: number;
      details?: Record<string, any>;
    }
  ) {
    const actionMap: Record<string, AuditAction> = {
      success: 'OPERATIONAL_SUCCESS',
      failure: 'OPERATIONAL_FAILURE',
      degraded: 'OPERATIONAL_DEGRADED',
    };

    logAuditEvent({
      action: actionMap[operationalDetails.result] || 'OPERATIONAL_SUCCESS',
      actor: userId || 'system',
      resource: 'operational',
      resourceId: correlationId,
      details: {
        component: operationalDetails.component,
        operation: operationalDetails.operation,
        result: operationalDetails.result,
        duration: operationalDetails.duration,
        details: operationalDetails.details,
      },
      result: operationalDetails.result === 'failure' ? 'failure' : 'success',
    });
  }
}

// Export singleton instance
export const auditService = new AuditService();