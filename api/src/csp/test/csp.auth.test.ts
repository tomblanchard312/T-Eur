import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mtlsAuth, authorize } from '../middleware/auth';
import { AuditService } from '../services/csp.services';
import { Request, Response } from 'express';

describe('CSP Authorization & Audit', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockReq = {
      socket: {} as any,
      header: vi.fn().mockReturnValue('test-id'),
      path: '/test',
      ip: '127.0.0.1',
    };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  it('rejects requests without client certificates', () => {
    mtlsAuth(mockReq as Request, mockRes as Response, next);
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('accepts valid ECB_OPERATOR certificate', () => {
    const headers: Record<string, string> = {
      'X-SSL-Client-Subject': 'OP001:ECB_OPERATOR:JohnDoe',
      'X-SSL-Client-Fingerprint': 'FP123',
      'X-Correlation-Id': 'test-id',
      'X-Request-Id': 'test-id'
    };
    mockReq.header = vi.fn((name: string) => headers[name]) as any;

    mtlsAuth(mockReq as Request, mockRes as Response, next);
    expect(next).toHaveBeenCalled();
    expect(mockReq.operator?.role).toBe('ECB_OPERATOR');
  });

  it('enforces RBAC and emits audit event on failure', () => {
    mockReq.operator = {
      id: 'AUD001',
      role: 'AUDITOR',
      cn: 'AUD001:AUDITOR:JaneDoe',
      fingerprint: 'FP456'
    };

    const spy = vi.spyOn(AuditService, 'emit');
    const middleware = authorize(['ECB_OPERATOR']);
    
    middleware(mockReq as Request, mockRes as Response, next);

    expect(mockRes.status).toHaveBeenCalledWith(403);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({
      outcome: expect.objectContaining({ status: 'denied', code: 'RBAC_FAILURE' })
    }));
  });
});
