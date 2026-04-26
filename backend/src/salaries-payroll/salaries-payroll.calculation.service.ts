import { Injectable } from '@nestjs/common';
import {
  DeductionTier,
  sortTiersAscending,
  sortTiersDescending,
} from '../common/payroll-tier-constants';

export interface CalculationInput {
  baseSalary: number;
  targetType: string; // 'TARGET_TYPE_ORDERS' | 'TARGET_TYPE_REVENUE'
  monthlyOrdersTarget: number;
  monthlyRevenueTarget: number;
  ordersCount: number;
  totalRevenue: number;
  workingDays: number;
  deductionType: string; // 'DEDUCTION_FIXED' | 'DEDUCTION_ORDERS_TIERS' | 'DEDUCTION_REVENUE_TIERS'
  ordersTiers: DeductionTier[];
  revenueTiers: DeductionTier[];
  /** SAR width for one “unit” of revenue shortfall (divisor for progressive deduction). */
  revenueUnitAmount?: number;
  deductionPerOrder: number;
  scheduledLoanInstallments: number;
  totalBonus: number;
  averageCost: number;
}

export interface CalculationOutput {
  targetDifference: number;
  totalDeductions: number;
  salaryAfterDeductions: number;
  isBelowAverageCost: boolean;
  calculationDetails: any;
}

@Injectable()
export class SalariesPayrollCalculationService {
  /**
   * Progressive stacking deduction calculator.
   * Walks through tiers sequentially, applying each tier's rate to the portion
   * of deficit that falls within that tier's range.
   *
   * @param deficit - Total missing amount (orders or revenue)
   * @param tiers - Sorted array of deduction tiers
   * @param isRevenue - Whether this is revenue (true) or orders (false)
   * @returns Total deduction amount and breakdown
   */
  private computeProgressiveDeduction(
    deficit: number,
    tiers: DeductionTier[],
  ): { amount: number; breakdown: any[] } {
    const sorted = sortTiersAscending(tiers);
    let totalDeduction = 0;
    let remainingDeficit = deficit;
    const breakdown: any[] = [];

    for (const tier of sorted) {
      if (remainingDeficit <= 0) break;

      const tierWidth = tier.to - tier.from + 1;
      const applicableAmount = Math.min(remainingDeficit, tierWidth);

      // Apply the tier's rate to the applicable portion
      const tierDeduction = applicableAmount * tier.deduction;
      totalDeduction += tierDeduction;

      breakdown.push({
        tier: { from: tier.from, to: tier.to, rate: tier.deduction },
        applicableAmount,
        tierDeduction,
      });

      remainingDeficit -= applicableAmount;
    }

    // If deficit exceeds all tiers, continue applying the last tier's rate
    if (remainingDeficit > 0 && sorted.length > 0) {
      const lastTier = sorted[sorted.length - 1];
      const excessDeduction = remainingDeficit * lastTier.deduction;
      totalDeduction += excessDeduction;

      breakdown.push({
        tier: {
          from: lastTier.to + 1,
          to: 'infinity',
          rate: lastTier.deduction,
        },
        applicableAmount: remainingDeficit,
        tierDeduction: excessDeduction,
        note: 'Excess beyond defined tiers',
      });
    }

    return { amount: totalDeduction, breakdown };
  }

  /**
   * Revenue shortfall: consume `deficit` SAR sequentially from the highest band (`from`) downward;
   * each band takes min(remaining, band width); deduction = (applicable / unitAmount) × tier.deduction.
   * Breakdown rows follow descending `from`. Overflow beyond all bands uses the strictest band (from === 1).
   */
  private computeRevenueProgressiveUnitDeduction(
    deficit: number,
    tiers: DeductionTier[],
    unitAmount: number,
  ): { amount: number; breakdown: any[] } {
    if (deficit <= 0 || tiers.length === 0 || unitAmount <= 0) {
      return { amount: 0, breakdown: [] };
    }

    const sortedAsc = sortTiersAscending(tiers);
    const sortedDesc = sortTiersDescending(tiers);
    const strictest = sortedAsc[0];
    let remaining = deficit;
    let totalDeduction = 0;
    const breakdown: any[] = [];

    for (const tier of sortedDesc) {
      if (remaining <= 0) break;

      const tierWidth = tier.to - tier.from + 1;
      const applicableAmount = Math.min(remaining, tierWidth);
      const units = applicableAmount / unitAmount;
      const tierDeduction = units * tier.deduction;
      totalDeduction += tierDeduction;
      remaining -= applicableAmount;

      breakdown.push({
        tier: {
          from: tier.from,
          to: tier.to,
          deductionPerUnit: tier.deduction,
        },
        applicableAmount,
        unitAmount,
        units,
        tierDeduction,
      });
    }

    if (remaining > 0 && strictest) {
      const excessUnits = remaining / unitAmount;
      const excessDeduction = excessUnits * strictest.deduction;
      totalDeduction += excessDeduction;

      breakdown.push({
        tier: {
          from: strictest.from,
          to: 'infinity',
          deductionPerUnit: strictest.deduction,
        },
        applicableAmount: remaining,
        unitAmount,
        units: excessUnits,
        tierDeduction: excessDeduction,
        note: 'Excess beyond defined tiers',
      });
    }

    return { amount: totalDeduction, breakdown };
  }

