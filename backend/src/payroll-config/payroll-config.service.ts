import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

type DeductionTier = {
  from: number;
  to: number;
  deduction: number;
};

type UpdatePayrollConfigDto = {
  minimum_salary?: number | null;
  bonus_per_order?: number | null;
  deduction_per_order?: number | null;
  orders_deduction_tiers?: DeductionTier[] | null;
  revenue_deduction_tiers?: DeductionTier[] | null;
  revenue_unit_amount?: number | null;
};

@Injectable()
export class PayrollConfigService {
  constructor(private readonly prisma: PrismaService) {}

  private validateDeductionTiers(
    tiers: DeductionTier[],
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
        errors.push(
          `Range invalid: from (${tier.from}) must be <= to (${tier.to})`,
        );
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
        minimum_salary: 400,
        bonus_per_order: null,
        deduction_per_order: null,
        orders_deduction_tiers: null,
        revenue_deduction_tiers: null,
        revenue_unit_amount: null,
      };
    }

    return {
      minimum_salary: config.minimum_salary
        ? Number(config.minimum_salary)
        : null,
      bonus_per_order: config.bonus_per_order
        ? Number(config.bonus_per_order)
        : null,
      deduction_per_order: config.deduction_per_order
        ? Number(config.deduction_per_order)
        : null,
      orders_deduction_tiers: config.orders_deduction_tiers as DeductionTier[] | null,
      revenue_deduction_tiers: config.revenue_deduction_tiers as DeductionTier[] | null,
      revenue_unit_amount: config.revenue_unit_amount
        ? Number(config.revenue_unit_amount)
        : null,
    };
  }

  async updateConfig(
    company_id: string,
    user_id: string,
    data: UpdatePayrollConfigDto,
  ) {
    // Validate orders deduction tiers if provided
    if (data.orders_deduction_tiers && data.orders_deduction_tiers.length > 0) {
      const validation = this.validateDeductionTiers(data.orders_deduction_tiers);
      if (!validation.valid) {
        throw new BadRequestException(
          `PAYROLL_CONFIG_001: Orders tiers - ${validation.errors.join('; ')}`,
        );
      }
    }

    // Validate revenue deduction tiers if provided
    if (data.revenue_deduction_tiers && data.revenue_deduction_tiers.length > 0) {
      const validation = this.validateDeductionTiers(data.revenue_deduction_tiers);
      if (!validation.valid) {
        throw new BadRequestException(
          `PAYROLL_CONFIG_001: Revenue tiers - ${validation.errors.join('; ')}`,
        );
      }
    }

    const updateData: Prisma.PayrollConfigUpdateInput = {
      minimum_salary: data.minimum_salary ?? null,
      bonus_per_order: data.bonus_per_order ?? null,
      deduction_per_order: data.deduction_per_order ?? null,
      orders_deduction_tiers: data.orders_deduction_tiers
        ? (data.orders_deduction_tiers as Prisma.InputJsonValue)
        : undefined,
      revenue_deduction_tiers: data.revenue_deduction_tiers
        ? (data.revenue_deduction_tiers as Prisma.InputJsonValue)
        : undefined,
      revenue_unit_amount: data.revenue_unit_amount ?? null,
      updated_at: new Date(),
    };

    const config = await this.prisma.payrollConfig.upsert({
      where: { company_id },
      update: updateData,
      create: {
        company_id,
        minimum_salary: data.minimum_salary ?? null,
        bonus_per_order: data.bonus_per_order ?? null,
        deduction_per_order: data.deduction_per_order ?? null,
        orders_deduction_tiers: data.orders_deduction_tiers
          ? (data.orders_deduction_tiers as Prisma.InputJsonValue)
          : undefined,
        revenue_deduction_tiers: data.revenue_deduction_tiers
          ? (data.revenue_deduction_tiers as Prisma.InputJsonValue)
          : undefined,
        revenue_unit_amount: data.revenue_unit_amount ?? null,
        created_by_user_id: user_id,
      },
    });

    return {
      minimum_salary: config.minimum_salary
        ? Number(config.minimum_salary)
        : null,
      bonus_per_order: config.bonus_per_order
        ? Number(config.bonus_per_order)
        : null,
      deduction_per_order: config.deduction_per_order
        ? Number(config.deduction_per_order)
        : null,
      orders_deduction_tiers: config.orders_deduction_tiers as DeductionTier[] | null,
      revenue_deduction_tiers: config.revenue_deduction_tiers as DeductionTier[] | null,
      revenue_unit_amount: config.revenue_unit_amount
        ? Number(config.revenue_unit_amount)
        : null,
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
