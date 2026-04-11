import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SalariesPayrollService } from '../salaries-payroll/salaries-payroll.service';
import {
  NotificationsService,
  PAYROLL_MONTH_APPROVAL_DEADLINE_SOON,
} from '../notifications/notifications.service';
import { Prisma } from '@prisma/client';
import { getKSAMonthBounds, getCurrentKSAMonth } from '../common/ksa-month';
import {
  DeductionTier,
  validateOrdersTiersStructure,
  validateRevenueTiersStructure,
} from '../common/payroll-tier-constants';

type UpdatePayrollConfigDto = {
  minimum_salary?: number | null;
  tip_recipient?: string | null;
  count_bonus_enabled?: boolean | null;
  count_bonus_amount?: number | null;
  revenue_bonus_enabled?: boolean | null;
  revenue_bonus_amount?: number | null;
  deduction_per_order?: number | null;
  orders_deduction_tiers?: DeductionTier[] | null;
  revenue_deduction_tiers?: DeductionTier[] | null;
  revenue_unit_amount?: number | null;
};

type ConfigurationStatus = {
  general: 'COMPLETE' | 'INCOMPLETE';
  fixed: 'COMPLETE' | 'INCOMPLETE';
  ordersTiers: 'COMPLETE' | 'INCOMPLETE';
  revenueTiers: 'COMPLETE' | 'INCOMPLETE';
};