  calculate(input: CalculationInput): CalculationOutput {
    let targetDifference = 0;
    let performanceDeduction = 0;
    const details: any = {
      performanceDeductionBreakdown: [],
    };

    // Calculate gap based on target type
    if (input.targetType === 'TARGET_TYPE_ORDERS') {
      targetDifference = input.ordersCount - input.monthlyOrdersTarget;
    } else if (input.targetType === 'TARGET_TYPE_REVENUE') {
      targetDifference = input.totalRevenue - input.monthlyRevenueTarget;
    }

    if (targetDifference < 0) {
      const missingAmount = Math.abs(targetDifference);

      if (input.deductionType === 'DEDUCTION_FIXED') {
        // Fixed deduction: simple rate × missing amount (orders only)
        if (input.targetType === 'TARGET_TYPE_ORDERS') {
          performanceDeduction = missingAmount * input.deductionPerOrder;
          details.performanceDeductionBreakdown.push({
            type: 'FIXED_PER_ORDER',
            missingOrders: missingAmount,
            rate: input.deductionPerOrder,
            amount: performanceDeduction,
          });
        }
        // Revenue + FIXED: not supported, deduction remains 0
      } else if (input.deductionType === 'DEDUCTION_ORDERS_TIERS') {
        // Progressive stacking for orders
        const tiers = input.ordersTiers || [];
        if (tiers.length > 0) {
          const result = this.computeProgressiveDeduction(missingAmount, tiers);
          performanceDeduction = result.amount;
          details.performanceDeductionBreakdown.push({
            type: 'ORDERS_PROGRESSIVE',
            missingOrders: missingAmount,
            breakdown: result.breakdown,
            amount: performanceDeduction,
          });
        }
      } else if (input.deductionType === 'DEDUCTION_REVENUE_TIERS') {
        const tiers = input.revenueTiers || [];
        const unitFromInput =
          input.revenueUnitAmount != null && input.revenueUnitAmount > 0
            ? input.revenueUnitAmount
            : 0;
        if (tiers.length > 0 && unitFromInput > 0) {
          const result = this.computeRevenueProgressiveUnitDeduction(
            missingAmount,
            tiers,
            unitFromInput,
          );
          performanceDeduction = result.amount;
          details.performanceDeductionBreakdown.push({
            type: 'REVENUE_PROGRESSIVE_UNITS',
            missingRevenue: missingAmount,
            unitAmount: unitFromInput,
            breakdown: result.breakdown,
            amount: performanceDeduction,
          });
        }
      }
    }

    const totalDeductions = performanceDeduction;
    const salaryAfterDeductions =
      input.baseSalary -
      totalDeductions -
      input.scheduledLoanInstallments +
      input.totalBonus;

    const isBelowAverageCost = input.totalRevenue < input.averageCost;

    return {
      targetDifference,
      totalDeductions,
      salaryAfterDeductions: Math.max(0, salaryAfterDeductions),
      isBelowAverageCost,
      calculationDetails: {
        ...details,
        inputs: {
          baseSalary: input.baseSalary,
          targetType: input.targetType,
          monthlyOrdersTarget: input.monthlyOrdersTarget,
          monthlyRevenueTarget: input.monthlyRevenueTarget,
          ordersCount: input.ordersCount,
          totalRevenue: input.totalRevenue,
          workingDays: input.workingDays,
          scheduledLoanInstallments: input.scheduledLoanInstallments,
          totalBonus: input.totalBonus,
          averageCost: input.averageCost,
        },
      },
    };
  }
}
