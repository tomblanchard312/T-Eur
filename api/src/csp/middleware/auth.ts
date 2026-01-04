import { Request, Response, NextFunction } from 'express';
import { OperatorRole, OperatorIdentity } from '../types';
import { AuditService } from '../services/csp.services';

declare module 'express-serve-static-core' {
  interface Request {
    operator?: OperatorIdentity;
  }
}

export const mtlsAuth = (req: Request, res: Response, next: NextFunction) => {
  // In a real CSP environment, the client certificate is validated by the server/proxy.
  // We extract the identity from the certificate headers or the socket.
  const clientCert = (req.socket as any).getPeerCertificate?.();
  
  // Fallback for development/testing if cert is not directly on socket
  const certSubject = req.header('X-SSL-Client-Subject') || clientCert?.subject?.CN;
  const certFingerprint = req.header('X-SSL-Client-Fingerprint') || clientCert?.fingerprint;

  if (!certSubject || !certFingerprint) {
    res.status(401).json({
      error: 'MTLS_REQUIRED',
      message: 'Valid client certificate required for CSP access'
    });
    return;
  }

  // Map certificate CN to role and identity
  // Format expected: ID:ROLE:NAME (e.g., OP001:ECB_OPERATOR:JohnDoe)
  const parts = certSubject.split(':');
  if (parts.length < 2) {
    res.status(403).json({
      error: 'INVALID_CERT_IDENTITY',
      message: 'Certificate identity format is invalid'
    });
    return;
  }

  const [id, role] = parts;
  
  if (!['ECB_OPERATOR', 'AUDITOR', 'SYSTEM_ADMIN'].includes(role)) {
    res.status(403).json({
      error: 'UNAUTHORIZED_ROLE',
      message: `Role ${role} is not recognized in CSP`
    });
    return;
  }

  req.operator = {
    id,
    role: role as OperatorRole,
    cn: certSubject,
    fingerprint: certFingerprint
  };

  next();
};

export const authorize = (allowedRoles: OperatorRole[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.operator || !allowedRoles.includes(req.operator.role)) {
      const correlationId = req.header('X-Correlation-Id') || 'unknown';
      
      if (req.operator) {
        AuditService.emit({
          timestamp: new Date().toISOString(),
          actor: { id: req.operator.id, role: req.operator.role, cn: req.operator.cn },
          action: { type: req.path, stage: 'rejected' },
          outcome: { status: 'denied', code: 'RBAC_FAILURE', message: 'Insufficient permissions' },
          context: { correlationId, requestId: req.header('X-Request-Id') || 'unknown', ip: req.ip || 'unknown' }
        });
      }

      res.status(403).json({
        error: 'FORBIDDEN',
        message: 'Access denied: insufficient permissions for this sovereign action'
      });
      return;
    }
    next();
  };
};
