import { logger } from '../utils/logger.js';

/**
 * ECB-grade Key Hierarchy and Role Governance
 * 
 * This service implements the root-of-trust and key lifecycle management
 * for the tEUR system, ensuring that all operations are bound to 
 * authorized keys and roles.
 */

export enum KeyRole {
  ROOT = 'ROOT',               // ECB Root (Offline/HSM)
  ISSUING = 'ISSUING',         // ECB Issuing (Minting/Burning)
  OPERATIONAL = 'OPERATIONAL', // ECB Operational (Freezing/Escrow)
  PARTICIPANT = 'PARTICIPANT', // Banks, PSPs (Transfers/Registration)
  WALLET = 'WALLET'            // End-user wallets (Payments)
}

export enum KeyStatus {
  ACTIVE = 'ACTIVE',
  ROTATED = 'ROTATED',
  REVOKED = 'REVOKED',
  DISABLED = 'DISABLED'
}

export interface KeyMetadata {
  keyId: string;
  publicKey: string;
  role: KeyRole;
  status: KeyStatus;
  ownerId: string;             // Institution ID or Wallet Address
  parentKeyId?: string;        // For hierarchy tracking
  createdAt: number;
  expiresAt: number;
  revokedAt?: number;
  revocationReason?: string;
}

export class GovernanceError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'GovernanceError';
  }
}

class GovernanceService {
  // In-memory store for demo/dev. In production, this would be a secure DB + HSM.
  private keys: Map<string, KeyMetadata> = new Map();

  constructor() {
    this.initDefaultKeys();
  }

  private initDefaultKeys() {
    // Root ECB Key (Simulated)
    const rootKey: KeyMetadata = {
      keyId: 'ecb-root-01',
      publicKey: '0xROOT_PUB_KEY',
      role: KeyRole.ROOT,
      status: KeyStatus.ACTIVE,
      ownerId: 'ECB',
      createdAt: Date.now(),
      expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000 * 10), // 10 years
    };
    this.keys.set(rootKey.keyId, rootKey);
  }

  /**
   * Register a new key in the hierarchy
   */
  public registerKey(
    metadata: Omit<KeyMetadata, 'status' | 'createdAt'>,
    authorizedBy: string
  ): KeyMetadata {
    const authorizer = this.keys.get(authorizedBy);
    
    if (!authorizer || authorizer.status !== KeyStatus.ACTIVE) {
      throw new GovernanceError('UNAUTHORIZED', 'Invalid or inactive authorizer key');
    }

    // Hierarchy enforcement: Only higher roles can authorize lower roles
    if (!this.canAuthorize(authorizer.role, metadata.role)) {
      throw new GovernanceError('ROLE_VIOLATION', `Role ${authorizer.role} cannot authorize ${metadata.role}`);
    }

    const newKey: KeyMetadata = {
      ...metadata,
      status: KeyStatus.ACTIVE,
      createdAt: Date.now(),
    };

    this.keys.set(newKey.keyId, newKey);

    logger.info('GOVERNANCE_SERVICE', 'KEY_REGISTERED', {
      keyId: newKey.keyId,
      role: newKey.role,
      ownerId: newKey.ownerId,
      authorizedBy
    });

    return newKey;
  }

  /**
   * Rotate an existing key
   */
  public rotateKey(oldKeyId: string, newPublicKey: string, authorizedBy: string): KeyMetadata {
    const oldKey = this.keys.get(oldKeyId);
    if (!oldKey) throw new GovernanceError('KEY_NOT_FOUND', 'Key not found');

    const authorizer = this.keys.get(authorizedBy);
    if (!authorizer || !this.canManage(authorizer, oldKey)) {
      throw new GovernanceError('UNAUTHORIZED', 'Not authorized to rotate this key');
    }

    oldKey.status = KeyStatus.ROTATED;
    
    const newKey: KeyMetadata = {
      ...oldKey,
      keyId: `${oldKey.keyId}-rot-${Date.now()}`,
      publicKey: newPublicKey,
      status: KeyStatus.ACTIVE,
      createdAt: Date.now(),
      parentKeyId: oldKey.keyId
    };

    this.keys.set(newKey.keyId, newKey);
    
    logger.info('GOVERNANCE_SERVICE', 'KEY_ROTATED', {
      oldKeyId,
      newKeyId: newKey.keyId,
      authorizedBy
    });

    return newKey;
  }

  /**
   * Revoke a key (e.g., due to compromise)
   */
  public revokeKey(keyId: string, reason: string, authorizedBy: string): void {
    const key = this.keys.get(keyId);
    if (!key) throw new GovernanceError('KEY_NOT_FOUND', 'Key not found');

    const authorizer = this.keys.get(authorizedBy);
    if (!authorizer || !this.canManage(authorizer, key)) {
      throw new GovernanceError('UNAUTHORIZED', 'Not authorized to revoke this key');
    }

    key.status = KeyStatus.REVOKED;
    key.revokedAt = Date.now();
    key.revocationReason = reason;

    logger.warn('GOVERNANCE_SERVICE', 'KEY_REVOKED', {
      keyId,
      reason,
      authorizedBy
    });
  }

  /**
   * Validate if a key is authorized for a specific role and operation
   */
  public validateKeyUsage(keyId: string, requiredRole: KeyRole): void {
    const key = this.keys.get(keyId);
    
    if (!key) {
      throw new GovernanceError('KEY_NOT_FOUND', 'Key not found');
    }

    if (key.status !== KeyStatus.ACTIVE) {
      throw new GovernanceError('KEY_INACTIVE', `Key status is ${key.status}`);
    }

    if (Date.now() > key.expiresAt) {
      throw new GovernanceError('KEY_EXPIRED', 'Key has expired');
    }

    // Role binding enforcement
    if (key.role !== requiredRole && !this.isHigherRole(key.role, requiredRole)) {
      throw new GovernanceError('ROLE_MISMATCH', `Key role ${key.role} does not satisfy ${requiredRole}`);
    }
  }

  private canAuthorize(authorizerRole: KeyRole, targetRole: KeyRole): boolean {
    const hierarchy = [KeyRole.ROOT, KeyRole.ISSUING, KeyRole.OPERATIONAL, KeyRole.PARTICIPANT, KeyRole.WALLET];
    const authorizerIdx = hierarchy.indexOf(authorizerRole);
    const targetIdx = hierarchy.indexOf(targetRole);
    
    // Root can authorize anything. Others can only authorize roles strictly below them.
    if (authorizerRole === KeyRole.ROOT) return true;
    return authorizerIdx < targetIdx;
  }

  private canManage(authorizer: KeyMetadata, target: KeyMetadata): boolean {
    if (authorizer.role === KeyRole.ROOT) return true;
    if (authorizer.ownerId === target.ownerId && authorizer.role === target.role) return true;
    return this.canAuthorize(authorizer.role, target.role);
  }

  private isHigherRole(role: KeyRole, requiredRole: KeyRole): boolean {
    const hierarchy = [KeyRole.ROOT, KeyRole.ISSUING, KeyRole.OPERATIONAL, KeyRole.PARTICIPANT, KeyRole.WALLET];
    return hierarchy.indexOf(role) < hierarchy.indexOf(requiredRole);
  }

  public getKey(keyId: string): KeyMetadata | undefined {
    return this.keys.get(keyId);
  }
}

export const governanceService = new GovernanceService();
