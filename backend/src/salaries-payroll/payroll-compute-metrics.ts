import { PayrollCarryoverItem, Prisma, PrismaClient } from '@prisma/client';
import { SalariesPayrollCalculationService } from './salaries-payroll.calculation.service';
import {
  computeConfigBonuses,
  PayrollConfigSnapshot,
} from './payroll-generation.helpers';

/** Employment fields required for payroll calculation (from EmploymentRecord). */
export type EmploymentRecordLike = {
  id: string;
  salary_amount: Prisma.Decimal | number | null;
  monthly_orders_target: number | null;
  monthly_target_amount: Prisma.Decimal | number | null;
  target_type: string | null;
  target_deduction_type: string | null;
};

export type ComputedPayrollMetrics = {
  orders_count: number;
  total_revenue: number;
  working_days: number;
  target_difference: number;
  total_deductions: number;
  scheduled_loan_installments: number;
  total_outstanding_loans: number;
  total_unreceived_cash: number;
  total_bonus: number;
  salary_after_deductions: number;
  operations_deductions_total: number;
  carryover_adjustment_sar: number;
  monthly_target: number;
  base_salary: number;
  deduction_method: string;
  calculation_details: Record<string, unknown>;
};

type DbClient = Prisma.TransactionClient | PrismaClient;

/**
 * Aggregates Daily Operations, loans, installments, carryover, and payroll config
 * to produce the same metrics as persisted on PayrollRunEmployee — for live reads
 * and for generation (single source of truth).
 *
 * @param payrollRunEmployeeId When set, carryover includes PENDING items plus APPLIED items
 * linked to this row (after approval). Omit during initial row creation (PENDING only).
 */
