import { ethers } from 'ethers';
import { blockchainService, WalletType } from './blockchain.js';
import { auditService } from './audit.js';
import { logAuditEvent, logger } from '../utils/logger.js';
import { rulebookParameters } from '../config/index.js';

/**
 * Merchant onboarding status
 */
export enum MerchantStatus {
  PENDING = 'pending',
  UNDER_REVIEW = 'under_review',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  SUSPENDED = 'suspended',
  ACTIVE = 'active',
}

/**
 * Merchant types
 */
export enum MerchantType {
  RETAIL = 'retail',
  HOSPITALITY = 'hospitality',
  ECOMMERCE = 'ecommerce',
  PROFESSIONAL_SERVICES = 'professional_services',
  HEALTHCARE = 'healthcare',
  EDUCATION = 'education',
  GOVERNMENT = 'government',
}

/**
 * Merchant profile (Operational data only)
 * ECB Alignment: Data minimization - separate PII from operational profile.
 */
export interface MerchantProfile {
  id: string;
  businessType: MerchantType;
  settlementAccount: string; // Linked PSP/bank account
  walletAddress: string;
  status: MerchantStatus;
  kycStatus: 'pending' | 'approved' | 'rejected';
  riskScore: number;
  monthlyVolume: bigint;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date;
  approvedBy?: string;
}

/**
 * Merchant PII (Stored separately, access-controlled)
 * ECB Alignment: Purpose limitation - PII only used for onboarding and compliance.
 */
export interface MerchantPII {
  merchantId: string;
  businessName: string;
  businessRegistrationNumber: string;
  taxId: string;
  businessAddress: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  contactInfo: {
    email: string;
    phone: string;
    website?: string;
  };
}

/**
 * Merchant onboarding application
 */
export interface MerchantApplication {
  businessName: string;
  businessRegistrationNumber: string;
  taxId: string;
  businessAddress: {
    street: string;
    city: string;
    postalCode: string;
    country: string;
  };
  contactInfo: {
    email: string;
    phone: string;
    website?: string;
  };
  businessType: MerchantType;
  settlementAccount: string;
  walletAddress: string;
  documents: {
    businessRegistration: string; // IPFS hash or document ID
    taxCertificate: string;
    bankStatement: string;
    identityVerification: string;
  };
  termsAccepted: boolean;
  privacyPolicyAccepted: boolean;
}

/**
 * Merchant onboarding service
 */
export class MerchantOnboardingService {
  private merchants = new Map<string, MerchantProfile>();
  private merchantPII = new Map<string, MerchantPII>();

