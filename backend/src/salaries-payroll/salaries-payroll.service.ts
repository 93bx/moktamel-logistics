import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PayrollRunStatus,
  PayrollEmployeeStatus,
  PaymentMethod,
  DocumentSequenceType,
  Prisma,
  SalaryReceiptDifferenceProcessing,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalariesPayrollCalculationService } from './salaries-payroll.calculation.service';
import {
  ListSalariesQueryDto,
  CreateSalaryReceiptDto,
} from './dto/salaries-payroll.dto';
import { AuditService } from '../audit/audit.service';
import { getKSAMonthBounds } from '../common/ksa-month';
import * as ExcelJS from 'exceljs';
import {
  addOneMonthUTC,
  PayrollConfigSnapshot,
  Tx,
} from './payroll-generation.helpers';
import {
  computePayrollMetricsForEmployment,
  type ComputedPayrollMetrics,
} from './payroll-compute-metrics';

@Injectable()
export class SalariesPayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: SalariesPayrollCalculationService,
    private readonly audit: AuditService,
  ) {}

  private getMonthBounds(monthStr: string) {
    const [year, month] = monthStr.split('-').map(Number);
    return getKSAMonthBounds(year, month);
  }

  /** Resolve calendar KSA bounds from PayrollRun.month (canonical start instant). */
  private getBoundsFromPayrollRunMonth(monthInstant: Date) {
    const ksa = new Date(monthInstant.getTime() + 3 * 60 * 60 * 1000);
    const year = ksa.getUTCFullYear();
    const month = ksa.getUTCMonth() + 1;
    return getKSAMonthBounds(year, month);
  }

  /** Policy snapshot at approval, or live PayrollConfig when snapshot is missing. */
  private async resolveConfigSnapshot(
    company_id: string,
    run: { config_snapshot: Prisma.JsonValue | null | undefined },
  ): Promise<PayrollConfigSnapshot> {
    if (run.config_snapshot && typeof run.config_snapshot === 'object') {
      return run.config_snapshot as PayrollConfigSnapshot;
    }
    const cfg = await this.prisma.payrollConfig.findUnique({
      where: { company_id },
    });
    if (!cfg) return {};
    return {
      count_bonus_enabled: cfg.count_bonus_enabled,
      count_bonus_amount: cfg.count_bonus_amount
        ? Number(cfg.count_bonus_amount)
        : null,
      revenue_bonus_enabled: cfg.revenue_bonus_enabled,
      revenue_bonus_amount: cfg.revenue_bonus_amount
        ? Number(cfg.revenue_bonus_amount)
        : null,
      deduction_per_order: cfg.deduction_per_order
        ? Number(cfg.deduction_per_order)
        : null,
      orders_deduction_tiers: cfg.orders_deduction_tiers as unknown[],
      revenue_deduction_tiers: cfg.revenue_deduction_tiers as unknown[],
      revenue_unit_amount: cfg.revenue_unit_amount
        ? Number(cfg.revenue_unit_amount)
        : null,
    };
  }

  /** Overlay live-computed payroll metrics onto a persisted row (API / receipts / export). */
  private mergeDynamicPayrollFields<T extends Record<string, unknown>>(
    row: T,
    m: ComputedPayrollMetrics,
  ): T {
    return {
      ...row,
      base_salary: m.base_salary,
      monthly_target: m.monthly_target,
      orders_count: m.orders_count,
      working_days: m.working_days,
      target_difference: m.target_difference,
      deduction_method: m.deduction_method,
      total_deductions: m.total_deductions,
      scheduled_loan_installments: m.scheduled_loan_installments,
      total_outstanding_loans: m.total_outstanding_loans,
      total_unreceived_cash: m.total_unreceived_cash,
      total_bonus: m.total_bonus,
      salary_after_deductions: m.salary_after_deductions,
      total_revenue: m.total_revenue,
      operations_deductions_total: m.operations_deductions_total,
      carryover_adjustment_sar: m.carryover_adjustment_sar,
      calculation_details: m.calculation_details,
    } as T;
  }

  async getList(
    company_id: string,
    query: ListSalariesQueryDto,
    actor_user_id: string,
  ) {
    const { start, end } = this.getMonthBounds(query.month);
    const page = Number(query.page) || 1;
    const pageSize = Math.min(Math.max(Number(query.pageSize) || 20, 1), 500);

    // 1. Check if PayrollRun exists and is approved (LOCKED)
    const run = await this.prisma.payrollRun.findUnique({
      where: { company_id_month: { company_id, month: start } },
    });

    if (!run || run.status !== PayrollRunStatus.LOCKED) {
      // No approved run: return needs-approval state
      return {
        needsApproval: true,
        month: query.month,
        quickStats: {
          activeEmployeesCount: 0,
          totalLoansAmount: 0,
          totalDeductionsAmount: 0,
          totalSalariesDueAmount: 0,
          totalRevenueAmount: 0,
          totalUncollectedCashAmount: 0,
        },
        items: [],
        pagination: {
          page,
          pageSize,
          total: 0,
        },
      };
    }

    const { start: monthStart, end: monthEnd } = this.getMonthBounds(
      query.month,
    );
    const configSnapshot = await this.resolveConfigSnapshot(company_id, run);

    const listWhere = this.buildPayrollListWhere(company_id, run.id, query);
    const statsWhere = { company_id, payroll_run_id: run.id };

    const [listRows, totalFiltered, allRunRows] = await Promise.all([
      this.prisma.payrollRunEmployee.findMany({
        where: listWhere,
        include: {
          employee: {
            select: {
              id: true,
              assigned_platform: true,
              platform_user_no: true,
              target_type: true,
              target_deduction_type: true,
              monthly_orders_target: true,
              monthly_target_amount: true,
              salary_amount: true,
            },
          },
        },
      }),
      this.prisma.payrollRunEmployee.count({ where: listWhere }),
      this.prisma.payrollRunEmployee.findMany({
        where: statsWhere,
        include: {
          employee: {
            select: {
              id: true,
              assigned_platform: true,
              platform_user_no: true,
              target_type: true,
              target_deduction_type: true,
              monthly_orders_target: true,
              monthly_target_amount: true,
              salary_amount: true,
            },
          },
        },
      }),
    ]);

    const metricsByRowId = new Map<string, ComputedPayrollMetrics>();
    await Promise.all(
      allRunRows.map(async (row) => {
        if (!row.employee) return;
        const metrics = await computePayrollMetricsForEmployment(
          this.prisma,
          this.calculator,
          {
            companyId: company_id,
            employment: row.employee,
            monthStart,
            monthEnd,
            configSnapshot,
            payrollRunEmployeeId: row.id,
          },
        );
        metricsByRowId.set(row.id, metrics);
      }),
    );

    const applyMetrics = (row: (typeof allRunRows)[0]) => {
      const m = metricsByRowId.get(row.id);
      if (!m) return row;
      return this.mergeDynamicPayrollFields(
        row as unknown as Record<string, unknown>,
        m,
      ) as typeof row;
    };

    const enrichedForStats = allRunRows.map((r) => applyMetrics(r));
    const enrichedList = listRows.map((r) => applyMetrics(r));

    let totalSalariesDueAmount = 0;
    let totalRevenueAmount = 0;
    let totalUncollectedCashAmount = 0;
    let totalLoansAmount = 0;
    let totalDeductionsAmount = 0;

    for (const r of enrichedForStats) {
      const perf = Number((r as any).total_deductions ?? 0);
      const ops = Number((r as any).operations_deductions_total ?? 0);
      const loansInst = Number((r as any).scheduled_loan_installments ?? 0);
      totalDeductionsAmount += perf + ops + loansInst;
      totalRevenueAmount += Number((r as any).total_revenue ?? 0);
      totalUncollectedCashAmount += Number((r as any).total_unreceived_cash ?? 0);
      totalLoansAmount += Number((r as any).total_outstanding_loans ?? 0);
      if ((r as any).status === 'NOT_PAID') {
        totalSalariesDueAmount += Number((r as any).salary_after_deductions ?? 0);
      }
    }

    const sortKey = query.sort;
    const sortedList = [...enrichedList].sort((a, b) => {
      const na = (x: unknown) => Number(x ?? 0);
      switch (sortKey) {
        case 'revenue':
          return na((b as any).total_revenue) - na((a as any).total_revenue);
        case 'salary_due':
          return (
            na((b as any).salary_after_deductions) -
            na((a as any).salary_after_deductions)
          );
        case 'deductions': {
          const ta =
            na((a as any).total_deductions) +
            na((a as any).operations_deductions_total) +
            na((a as any).scheduled_loan_installments);
          const tb =
            na((b as any).total_deductions) +
            na((b as any).operations_deductions_total) +
            na((b as any).scheduled_loan_installments);
          return tb - ta;
        }
        case 'loans':
          return (
            na((b as any).total_outstanding_loans) -
            na((a as any).total_outstanding_loans)
          );
        default:
          return String((a as any).employee_code ?? '').localeCompare(
            String((b as any).employee_code ?? ''),
            undefined,
            { sensitivity: 'base' },
          );
      }
    });

    const pagedItems = sortedList.slice(
      (page - 1) * pageSize,
      (page - 1) * pageSize + pageSize,
    );

    return {
      quickStats: {
        activeEmployeesCount: allRunRows.length,
        totalLoansAmount,
        totalDeductionsAmount,
        totalSalariesDueAmount,
        totalRevenueAmount,
        totalUncollectedCashAmount,
      },
      items: pagedItems,
      pagination: {
        page,
        pageSize,
        total: totalFiltered,
      },
    };
  }

  async getEmployeeDetail(company_id: string, payrollRunEmployeeId: string) {
    const employee = await this.prisma.payrollRunEmployee.findFirst({
      where: { id: payrollRunEmployeeId, company_id },
      include: {
        payroll_run: true,
        receipt: true,
        employee: {
          select: {
            id: true,
            assigned_platform: true,
            platform_user_no: true,
            target_type: true,
            target_deduction_type: true,
            monthly_orders_target: true,
            monthly_target_amount: true,
            salary_amount: true,
          },
        },
      },
    });

    if (!employee) throw new NotFoundException('Payroll record not found');
    if (!employee.employee) return employee;

    const { start: monthStart, end: monthEnd } = this.getBoundsFromPayrollRunMonth(
      employee.payroll_run.month,
    );
    const configSnapshot = await this.resolveConfigSnapshot(
      company_id,
      employee.payroll_run,
    );
    const metrics = await computePayrollMetricsForEmployment(
      this.prisma,
      this.calculator,
      {
        companyId: company_id,
        employment: employee.employee,
        monthStart,
        monthEnd,
        configSnapshot,
        payrollRunEmployeeId: employee.id,
      },
    );
    return this.mergeDynamicPayrollFields(
      employee as unknown as Record<string, unknown>,
      metrics,
    );
  }

  private buildPayrollListWhere(
    company_id: string,
    payroll_run_id: string,
    query: ListSalariesQueryDto,
  ): Prisma.PayrollRunEmployeeWhereInput {
    const where: Prisma.PayrollRunEmployeeWhereInput = {
      company_id,
      payroll_run_id,
    };

    if (query.status && query.status !== 'ALL') {
      where.status = query.status as PayrollEmployeeStatus;
    }

    if (query.search) {
      where.OR = [
        { employee_code: { contains: query.search, mode: 'insensitive' } },
        { employee_name_ar: { contains: query.search, mode: 'insensitive' } },
        { employee_name_en: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  async createReceipt(
    company_id: string,
    actor_user_id: string,
    payrollRunEmployeeId: string,
    data: CreateSalaryReceiptDto,
  ) {
    const employee = await this.prisma.payrollRunEmployee.findFirst({
      where: { id: payrollRunEmployeeId, company_id },
      include: {
        receipt: true,
        payroll_run: true,
        employee: {
          select: {
            id: true,
            salary_amount: true,
            monthly_orders_target: true,
            monthly_target_amount: true,
            target_type: true,
            target_deduction_type: true,
          },
        },
      },
    });

    if (!employee) throw new NotFoundException('Payroll record not found');
    if (employee.status === 'PAID' || employee.receipt) {
      throw new BadRequestException(
        'PAYROLL_SALARIES_002: Salary already paid for this month',
      );
    }

    if (!employee.employee) {
      throw new BadRequestException(
        'PAYROLL_SALARIES_006: Employment record missing for payroll row',
      );
    }

    const { start: monthStart, end: monthEnd } = this.getBoundsFromPayrollRunMonth(
      employee.payroll_run.month,
    );
    const configSnapshot = await this.resolveConfigSnapshot(
      company_id,
      employee.payroll_run,
    );
    const live = await computePayrollMetricsForEmployment(
      this.prisma,
      this.calculator,
      {
        companyId: company_id,
        employment: employee.employee,
        monthStart,
        monthEnd,
        configSnapshot,
        payrollRunEmployeeId: employee.id,
      },
    );
    const finalSalary = live.salary_after_deductions;
    const paidAmount = Number(data.amount);
    const needsDifferenceProcessing =
      finalSalary < 0 || Math.abs(paidAmount - finalSalary) > 0.009;

    if (needsDifferenceProcessing) {
      if (!data.differenceProcessing) {
        throw new BadRequestException(
          'PAYROLL_SALARIES_003: differenceProcessing is required when receipt amount differs from final salary or final salary is below zero',
        );
      }
      if (
        data.differenceProcessing === 'MANUAL' &&
        !data.differenceManualDetail?.trim()
      ) {
        throw new BadRequestException(
          'PAYROLL_SALARIES_004: differenceManualDetail is required for MANUAL processing',
        );
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const sequence = await tx.documentSequence.upsert({
        where: {
          company_id_month_sequence_type: {
            company_id,
            month: employee.payroll_run.month,
            sequence_type: DocumentSequenceType.SALARY_RECEIPT,
          },
        },
        update: { current_number: { increment: 1 } },
        create: {
          company_id,
          month: employee.payroll_run.month,
          sequence_type: DocumentSequenceType.SALARY_RECEIPT,
          current_number: 1,
        },
      });

      const receiptNumber = `RCPT-${employee.payroll_run.month.toISOString().slice(0, 7)}-${String(
        sequence.current_number,
      ).padStart(4, '0')}`;

      const receipt = await tx.salaryReceipt.create({
        data: {
          company_id,
          payroll_run_employee_id: payrollRunEmployeeId,
          receipt_number: receiptNumber,
          amount: data.amount,
          payment_method: data.paymentMethod,
          payment_date: new Date(data.paymentDate),
          attachment_url: data.attachmentUrl,
          difference_processing: data.differenceProcessing
            ? (data.differenceProcessing as SalaryReceiptDifferenceProcessing)
            : undefined,
          difference_manual_detail: data.differenceManualDetail?.trim() || null,
          notes: data.notes?.trim() || null,
          created_by_user_id: actor_user_id,
        },
      });

      if (data.differenceProcessing === 'DEFERRAL_TO_NEXT_MONTH') {
        const adjustmentSar = finalSalary - paidAmount;
        await tx.payrollCarryoverItem.create({
          data: {
            company_id,
            employment_record_id: employee.employee_id,
            target_month: addOneMonthUTC(employee.payroll_run.month),
            adjustment_sar: adjustmentSar,
            status: 'PENDING',
            source_salary_receipt_id: receipt.id,
            label_code: 'CARRYOVER_FROM_PREVIOUS_MONTH',
          },
        });
      }

      await tx.payrollRunEmployee.update({
        where: { id: payrollRunEmployeeId },
        data: { status: 'PAID' },
      });

      await this.audit.log({
        company_id,
        actor_user_id,
        action: 'PAYROLL_RECEIPT_CREATE',
        entity_type: 'SALARY_RECEIPT',
        entity_id: receipt.id,
        new_values: receipt,
      });

      return receipt;
    });
  }

  /**
   * Rebuilds all PayrollRunEmployee rows for an approved (locked) month from Daily Operations
   * and policy snapshot. Called inside payroll-config.approveMonth transaction.
   */
  async regenerateRunEmployeesInTransaction(
    tx: Tx,
    params: {
      company_id: string;
      payroll_run_id: string;
      monthStart: Date;
      monthEnd: Date;
      actor_user_id: string;
      configSnapshot: Record<string, unknown>;
    },
  ): Promise<number> {
    const {
      company_id,
      payroll_run_id,
      monthStart,
      monthEnd,
      actor_user_id,
      configSnapshot,
    } = params;

    const snapshot = configSnapshot as PayrollConfigSnapshot;

    const employments = await tx.employmentRecord.findMany({
      where: {
        company_id,
        deleted_at: null,
        status_code: 'EMPLOYMENT_STATUS_ACTIVE',
      },
      include: {
        recruitment_candidate: true,
      },
    });

    for (const emp of employments) {
      const pendingCarryovers = await tx.payrollCarryoverItem.findMany({
        where: {
          company_id,
          employment_record_id: emp.id,
          target_month: monthStart,
          status: 'PENDING',
        },
      });

      const metrics = await computePayrollMetricsForEmployment(
        tx,
        this.calculator,
        {
          companyId: company_id,
          employment: emp,
          monthStart,
          monthEnd,
          configSnapshot: snapshot,
          payrollRunEmployeeId: null,
        },
      );

      const details = metrics.calculation_details;

      const row = await tx.payrollRunEmployee.create({
        data: {
          company_id,
          payroll_run_id,
          employee_id: emp.id,
          employee_code: emp.employee_code,
          employee_name_ar:
            emp.full_name_ar ?? emp.recruitment_candidate?.full_name_ar,
          employee_name_en:
            emp.full_name_en ?? emp.recruitment_candidate?.full_name_en,
          employee_avatar_url: emp.avatar_file_id,
          status: 'NOT_PAID',
          base_salary: emp.salary_amount ?? 0,
          monthly_target: metrics.monthly_target,
          orders_count: metrics.orders_count,
          working_days: metrics.working_days,
          target_difference: metrics.target_difference,
          deduction_method: metrics.deduction_method,
          total_deductions: metrics.total_deductions,
          scheduled_loan_installments: metrics.scheduled_loan_installments,
          total_outstanding_loans: metrics.total_outstanding_loans,
          total_unreceived_cash: metrics.total_unreceived_cash,
          total_bonus: metrics.total_bonus,
          salary_after_deductions: metrics.salary_after_deductions,
          total_revenue: metrics.total_revenue,
          average_cost: 0,
          operations_deductions_total: metrics.operations_deductions_total,
          carryover_adjustment_sar: metrics.carryover_adjustment_sar,
          calculation_details: details as any,
          created_by_user_id: actor_user_id,
        },
      });

      if (pendingCarryovers.length > 0) {
        await tx.payrollCarryoverItem.updateMany({
          where: { id: { in: pendingCarryovers.map((c) => c.id) } },
          data: {
            status: 'APPLIED',
            applied_payroll_run_employee_id: row.id,
          },
        });
      }
    }

    return employments.length;
  }

  async exportPayrollExcel(
    company_id: string,
    query: ListSalariesQueryDto,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const { start, end } = this.getMonthBounds(query.month);
    const run = await this.prisma.payrollRun.findUnique({
      where: { company_id_month: { company_id, month: start } },
    });

    if (!run || run.status !== PayrollRunStatus.LOCKED) {
      throw new BadRequestException(
        'PAYROLL_SALARIES_005: Payroll month is not approved or has no data',
      );
    }

    const where = this.buildPayrollListWhere(company_id, run.id, query);
    const configSnapshot = await this.resolveConfigSnapshot(company_id, run);

    const rawRows = await this.prisma.payrollRunEmployee.findMany({
      where,
      take: 10000,
      include: {
        employee: {
          select: {
            id: true,
            assigned_platform: true,
            platform_user_no: true,
            target_type: true,
            target_deduction_type: true,
            monthly_orders_target: true,
            monthly_target_amount: true,
            salary_amount: true,
          },
        },
      },
    });

    const enriched = await Promise.all(
      rawRows.map(async (r) => {
        if (!r.employee) return r;
        const metrics = await computePayrollMetricsForEmployment(
          this.prisma,
          this.calculator,
          {
            companyId: company_id,
            employment: r.employee,
            monthStart: start,
            monthEnd: end,
            configSnapshot,
            payrollRunEmployeeId: r.id,
          },
        );
        return this.mergeDynamicPayrollFields(
          r as unknown as Record<string, unknown>,
          metrics,
        );
      }),
    );

    const sortKey = query.sort;
    const rows = [...enriched].sort((a, b) => {
      const na = (x: unknown) => Number(x ?? 0);
      switch (sortKey) {
        case 'revenue':
          return na((b as any).total_revenue) - na((a as any).total_revenue);
        case 'salary_due':
          return (
            na((b as any).salary_after_deductions) -
            na((a as any).salary_after_deductions)
          );
        case 'deductions': {
          const ta =
            na((a as any).total_deductions) +
            na((a as any).operations_deductions_total) +
            na((a as any).scheduled_loan_installments);
          const tb =
            na((b as any).total_deductions) +
            na((b as any).operations_deductions_total) +
            na((b as any).scheduled_loan_installments);
          return tb - ta;
        }
        case 'loans':
          return (
            na((b as any).total_outstanding_loans) -
            na((a as any).total_outstanding_loans)
          );
        default:
          return String((a as any).employee_code ?? '').localeCompare(
            String((b as any).employee_code ?? ''),
            undefined,
            { sensitivity: 'base' },
          );
      }
    });

    const loc = query.locale === 'ar' ? 'ar' : 'en';
    const headers =
      loc === 'ar'
        ? [
            'رمز الموظف',
            'الاسم',
            'المنصة',
            'الراتب الأساسي',
            'طريقة الخصم',
            'الطلبات / الإيراد',
            'الفرق عن الهدف',
            'خصم الأداء',
            'إجمالي الخصومات',
            'بونص وإكراميات',
            'صافي الراتب',
            'الحالة',
          ]
        : [
            'Employee code',
            'Name',
            'Platform',
            'Base salary',
            'Deduction method',
            'Orders / revenue',
            'Target diff',
            'Performance deduction',
            'Total deductions',
            'Tips & bonus',
            'Final salary',
            'Status',
          ];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(loc === 'ar' ? 'الرواتب' : 'Payroll');
    ws.addRow(headers);

    for (const r of rows) {
      const row = r as typeof r & {
        employee?: {
          target_type?: string | null;
          assigned_platform?: string | null;
        };
      };
      const name =
        loc === 'ar'
          ? row.employee_name_ar
          : row.employee_name_en || row.employee_name_ar;
      const perf = Number(row.total_deductions);
      const ops = Number(row.operations_deductions_total);
      const loan = Number(row.scheduled_loan_installments);
      const totalDed = perf + ops + loan;
      const ordersOrRevenue =
        row.employee?.target_type === 'TARGET_TYPE_REVENUE'
          ? Number(row.total_revenue)
          : row.orders_count;

      ws.addRow([
        row.employee_code ?? '',
        name ?? '',
        row.employee?.assigned_platform ?? '',
        Number(row.base_salary),
        row.deduction_method,
        ordersOrRevenue,
        row.target_difference,
        perf,
        totalDed,
        Number(row.total_bonus),
        Number(row.salary_after_deductions),
        row.status,
      ]);
    }

    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    return {
      buffer,
      filename: `salaries-payroll-${query.month}.xlsx`,
    };
  }
}