export async function computePayrollMetricsForEmployment(
  prisma: DbClient,
  calculator: SalariesPayrollCalculationService,
  params: {
    companyId: string;
    employment: EmploymentRecordLike;
    monthStart: Date;
    monthEnd: Date;
    configSnapshot: PayrollConfigSnapshot;
    payrollRunEmployeeId?: string | null;
  },
): Promise<ComputedPayrollMetrics> {
  const {
    companyId,
    employment: emp,
    monthStart,
    monthEnd,
    configSnapshot,
    payrollRunEmployeeId,
  } = params;
  const snapshot = configSnapshot;

  const opsWhere = {
    company_id: companyId,
    employment_record_id: emp.id,
    date: { gte: monthStart, lte: monthEnd },
    is_draft: false,
  };

  const opsAgg = await prisma.dailyOperation.aggregate({
    where: opsWhere,
    _sum: {
      orders_count: true,
      total_revenue: true,
      cash_collected: true,
      cash_received: true,
      tips: true,
      deduction_amount: true,
    },
  });

  const dayGroups = await prisma.dailyOperation.groupBy({
    by: ['date'],
    where: opsWhere,
  });
  const workingDays = dayGroups.length;

  const loansAgg = await prisma.cashTransaction.aggregate({
    where: {
      company_id: companyId,
      employment_record_id: emp.id,
      type: 'LOAN',
      status: 'APPROVED',
    },
    _sum: { amount: true },
  });
  const totalOutstandingLoans = Number(loansAgg._sum.amount ?? 0);

  const installmentsWhere = {
    company_id: companyId,
    employment_record_id: emp.id,
    status_code: 'PENDING',
    created_at: { gte: monthStart, lte: monthEnd },
  };

  const installmentsAgg = await prisma.assetDeduction.aggregate({
    where: installmentsWhere,
    _sum: { amount: true },
  });

  const [loanInstallmentRows, operationsDeductionRows, tipsFromOperationsRows] =
    await Promise.all([
      prisma.assetDeduction.findMany({
        where: installmentsWhere,
        select: {
          created_at: true,
          amount: true,
          status_code: true,
        },
        orderBy: { created_at: 'asc' },
      }),
      prisma.dailyOperation.findMany({
        where: { ...opsWhere, deduction_amount: { gt: 0 } },
        select: {
          date: true,
          deduction_amount: true,
          deduction_reason: true,
        },
        orderBy: { date: 'asc' },
      }),
      prisma.dailyOperation.findMany({
        where: { ...opsWhere, tips: { gt: 0 } },
        select: { date: true, tips: true },
        orderBy: { date: 'asc' },
      }),
    ]);

  const unreceivedCash =
    Number(opsAgg._sum.cash_collected ?? 0) -
    Number(opsAgg._sum.cash_received ?? 0);

  const ordersCount = opsAgg._sum.orders_count ?? 0;
  const totalRevenue = Number(opsAgg._sum.total_revenue ?? 0);
  const tipsTotal = Number(opsAgg._sum.tips ?? 0);
  const operationsDeductions = Number(opsAgg._sum.deduction_amount ?? 0);

  const monthlyOrdersTarget = emp.monthly_orders_target ?? 0;
  const monthlyRevenueTarget = Number(emp.monthly_target_amount ?? 0);
  const targetType = emp.target_type || 'TARGET_TYPE_ORDERS';

  const configBonus = computeConfigBonuses(
    snapshot,
    targetType,
    ordersCount,
    totalRevenue,
    monthlyOrdersTarget,
    monthlyRevenueTarget,
  );

  const totalBonusInput = tipsTotal + configBonus;

  const carryoverWhere: Prisma.PayrollCarryoverItemWhereInput = {
    company_id: companyId,
    employment_record_id: emp.id,
    target_month: monthStart,
  };

  if (payrollRunEmployeeId) {
    carryoverWhere.OR = [
      { status: 'PENDING' },
      {
        status: 'APPLIED',
        applied_payroll_run_employee_id: payrollRunEmployeeId,
      },
    ];
  } else {
    carryoverWhere.status = 'PENDING';
  }

  const pendingOrAppliedCarryovers = await prisma.payrollCarryoverItem.findMany(
    {
      where: carryoverWhere,
    },
  );
  const carryoverSum = pendingOrAppliedCarryovers.reduce(
    (s: number, c: PayrollCarryoverItem) => s + Number(c.adjustment_sar),
    0,
  );

  const calculation = calculator.calculate({
    baseSalary: Number(emp.salary_amount ?? 0),
    targetType,
    monthlyOrdersTarget,
    monthlyRevenueTarget,
    ordersCount,
    totalRevenue,
    workingDays,
    deductionType: emp.target_deduction_type || 'DEDUCTION_ORDERS_TIERS',
    ordersTiers: (snapshot.orders_deduction_tiers as any[]) || [],
    revenueTiers: (snapshot.revenue_deduction_tiers as any[]) || [],
    revenueUnitAmount: Number(snapshot.revenue_unit_amount ?? 0),
    deductionPerOrder: Number(snapshot.deduction_per_order ?? 0),
    scheduledLoanInstallments: Number(installmentsAgg._sum.amount ?? 0),
    totalBonus: totalBonusInput,
    averageCost: 0,
  });

  const monthlyTargetStored =
    emp.target_type === 'TARGET_TYPE_ORDERS'
      ? monthlyOrdersTarget
      : Math.round(Number(emp.monthly_target_amount ?? 0));

  const salaryAfter =
    calculation.salaryAfterDeductions - operationsDeductions + carryoverSum;

  const cashCollected = Number(opsAgg._sum.cash_collected ?? 0);
  const cashReceived = Number(opsAgg._sum.cash_received ?? 0);

  const details = {
    ...calculation.calculationDetails,
    tipsFromOperations: { amount: tipsTotal },
    configBonuses: { amount: configBonus },
    operationsDeductions: { amount: operationsDeductions },
    cashFromOperations: {
      totalCashCollected: cashCollected,
      totalCashReceived: cashReceived,
      difference: unreceivedCash,
    },
    loanInstallmentRows: loanInstallmentRows.map(
      (r: { created_at: Date; amount: unknown; status_code: string }) => ({
        date: r.created_at.toISOString(),
        amount: Number(r.amount),
        status: r.status_code,
        note: '',
      }),
    ),
    operationsDeductionRows: operationsDeductionRows.map(
      (r: {
        date: Date;
        deduction_amount: unknown;
        deduction_reason: string | null;
      }) => ({
        date: r.date.toISOString(),
        amount: Number(r.deduction_amount),
        type: 'DAILY_OPS_DEDUCTION',
        notes: r.deduction_reason ?? '',
      }),
    ),
    tipsFromOperationsRows: tipsFromOperationsRows.map(
      (r: { date: Date; tips: unknown }) => ({
        date: r.date.toISOString(),
        amount: Number(r.tips),
        type: 'TIP',
      }),
    ),
    carryover: {
      total: carryoverSum,
      items: pendingOrAppliedCarryovers.map((c: PayrollCarryoverItem) => ({
        id: c.id,
        adjustment_sar: Number(c.adjustment_sar),
        label_code: c.label_code,
      })),
    },
    salaryAfterComponents: {
      afterCalculator: calculation.salaryAfterDeductions,
      minusOperationsDeductions: operationsDeductions,
      plusCarryover: carryoverSum,
    },
  };

  return {
    orders_count: ordersCount,
    total_revenue: totalRevenue,
    working_days: workingDays,
    target_difference: calculation.targetDifference,
    total_deductions: calculation.totalDeductions,
    scheduled_loan_installments: Number(installmentsAgg._sum.amount ?? 0),
    total_outstanding_loans: totalOutstandingLoans,
    total_unreceived_cash: unreceivedCash,
    total_bonus: totalBonusInput,
    salary_after_deductions: Math.max(0, salaryAfter),
    operations_deductions_total: operationsDeductions,
    carryover_adjustment_sar: carryoverSum,
    monthly_target: monthlyTargetStored,
    base_salary: Number(emp.salary_amount ?? 0),
    deduction_method: emp.target_deduction_type || 'DEDUCTION_ORDERS_TIERS',
    calculation_details: details,
  };
}
