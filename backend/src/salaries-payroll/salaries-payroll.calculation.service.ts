import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface CalculationInput {
  baseSalary: number;
  targetType: string; // 'TARGET_TYPE_ORDERS' | 'TARGET_TYPE_REVENUE'
  monthlyOrdersTarget: number;
  monthlyRevenueTarget: number;
  ordersCount: number;
  totalRevenue: number;
  workingDays: number;
  deductionType: string; // 'DEDUCTION_FIXED' | 'DEDUCTION_ORDERS_TIERS' | 'DEDUCTION_REVENUE_TIERS'
  ordersTiers: any[];
  revenueTiers: any[];
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
        // Fixed deduction only applies to orders
        if (input.targetType === 'TARGET_TYPE_ORDERS') {
          performanceDeduction = missingAmount * input.deductionPerOrder;
          details.performanceDeductionBreakdown.push({
            type: 'FIXED_PER_ORDER',
            missingOrders: missingAmount,
            rate: input.deductionPerOrder,
            amount: performanceDeduction,
          });
        }
      } else if (input.deductionType === 'DEDUCTION_ORDERS_TIERS') {
        const tiers = input.ordersTiers || [];
        const tier = tiers.find(
          (t) => missingAmount >= t.from && missingAmount <= t.to,
        );
        if (tier) {
          performanceDeduction = tier.deduction;
          details.performanceDeductionBreakdown.push({
            type: 'ORDERS_TIERED',
            missingOrders: missingAmount,
            tier,
            amount: performanceDeduction,
          });
        } else {
          const lastTier = [...tiers].sort((a, b) => b.to - a.to)[0];
          if (lastTier && missingAmount > lastTier.to) {
            performanceDeduction = lastTier.deduction;
            details.performanceDeductionBreakdown.push({
              type: 'ORDERS_TIERED_MAX',
              missingOrders: missingAmount,
              tier: lastTier,
              amount: performanceDeduction,
            });
          }
        }
      } else if (input.deductionType === 'DEDUCTION_REVENUE_TIERS') {
        const tiers = input.revenueTiers || [];
        const tier = tiers.find(
          (t) => missingAmount >= t.from && missingAmount <= t.to,
        );
        if (tier) {
          performanceDeduction = tier.deduction;
          details.performanceDeductionBreakdown.push({
            type: 'REVENUE_TIERED',
            missingRevenue: missingAmount,
            tier,
            amount: performanceDeduction,
          });
        } else {
          const lastTier = [...tiers].sort((a, b) => b.to - a.to)[0];
          if (lastTier && missingAmount > lastTier.to) {
            performanceDeduction = lastTier.deduction;
            details.performanceDeductionBreakdown.push({
              type: 'REVENUE_TIERED_MAX',
              missingRevenue: missingAmount,
              tier: lastTier,
              amount: performanceDeduction,
            });
          }
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
