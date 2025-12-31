import { logAuditEvent } from '../utils/logger.js';

/**
 * Audit service for managing transaction and system audit logs
 */
export class AuditService {
  /**
   * Log a transaction event with full context
   */
  async logTransactionEvent(
    eventType: string,
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
    logAuditEvent({
      action: `TRANSACTION_${eventType.toUpperCase()}`,
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
    eventType: string,
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
    logAuditEvent({
      action: `COMPLIANCE_${eventType.toUpperCase()}`,
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
    eventType: string,
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
      action: `SECURITY_${eventType.toUpperCase()}`,
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
    eventType: string,
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
    logAuditEvent({
      action: `OPERATIONAL_${eventType.toUpperCase()}`,
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