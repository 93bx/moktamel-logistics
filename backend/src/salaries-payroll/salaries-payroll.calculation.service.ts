import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface CalculationInput {
  baseSalary: number;
  monthlyTarget: number;
  ordersCount: number;
  workingDays: number;
  deductionMethod: string; // 'ORDERS_COUNT' | 'REVENUE' | 'FIXED_DEDUCTION'
  deductionTiers: any[]; // [{ from: number, to: number, deduction: number }]
  deductionPerOrder: number;
  scheduledLoanInstallments: number;
  totalBonus: number;
  totalRevenue: number;
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
    const targetDifference = input.ordersCount - input.monthlyTarget;
    let performanceDeduction = 0;
    const details: any = {
      performanceDeductionBreakdown: [],
    };

    if (targetDifference < 0) {
      const missingOrders = Math.abs(targetDifference);

      if (input.deductionMethod === 'FIXED_DEDUCTION') {
        performanceDeduction = missingOrders * input.deductionPerOrder;
        details.performanceDeductionBreakdown.push({
          type: 'FIXED_PER_ORDER',
          missingOrders,
          rate: input.deductionPerOrder,
          amount: performanceDeduction,
        });
      } else if (input.deductionMethod === 'ORDERS_COUNT' || input.deductionMethod === 'REVENUE') {
        // Use tiered deductions if available
        if (input.deductionTiers && input.deductionTiers.length > 0) {
          // Find the matching tier
          const tier = input.deductionTiers.find(
            (t) => missingOrders >= t.from && missingOrders <= t.to,
          );
          if (tier) {
            performanceDeduction = tier.deduction;
            details.performanceDeductionBreakdown.push({
              type: 'TIERED',
              missingOrders,
              tier,
              amount: performanceDeduction,
            });
          } else {
            // Check if it's beyond the last tier
            const lastTier = [...input.deductionTiers].sort((a, b) => b.to - a.to)[0];
            if (lastTier && missingOrders > lastTier.to) {
              performanceDeduction = lastTier.deduction;
              details.performanceDeductionBreakdown.push({
                type: 'TIERED_MAX',
                missingOrders,
                tier: lastTier,
                amount: performanceDeduction,
              });
            }
          }
        }
      }
    }

    const totalDeductions = performanceDeduction;
    const salaryAfterDeductions =
      input.baseSalary - totalDeductions - input.scheduledLoanInstallments + input.totalBonus;

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
          monthlyTarget: input.monthlyTarget,
          ordersCount: input.ordersCount,
          workingDays: input.workingDays,
          scheduledLoanInstallments: input.scheduledLoanInstallments,
          totalBonus: input.totalBonus,
          totalRevenue: input.totalRevenue,
          averageCost: input.averageCost,
        },
      },
    };
  }
}