@Injectable()
export class PayrollConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly salariesPayroll: SalariesPayrollService,
  ) {}

  /**
   * Build a snapshot object from the current PayrollConfig row.
   * This snapshot is stored in PayrollRun when approved.
   */
  private buildConfigSnapshot(config: any): any {
    return {
      schemaVersion: 1,
      minimum_salary: config.minimum_salary ? Number(config.minimum_salary) : null,
      tip_recipient: config.tip_recipient || 'REPRESENTATIVE',
      count_bonus_enabled: config.count_bonus_enabled || false,
      count_bonus_amount: config.count_bonus_amount ? Number(config.count_bonus_amount) : null,
      revenue_bonus_enabled: config.revenue_bonus_enabled || false,
      revenue_bonus_amount: config.revenue_bonus_amount ? Number(config.revenue_bonus_amount) : null,
      deduction_per_order: config.deduction_per_order ? Number(config.deduction_per_order) : null,
      orders_deduction_tiers: config.orders_deduction_tiers as DeductionTier[] | null,
      revenue_deduction_tiers: config.revenue_deduction_tiers as DeductionTier[] | null,
      revenue_unit_amount: config.revenue_unit_amount ? Number(config.revenue_unit_amount) : null,
      snapshotAt: new Date().toISOString(),
    };
  }

  /**
   * Check configuration completeness for approval validation.
   */
  private checkConfigurationStatus(config: any): ConfigurationStatus {
    const general =
      config.minimum_salary &&
      config.tip_recipient &&
      (!config.count_bonus_enabled || config.count_bonus_amount) &&
      (!config.revenue_bonus_enabled || config.revenue_bonus_amount)
        ? 'COMPLETE'
        : 'INCOMPLETE';

    const fixed = config.deduction_per_order ? 'COMPLETE' : 'INCOMPLETE';

    const ordersTiers = validateOrdersTiersStructure(config.orders_deduction_tiers)
      ? 'COMPLETE'
      : 'INCOMPLETE';

    const revenueTiers = validateRevenueTiersStructure(
      config.revenue_deduction_tiers,
      config.revenue_unit_amount,
    )
      ? 'COMPLETE'
      : 'INCOMPLETE';

    return { general, fixed, ordersTiers, revenueTiers };
  }

  async getConfig(company_id: string, year: number, month: number) {
    const { start: monthStart } = getKSAMonthBounds(year, month);
    const currentKSA = getCurrentKSAMonth();
    const currentMonthStart = getKSAMonthBounds(currentKSA.year, currentKSA.month).start;

    const isPastMonth = monthStart < currentMonthStart;
    const isCurrentMonth = monthStart.getTime() === currentMonthStart.getTime();

    // Fetch live config
    const liveConfig = await this.prisma.payrollConfig.findUnique({
      where: { company_id },
    });

    // Fetch run for the requested month
    const run = await this.prisma.payrollRun.findUnique({
      where: { company_id_month: { company_id, month: monthStart } },
    });

    // Fetch current month's run (for warning logic)
    let currentMonthRun = null;
    if (!isCurrentMonth) {
      currentMonthRun = await this.prisma.payrollRun.findUnique({
        where: { company_id_month: { company_id, month: currentMonthStart } },
      });
    }

    let configData: any;
    let source: string;
    let isReadOnly = false;

    if (isPastMonth) {
      // Past month: use snapshot if locked, else fallback to last approved
      if (run && run.status === 'LOCKED' && run.config_snapshot) {
        configData = run.config_snapshot;
        source = 'SNAPSHOT';
        isReadOnly = true;
      } else {
        // Find last locked run before this month
        const lastLocked = await this.prisma.payrollRun.findFirst({
          where: {
            company_id,
            month: { lt: monthStart },
            status: 'LOCKED',
          },
          orderBy: { month: 'desc' },
        });

        if (lastLocked && lastLocked.config_snapshot) {
          configData = lastLocked.config_snapshot;
          source = 'FALLBACK_PREVIOUS_LOCK';
          isReadOnly = true;
        } else {
          configData = liveConfig || this.getDefaultConfig();
          source = 'LIVE_FALLBACK';
          isReadOnly = true;
        }
      }
    } else {
      // Current or future month: use live config
      configData = liveConfig || this.getDefaultConfig();
      source = 'LIVE';
      isReadOnly = false;
    }

    // Build response
    const response: any = {
      minimum_salary: configData.minimum_salary ? Number(configData.minimum_salary) : null,
      tip_recipient: configData.tip_recipient || 'REPRESENTATIVE',
      count_bonus_enabled: configData.count_bonus_enabled || false,
      count_bonus_amount: configData.count_bonus_amount ? Number(configData.count_bonus_amount) : null,
      revenue_bonus_enabled: configData.revenue_bonus_enabled || false,
      revenue_bonus_amount: configData.revenue_bonus_amount ? Number(configData.revenue_bonus_amount) : null,
      deduction_per_order: configData.deduction_per_order ? Number(configData.deduction_per_order) : null,
      orders_deduction_tiers: configData.orders_deduction_tiers as DeductionTier[] | null,
      revenue_deduction_tiers: configData.revenue_deduction_tiers as DeductionTier[] | null,
      revenue_unit_amount: configData.revenue_unit_amount ? Number(configData.revenue_unit_amount) : null,
      metadata: {
        source,
        isReadOnly,
        runLockedForMonth: run?.status === 'LOCKED',
        currentMonthLocked: currentMonthRun?.status === 'LOCKED',
      },
    };

    // Add configuration status
    if (liveConfig) {
      response.metadata.configurationStatus = this.checkConfigurationStatus(liveConfig);
    }

    // Warning: applies next month if current month is locked and live differs from snapshot
    if (isCurrentMonth && currentMonthRun?.status === 'LOCKED' && currentMonthRun.config_snapshot) {
      const snapshot = currentMonthRun.config_snapshot as any;
      const hasChanges = JSON.stringify(this.buildConfigSnapshot(liveConfig)) !== JSON.stringify(snapshot);
      response.metadata.warningAppliesNextMonth = hasChanges;
    }

    if (isCurrentMonth) {
      const { end } = getKSAMonthBounds(year, month);
      const msLeft = end.getTime() - Date.now();
      const daysUntilMonthEnd = Math.max(0, Math.ceil(msLeft / 86_400_000));
      response.metadata.daysUntilMonthEnd = daysUntilMonthEnd;
      const runLocked = run?.status === 'LOCKED';
      response.metadata.payrollApprovalDeadlineWarning =
        daysUntilMonthEnd < 7 && !runLocked;

      if (response.metadata.payrollApprovalDeadlineWarning) {
        void this.notifications
          .ensurePayrollMonthApprovalReminder({
            company_id,
            year,
            month,
            days_remaining: daysUntilMonthEnd,
          })
          .catch(() => undefined);
      }
    }

    return response;
  }

  private getDefaultConfig() {
    return {
      minimum_salary: 400,
      tip_recipient: 'REPRESENTATIVE',
      count_bonus_enabled: false,
      count_bonus_amount: null,
      revenue_bonus_enabled: false,
      revenue_bonus_amount: null,
      deduction_per_order: null,
      orders_deduction_tiers: null,
      revenue_deduction_tiers: null,
      revenue_unit_amount: null,
    };
  }

  async updateConfig(
    company_id: string,
    user_id: string,
    data: UpdatePayrollConfigDto,
  ) {
    // Validate orders deduction tiers if provided
    if (data.orders_deduction_tiers !== undefined && data.orders_deduction_tiers !== null) {
      if (!validateOrdersTiersStructure(data.orders_deduction_tiers)) {
        throw new BadRequestException(
          'PAYROLL_CONFIG_001: Orders tiers must match the fixed structure (5 tiers: 1-50, 51-100, 101-150, 151-200, 201-250)',
        );
      }
    }

    // Validate revenue deduction tiers if provided
    if (data.revenue_deduction_tiers !== undefined && data.revenue_deduction_tiers !== null) {
      if (!validateRevenueTiersStructure(data.revenue_deduction_tiers, data.revenue_unit_amount)) {
        throw new BadRequestException(
          'PAYROLL_CONFIG_001: Revenue tiers must match the unit amount structure (5 consecutive tiers)',
        );
      }
    }

    const updateData: Prisma.PayrollConfigUpdateInput = {
      minimum_salary: data.minimum_salary !== undefined ? (data.minimum_salary ?? undefined) : undefined,
      tip_recipient: data.tip_recipient !== undefined ? (data.tip_recipient ?? undefined) : undefined,
      count_bonus_enabled: data.count_bonus_enabled !== undefined ? (data.count_bonus_enabled ?? undefined) : undefined,
      count_bonus_amount: data.count_bonus_amount !== undefined ? (data.count_bonus_amount ?? undefined) : undefined,
      revenue_bonus_enabled: data.revenue_bonus_enabled !== undefined ? (data.revenue_bonus_enabled ?? undefined) : undefined,
      revenue_bonus_amount: data.revenue_bonus_amount !== undefined ? (data.revenue_bonus_amount ?? undefined) : undefined,
      deduction_per_order: data.deduction_per_order !== undefined ? (data.deduction_per_order ?? undefined) : undefined,
      orders_deduction_tiers: data.orders_deduction_tiers !== undefined
        ? (data.orders_deduction_tiers as Prisma.InputJsonValue)
        : undefined,
      revenue_deduction_tiers: data.revenue_deduction_tiers !== undefined
        ? (data.revenue_deduction_tiers as Prisma.InputJsonValue)
        : undefined,
      revenue_unit_amount: data.revenue_unit_amount !== undefined ? (data.revenue_unit_amount ?? undefined) : undefined,
      updated_at: new Date(),
    };

    const config = await this.prisma.payrollConfig.upsert({
      where: { company_id },
      update: updateData,
      create: {
        company_id,
        minimum_salary: data.minimum_salary ?? 400,
        tip_recipient: data.tip_recipient ?? 'REPRESENTATIVE',
        count_bonus_enabled: data.count_bonus_enabled ?? false,
        count_bonus_amount: data.count_bonus_amount ?? null,
        revenue_bonus_enabled: data.revenue_bonus_enabled ?? false,
        revenue_bonus_amount: data.revenue_bonus_amount ?? null,
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
      minimum_salary: config.minimum_salary ? Number(config.minimum_salary) : null,
      tip_recipient: config.tip_recipient,
      count_bonus_enabled: config.count_bonus_enabled,
      count_bonus_amount: config.count_bonus_amount ? Number(config.count_bonus_amount) : null,
      revenue_bonus_enabled: config.revenue_bonus_enabled,
      revenue_bonus_amount: config.revenue_bonus_amount ? Number(config.revenue_bonus_amount) : null,
      deduction_per_order: config.deduction_per_order ? Number(config.deduction_per_order) : null,
      orders_deduction_tiers: config.orders_deduction_tiers as DeductionTier[] | null,
      revenue_deduction_tiers: config.revenue_deduction_tiers as DeductionTier[] | null,
      revenue_unit_amount: config.revenue_unit_amount ? Number(config.revenue_unit_amount) : null,
    };
  }

  async getStats(company_id: string, year: number, month: number) {
    const { start, end } = getKSAMonthBounds(year, month);

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

  async approveMonth(
    company_id: string,
    user_id: string,
    year: number,
    month: number,
    ip: string | null,
    userAgent: string | null,
  ) {
    const { start, end } = getKSAMonthBounds(year, month);

    // 1. Fetch current config
    const config = await this.prisma.payrollConfig.findUnique({
      where: { company_id },
    });

    if (!config) {
      throw new BadRequestException(
        'PAYROLL_APPROVE_001: Payroll configuration not found',
      );
    }

    // 2. Validate configuration completeness
    const status = this.checkConfigurationStatus(config);
    const missingParts: string[] = [];
    if (status.general !== 'COMPLETE') missingParts.push('General Settings');
    if (status.fixed !== 'COMPLETE') missingParts.push('Fixed Deduction');
    if (status.ordersTiers !== 'COMPLETE') missingParts.push('Orders Tiers');
    if (status.revenueTiers !== 'COMPLETE') missingParts.push('Revenue Tiers');

    if (missingParts.length > 0) {
      throw new BadRequestException(
        `PAYROLL_APPROVE_002: Configuration incomplete. Missing: ${missingParts.join(', ')}`,
      );
    }

    // 3. Build snapshot
    const snapshot = this.buildConfigSnapshot(config);

    // 4. Transaction: upsert run, lock, generate employees
    return this.prisma.$transaction(async (tx) => {
      // Check if run already exists and is locked
      const existingRun = await tx.payrollRun.findUnique({
        where: { company_id_month: { company_id, month: start } },
      });

      if (existingRun && existingRun.status === 'LOCKED') {
        throw new BadRequestException(
          'PAYROLL_APPROVE_003: Month already approved and locked',
        );
      }

      // Upsert run
      const run = await tx.payrollRun.upsert({
        where: { company_id_month: { company_id, month: start } },
        update: {
          config_snapshot: snapshot as any,
          status: 'LOCKED',
          locked_at: new Date(),
          locked_by_user_id: user_id,
        },
        create: {
          company_id,
          month: start,
          config_snapshot: snapshot as any,
          status: 'LOCKED',
          locked_at: new Date(),
          locked_by_user_id: user_id,
          generated_at: new Date(),
          generated_by_user_id: user_id,
          created_by_user_id: user_id,
        },
      });

      // Delete existing employees if any (regenerate)
      await tx.payrollRunEmployee.deleteMany({
        where: { company_id, payroll_run_id: run.id },
      });

      const employeeCount =
        await this.salariesPayroll.regenerateRunEmployeesInTransaction(tx, {
          company_id,
          payroll_run_id: run.id,
          monthStart: start,
          monthEnd: end,
          actor_user_id: user_id,
          configSnapshot: snapshot as Record<string, unknown>,
        });

      // Audit log (using AuditService - need to inject it)
      // For now, log directly to audit table
      await tx.auditLog.create({
        data: {
          company_id,
          actor_user_id: user_id,
          action: 'PAYROLL_MONTH_APPROVE',
          entity_type: 'PAYROLL_RUN',
          entity_id: run.id,
          new_values: {
            year,
            month,
            snapshot,
            employeeCount,
          },
          ip,
          user_agent: userAgent,
        },
      });

      await tx.notification.deleteMany({
        where: {
          company_id,
          type_code: PAYROLL_MONTH_APPROVAL_DEADLINE_SOON,
        },
      });

      return {
        success: true,
        runId: run.id,
        month: start.toISOString(),
        employeeCount,
      };
    });
  }
}
