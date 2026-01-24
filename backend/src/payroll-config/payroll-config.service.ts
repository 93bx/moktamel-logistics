import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

type DeductionTier = {
  from: number;
  to: number;
  deduction: number;
};

type UpdatePayrollConfigDto = {
  calculation_method: 'ORDERS_COUNT' | 'REVENUE' | 'FIXED_DEDUCTION';
  monthly_target?: number | null;
  monthly_target_amount?: number | null;
  bonus_per_order?: number | null;
  minimum_salary?: number | null;
  unit_amount?: number | null;
  deduction_per_order?: number | null;
  deduction_tiers?: DeductionTier[] | null;
};

@Injectable()
export class PayrollConfigService {
  constructor(private readonly prisma: PrismaService) {}

  private validateDeductionTiers(
    tiers: DeductionTier[],
    method: 'ORDERS_COUNT' | 'REVENUE' | 'FIXED_DEDUCTION',
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!tiers || tiers.length === 0) {
      return { valid: true, errors: [] };
    }

    // Sort tiers by 'from' value
    const sorted = [...tiers].sort((a, b) => a.from - b.from);

    // Check each tier
    for (const tier of sorted) {
      if (tier.from > tier.to) {
        errors.push(`Range invalid: from (${tier.from}) must be <= to (${tier.to})`);
      }
      if (tier.from < 0 || tier.to < 0) {
        errors.push('Range values must be positive');
      }
      if (tier.deduction < 0) {
        errors.push('Deduction must be positive');
      }
    }

    // Check for gaps
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].to + 1 !== sorted[i + 1].from) {
        errors.push('Ranges must be continuous (no gaps)');
        break;
      }
    }

    // Check for overlaps
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].to >= sorted[i + 1].from) {
        errors.push('Ranges cannot overlap');
        break;
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async getConfig(company_id: string, year: number, month: number) {
    const config = await this.prisma.payrollConfig.findUnique({
      where: { company_id },
    });

    if (!config) {
      // Return default config
      return {
        calculation_method: 'ORDERS_COUNT' as const,
        monthly_target: null,
        monthly_target_amount: null,
        bonus_per_order: null,
        minimum_salary: 400,
        unit_amount: null,
        deduction_per_order: null,
        deduction_tiers: null,
      };
    }

    return {
      calculation_method: config.calculation_method as 'ORDERS_COUNT' | 'REVENUE' | 'FIXED_DEDUCTION',
      monthly_target: config.monthly_target,
      monthly_target_amount: config.monthly_target_amount ? Number(config.monthly_target_amount) : null,
      bonus_per_order: config.bonus_per_order ? Number(config.bonus_per_order) : null,
      minimum_salary: config.minimum_salary ? Number(config.minimum_salary) : null,
      unit_amount: config.unit_amount ? Number(config.unit_amount) : null,
      deduction_per_order: config.deduction_per_order ? Number(config.deduction_per_order) : null,
      deduction_tiers: config.deduction_tiers as DeductionTier[] | null,
    };
  }

  async updateConfig(company_id: string, user_id: string, data: UpdatePayrollConfigDto) {
    // Validate deduction tiers if provided
    if (data.deduction_tiers && data.deduction_tiers.length > 0) {
      const validation = this.validateDeductionTiers(data.deduction_tiers, data.calculation_method);
      if (!validation.valid) {
        throw new BadRequestException(`PAYROLL_CONFIG_001: ${validation.errors.join('; ')}`);
      }
    }

    const updateData: Prisma.PayrollConfigUpdateInput = {
      calculation_method: data.calculation_method,
      monthly_target: data.monthly_target ?? null,
      monthly_target_amount: data.monthly_target_amount ?? null,
      bonus_per_order: data.bonus_per_order ?? null,
      minimum_salary: data.minimum_salary ?? null,
      unit_amount: data.unit_amount ?? null,
      deduction_per_order: data.deduction_per_order ?? null,
      // For JSON fields, Prisma expects InputJsonValue / JsonNull helpers
      deduction_tiers: data.deduction_tiers
        ? (data.deduction_tiers as Prisma.InputJsonValue)
        : undefined,
      updated_at: new Date(),
    };

    const config = await this.prisma.payrollConfig.upsert({
      where: { company_id },
      update: updateData,
      create: {
        company_id,
        calculation_method: data.calculation_method,
        monthly_target: data.monthly_target ?? null,
        monthly_target_amount: data.monthly_target_amount ?? null,
        bonus_per_order: data.bonus_per_order ?? null,
        minimum_salary: data.minimum_salary ?? null,
        unit_amount: data.unit_amount ?? null,
        deduction_per_order: data.deduction_per_order ?? null,
        deduction_tiers: data.deduction_tiers
          ? (data.deduction_tiers as Prisma.InputJsonValue)
          : undefined,
        created_by_user_id: user_id,
      },
    });

    return {
      calculation_method: config.calculation_method as 'ORDERS_COUNT' | 'REVENUE' | 'FIXED_DEDUCTION',
      monthly_target: config.monthly_target,
      monthly_target_amount: config.monthly_target_amount ? Number(config.monthly_target_amount) : null,
      bonus_per_order: config.bonus_per_order ? Number(config.bonus_per_order) : null,
      minimum_salary: config.minimum_salary ? Number(config.minimum_salary) : null,
      unit_amount: config.unit_amount ? Number(config.unit_amount) : null,
      deduction_per_order: config.deduction_per_order ? Number(config.deduction_per_order) : null,
      deduction_tiers: config.deduction_tiers as DeductionTier[] | null,
    };
  }

  async getStats(company_id: string, year: number, month: number) {
    // Calculate month boundaries
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    // Active employees count (active during selected month)
    const activeEmployees = await this.prisma.employmentRecord.count({
      where: {
        company_id,
        deleted_at: null,
        status_code: 'EMPLOYMENT_STATUS_ACTIVE',
        OR: [
          { start_date_at: null }, // Started before tracking
          { start_date_at: { lte: endDate } }, // Started before/within month
        ],
      },
    });

    // Total costs: sum of net_amount across all non-deleted costs (global per company)
    const costsAgg = await this.prisma.cost.aggregate({
      where: {
        company_id,
        is_deleted: false,
      },
      _sum: {
        net_amount: true,
      },
    });

    const totalCosts = Number(costsAgg._sum.net_amount ?? 0);

    // Average cost: totalCosts / activeEmployees
    const averageCost = activeEmployees > 0 ? totalCosts / activeEmployees : 0;

    return {
      activeEmployees,
      totalCosts,
      averageCost,
    };
  }
}


