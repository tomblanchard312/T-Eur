import { rulebookParameters } from '../config/index.js';

/**
 * Fee calculation types and structures
 */
export enum FeeType {
  TRANSFER = 'transfer',
  MERCHANT_PAYMENT = 'merchant_payment',
  ATM_WITHDRAWAL = 'atm_withdrawal',
  CROSS_BORDER = 'cross_border',
  INSTANT_SETTLEMENT = 'instant_settlement',
}

export enum FeeBasis {
  BASIS_POINTS = 'basis_points', // 1/100th of 1%
  FIXED_CENTS = 'fixed_cents',
  PERCENTAGE = 'percentage',
}

export interface FeeCalculation {
  type: FeeType;
  amount: bigint; // Amount in cents
  merchantId?: string;
  merchantType?: 'retail' | 'hospitality' | 'ecommerce' | 'atm';
  isInstantSettlement?: boolean;
  isCrossBorder?: boolean;
  currency?: string;
}

export interface FeeResult {
  totalFee: bigint; // Total fee in cents
  breakdown: {
    interchangeFee: bigint;
    schemeFee: bigint;
    merchantFee: bigint;
    instantSettlementFee?: bigint;
    crossBorderFee?: bigint;
  };
  netAmount: bigint; // Amount after fees
  feeBasis: FeeBasis;
}

/**
 * Fee calculation engine for tEUR transactions
 */
export class FeeCalculationEngine {
  /**
   * Calculate fees for a transaction
   */
  calculateFee(calculation: FeeCalculation): FeeResult {
    switch (calculation.type) {
      case FeeType.TRANSFER:
        return this.calculateTransferFee(calculation);
      case FeeType.MERCHANT_PAYMENT:
        return this.calculateMerchantPaymentFee(calculation);
      case FeeType.ATM_WITHDRAWAL:
        return this.calculateATMFee(calculation);
      case FeeType.CROSS_BORDER:
        return this.calculateCrossBorderFee(calculation);
      default:
        throw new Error(`Unsupported fee type: ${calculation.type}`);
    }
  }

  /**
   * Calculate transfer fees (P2P transfers)
   */
  private calculateTransferFee(calculation: FeeCalculation): FeeResult {
    // Basic transfer fee: 0.1% (10 basis points)
    const interchangeFee = (calculation.amount * BigInt(rulebookParameters.fee_transfer_basis_points)) / BigInt(10000);
    const schemeFee = interchangeFee / BigInt(2); // Scheme takes 50% of interchange
    const merchantFee = BigInt(0); // No merchant fee for P2P

    const totalFee = interchangeFee + schemeFee;
    const netAmount = calculation.amount - totalFee;

    return {
      totalFee,
      breakdown: {
        interchangeFee,
        schemeFee,
        merchantFee,
      },
      netAmount,
      feeBasis: FeeBasis.BASIS_POINTS,
    };
  }

  /**
   * Calculate merchant payment fees
   */
  private calculateMerchantPaymentFee(calculation: FeeCalculation): FeeResult {
    if (!calculation.merchantType) {
      throw new Error('Merchant type required for merchant payment fee calculation');
    }

    // Base interchange fee varies by merchant type
    let interchangeBasisPoints: number;
    switch (calculation.merchantType) {
      case 'retail':
        interchangeBasisPoints = 150; // 1.5%
        break;
      case 'hospitality':
        interchangeBasisPoints = 120; // 1.2%
        break;
      case 'ecommerce':
        interchangeBasisPoints = 180; // 1.8%
        break;
      default:
        interchangeBasisPoints = 150; // Default 1.5%
    }

    const interchangeFee = (calculation.amount * BigInt(interchangeBasisPoints)) / BigInt(10000);
    const schemeFee = interchangeFee / BigInt(2); // Scheme takes 50%
    const merchantFee = interchangeFee / BigInt(4); // Merchant pays 25% of interchange

    let additionalFees = BigInt(0);

    // Instant settlement fee
    if (calculation.isInstantSettlement) {
      additionalFees += BigInt(50); // €0.50 fixed fee
    }

    // Cross-border fee
    if (calculation.isCrossBorder) {
      const crossBorderFee = (calculation.amount * BigInt(50)) / BigInt(10000); // 0.5%
      additionalFees += crossBorderFee;
    }

    const totalFee = interchangeFee + schemeFee + merchantFee + additionalFees;
    const netAmount = calculation.amount - totalFee;

    return {
      totalFee,
      breakdown: {
        interchangeFee,
        schemeFee,
        merchantFee,
        ...(calculation.isInstantSettlement && { instantSettlementFee: BigInt(50) }),
        ...(calculation.isCrossBorder && { crossBorderFee: (calculation.amount * BigInt(50)) / BigInt(10000) }),
      },
      netAmount,
      feeBasis: FeeBasis.BASIS_POINTS,
    };
  }

  /**
   * Calculate ATM withdrawal fees
   */
  private calculateATMFee(calculation: FeeCalculation): FeeResult {
    // ATM fees: €2.50 fixed + 1% of withdrawal amount
    const fixedFee = BigInt(250); // €2.50
    const percentageFee = (calculation.amount * BigInt(100)) / BigInt(10000); // 1%

    const totalFee = fixedFee + percentageFee;
    const netAmount = calculation.amount - totalFee;

    return {
      totalFee,
      breakdown: {
        interchangeFee: percentageFee,
        schemeFee: fixedFee / BigInt(2),
        merchantFee: fixedFee / BigInt(2),
      },
      netAmount,
      feeBasis: FeeBasis.FIXED_CENTS,
    };
  }

  /**
   * Calculate cross-border transfer fees
   */
  private calculateCrossBorderFee(calculation: FeeCalculation): FeeResult {
    // Cross-border: 0.5% + €1.00 fixed fee
    const percentageFee = (calculation.amount * BigInt(50)) / BigInt(10000); // 0.5%
    const fixedFee = BigInt(100); // €1.00

    const totalFee = percentageFee + fixedFee;
    const netAmount = calculation.amount - totalFee;

    return {
      totalFee,
      breakdown: {
        interchangeFee: percentageFee,
        schemeFee: fixedFee / BigInt(2),
        merchantFee: fixedFee / BigInt(2),
      },
      netAmount,
      feeBasis: FeeBasis.PERCENTAGE,
    };
  }

  /**
   * Get fee preview for a transaction (without executing it)
   */
  getFeePreview(calculation: FeeCalculation): FeeResult & {
    feePercentage: number;
    estimatedSettlement: Date;
  } {
    const result = this.calculateFee(calculation);

    // Calculate fee percentage
    const feePercentage = Number(result.totalFee) / Number(calculation.amount) * 100;

    // Estimate settlement time
    const estimatedSettlement = new Date();
    if (calculation.isInstantSettlement) {
      estimatedSettlement.setMinutes(estimatedSettlement.getMinutes() + 5); // 5 minutes for instant
    } else {
      estimatedSettlement.setHours(estimatedSettlement.getHours() + 24); // Next day for standard
    }

    return {
      ...result,
      feePercentage,
      estimatedSettlement,
    };
  }

  /**
   * Validate that a transaction amount meets minimum requirements after fees
   */
  validateMinimumAmount(amount: bigint, type: FeeType, merchantType?: string): boolean {
    try {
      const preview = this.getFeePreview({
        type,
        amount,
        merchantType: merchantType as any,
      });
      return preview.netAmount > BigInt(0);
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const feeEngine = new FeeCalculationEngine();