  /**
   * Submit merchant onboarding application
   */
  async submitApplication(
    application: MerchantApplication,
    correlationId: string,
    userId: string
  ): Promise<{ applicationId: string; status: MerchantStatus }> {
    // Validate application
    this.validateApplication(application);

    // Generate application ID
    const applicationId = `merchant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create merchant profile (Operational data)
    const profile: MerchantProfile = {
      id: applicationId,
      businessType: application.businessType,
      settlementAccount: application.settlementAccount,
      walletAddress: application.walletAddress,
      status: MerchantStatus.PENDING,
      kycStatus: 'pending',
      riskScore: 0,
      monthlyVolume: BigInt(0),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Create merchant PII (Separated)
    const pii: MerchantPII = {
      merchantId: applicationId,
      businessName: application.businessName,
      businessRegistrationNumber: application.businessRegistrationNumber,
      taxId: application.taxId,
      businessAddress: application.businessAddress,
      contactInfo: application.contactInfo,
    };

    // Store data
    this.merchants.set(applicationId, profile);
    this.merchantPII.set(applicationId, pii);

    // Register wallet if not already registered
    try {
      await blockchainService.registerWallet(
        application.walletAddress,
        WalletType.MERCHANT,
        application.settlementAccount,
        ethers.keccak256(ethers.toUtf8Bytes(applicationId)), // Use application ID as KYC hash for now
        correlationId,
        userId
      );
    } catch (error) {
      // Log error but don't fail application submission
      // OWASP: Security Logging and Monitoring - Log internal errors with structured context
      logger.error('MERCHANT_SERVICE', 'INTERNAL_SERVER_ERROR', { 
        errorCode: String(error), 
        resourceId: applicationId 
      });
    }

    // Audit log
    await auditService.logComplianceEvent(
      correlationId,
      userId,
      {
        checkType: 'kyc',
        result: 'review_required',
        details: {
          merchantId: applicationId,
          businessType: application.businessType,
          country: application.businessAddress.country,
        },
      }
    );

    await logAuditEvent({
      action: 'MERCHANT_APPLICATION_SUBMITTED',
      actor: userId,
      resource: 'merchant',
      resourceId: applicationId,
      details: {
        businessName: application.businessName,
        businessType: application.businessType,
        country: application.businessAddress.country,
      },
      result: 'success',
    });

    return {
      applicationId,
      status: MerchantStatus.PENDING,
    };
  }

  /**
   * Review merchant application
   */
  async reviewApplication(
    applicationId: string,
    decision: 'approve' | 'reject',
    reviewerId: string,
    notes?: string,
    correlationId?: string,
    userId?: string
  ): Promise<void> {
    const profile = this.merchants.get(applicationId);
    const pii = this.merchantPII.get(applicationId);
    if (!profile || !pii) {
      throw new Error('Merchant application not found');
    }

    if (decision === 'approve') {
      profile.status = MerchantStatus.APPROVED;
      profile.kycStatus = 'approved';
      profile.approvedAt = new Date();
      profile.approvedBy = reviewerId;
      profile.riskScore = this.calculateRiskScore(profile, pii);
    } else {
      profile.status = MerchantStatus.REJECTED;
      profile.kycStatus = 'rejected';
    }

    profile.updatedAt = new Date();

    // Audit log
    await auditService.logComplianceEvent(
      correlationId || `review-${Date.now()}`,
      userId || reviewerId,
      {
        checkType: 'kyc',
        result: decision === 'approve' ? 'pass' : 'fail',
        details: {
          merchantId: applicationId,
          decision,
          reviewerId,
          notes,
          riskScore: profile.riskScore,
        },
      }
    );

    await logAuditEvent({
      action: 'MERCHANT_APPLICATION_REVIEWED',
      actor: userId || reviewerId,
      resource: 'merchant',
      resourceId: applicationId,
      details: {
        decision,
        reviewerId,
        notes,
        newStatus: profile.status,
        riskScore: profile.riskScore,
      },
      result: 'success',
    });
  }

  /**
   * Get merchant profile
   */
  getMerchantProfile(merchantId: string): MerchantProfile | null {
    return this.merchants.get(merchantId) || null;
  }

  /**
   * Get merchant PII (Restricted access)
   * ECB Alignment: Purpose limitation - PII only accessible for compliance/admin.
   */
  getMerchantPII(merchantId: string): MerchantPII | null {
    return this.merchantPII.get(merchantId) || null;
  }

  /**
   * List merchants with filtering
   */
  listMerchants(filters?: {
    status?: MerchantStatus;
    businessType?: MerchantType;
    country?: string;
    limit?: number;
    offset?: number;
  }): MerchantProfile[] {
    let merchants = Array.from(this.merchants.values());

    if (filters?.status) {
      merchants = merchants.filter(m => m.status === filters.status);
    }

    if (filters?.businessType) {
      merchants = merchants.filter(m => m.businessType === filters.businessType);
    }

    if (filters?.country) {
      // Need to join with PII for country filter
      merchants = merchants.filter(m => {
        const pii = this.merchantPII.get(m.id);
        return pii?.businessAddress.country === filters.country;
      });
    }

    // Apply pagination
    const limit = filters?.limit || 50;
    const offset = filters?.offset || 0;

    return merchants
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(offset, offset + limit);
  }

  /**
   * Update merchant monthly volume (for risk monitoring)
   */
  async updateMonthlyVolume(merchantId: string, volume: bigint): Promise<void> {
    const profile = this.merchants.get(merchantId);
    if (!profile) {
      throw new Error('Merchant not found');
    }

    profile.monthlyVolume = volume;
    profile.updatedAt = new Date();

    // Check for suspicious activity - threshold from governance parameters
    if (volume > BigInt(rulebookParameters.suspicious_volume_threshold_cents)) {
      await auditService.logSecurityEvent(
        `volume-check-${Date.now()}`,
        undefined,
        {
          threatType: 'suspicious_activity',
          severity: 'medium',
          source: 'merchant_volume_monitoring',
          details: {
            merchantId,
            volume: volume.toString(),
            threshold: rulebookParameters.suspicious_volume_threshold_cents.toString(),
          },
        }
      );
    }
  }

  /**
   * Validate merchant application
   */
  private validateApplication(application: MerchantApplication): void {
    if (!application.businessName?.trim()) {
      throw new Error('Business name is required');
    }

    if (!application.businessRegistrationNumber?.trim()) {
      throw new Error('Business registration number is required');
    }

    if (!application.taxId?.trim()) {
      throw new Error('Tax ID is required');
    }

    if (!application.contactInfo?.email?.includes('@')) {
      throw new Error('Valid email is required');
    }

    if (!application.settlementAccount?.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new Error('Valid settlement account address is required');
    }

    if (!application.walletAddress?.match(/^0x[a-fA-F0-9]{40}$/)) {
      throw new Error('Valid wallet address is required');
    }

    if (!application.termsAccepted || !application.privacyPolicyAccepted) {
      throw new Error('Terms and privacy policy must be accepted');
    }
  }

  /**
   * Calculate risk score for merchant (simplified version)
   */
  private calculateRiskScore(profile: MerchantProfile, pii: MerchantPII): number {
    let score = 50; // Base score

    // Business type risk adjustment
    switch (profile.businessType) {
      case MerchantType.RETAIL:
        score -= 10; // Lower risk
        break;
      case MerchantType.ECOMMERCE:
        score += 5; // Slightly higher risk
        break;
      case MerchantType.HOSPITALITY:
        score -= 5; // Lower risk
        break;
    }

    // Country risk - loaded from governance parameters
    const highRiskCountries = rulebookParameters.high_risk_countries;
    if (highRiskCountries.includes(pii.businessAddress.country)) {
      score += 20;
    }

    return Math.max(0, Math.min(100, score));
  }
}

// Export singleton instance
export const merchantService = new MerchantOnboardingService();