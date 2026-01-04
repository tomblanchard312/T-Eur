import { z } from 'zod';

export type OperatorRole = 'ECB_OPERATOR' | 'AUDITOR' | 'SYSTEM_ADMIN';

export interface OperatorIdentity {
  id: string;
  role: OperatorRole;
  cn: string; // Common Name from certificate
  fingerprint: string;
}

export interface AuditEvent {
  timestamp: string;
  actor: {
    id: string;
    role: OperatorRole;
    cn: string;
  };
  action: {
    type: string;
    stage: 'requested' | 'authorized' | 'executed' | 'rejected' | 'failed';
    justification?: string;
  };
  target?: {
    type: string;
    id: string;
  };
  outcome: {
    status: 'success' | 'failure' | 'denied';
    code?: string;
    message?: string;
  };
  context: {
    correlationId: string;
    requestId: string;
    ip: string;
  };
}

export const BaseSovereignSchema = z.object({
  justification: z.string().min(10).max(500),
}).strict();

export const MintSchema = BaseSovereignSchema.extend({
  amount: z.string().regex(/^\d+$/), // Amount in cents
  targetAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
}).strict();

export const SanctionSchema = BaseSovereignSchema.extend({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  legalBasis: z.string().min(5),
}).strict();

export const EscrowSchema = BaseSovereignSchema.extend({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string().regex(/^\d+$/),
  expiry: z.number().optional(),
}).strict();

export const KeyActionSchema = BaseSovereignSchema.extend({
  keyId: z.string(),
}).strict();

export const ParticipantActionSchema = BaseSovereignSchema.extend({
  participantId: z.string(),
}).strict();
