import { Injectable } from '@nestjs/common';
import {
  CashTransactionStatus,
  CashTransactionType,
  OperatingPlatform,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type DateRange = { from: Date; to: Date };

type KpiCard = {
  current: number;
  previous: number;
  delta: number;
  pct_delta: number | null;
  trend: 'up' | 'down' | 'neutral';
};

type EmployeeRankRow = {
  employment_record_id: string;
  full_name_ar: string;
  full_name_en: string | null;
  orders: number;
  revenue: number;
};

type DailyPerformancePoint = {
  date: string;
  orders: number;
  revenue: number;
};

type PlatformRow = {
  platform: string;
  orders: number;
  revenue: number;
  avg_order_value: number;
};

type UncollectedRow = {
  employment_record_id: string;
  full_name_ar: string;
  full_name_en: string | null;
  amount: number;
};

type DailyCollectedPoint = {
  date: string;
  amount: number;
};

type NotificationRow = {
  id: string;
  doc_name: string;
  association: string;
  entity_display_name: string;
  expiry_date: string;
  days_remaining: number;
  status_bucket: 'expired' | 'critical_5' | 'warning_30';
  entity_type: string;
  entity_id: string;
  document_id: string;
  file_id: string | null;
};

type ActiveEmployeesByPlatformRow = {
  platform: string;
  count: number;
};

type LatestDeductionRow = {
  date: string;
  amount: number;
  reason: string | null;
  full_name_ar: string;
  full_name_en: string | null;
};

type GasSummary = {
  total_consumption: number;
  total_orders: number;
  avg_per_order: number;
};

const REVIEWED = 'REVIEWED';
const DASHBOARD_NOTIFICATIONS_CAP = 20;
const EXPIRED_WINDOW_DAYS = 30;

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function toNum(v: Prisma.Decimal | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === 'number' ? v : Number(v);
}

@Injectable()
export class DashboardService {
  private readonly cache = new Map<
    string,
    { payload: unknown; expiresAt: number }
  >();
  private readonly cacheTtlMs = 45_000;

  constructor(private readonly prisma: PrismaService) {}

  private async resolveCompanyTimezone(company_id: string): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: company_id },
      select: { timezone: true },
    });
    return company?.timezone ?? 'Asia/Riyadh';
  }

  private getDateParts(date: Date, timeZone: string): Record<string, string> {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const map: Record<string, string> = {};
    for (const part of fmt.formatToParts(date)) {
      if (part.type !== 'literal') map[part.type] = part.value;
    }
    return map;
  }

  private getMonthUtcBounds(year: number, month: number): DateRange {
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const lastDay = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { from: start, to: lastDay };
  }

  private getPreviousMonthBounds(range: DateRange): DateRange {
    const from = range.from;
    const y = from.getUTCFullYear();
    const m = from.getUTCMonth();
    const prevStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
    const prevEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
    return { from: prevStart, to: prevEnd };
  }

  private buildDailyBuckets(range: DateRange): string[] {
    const days: string[] = [];
    const cur = new Date(range.from);
    while (cur <= range.to) {
      days.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return days;
  }

  private baseOpsWhere(
    company_id: string,
    range: DateRange,
  ): Prisma.DailyOperationWhereInput {
    return {
      company_id,
      status_code: REVIEWED,
      date: { gte: range.from, lte: range.to },
    };
  }

  async getOverview(company_id: string, month?: string) {
    const cacheKey = `dashboard:${company_id}:${month ?? 'current'}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.payload;
    }

    const timeZone = await this.resolveCompanyTimezone(company_id);
    const now = new Date();
    const parts = this.getDateParts(now, timeZone);
    const currentYear = month
      ? parseInt(month.slice(0, 4), 10)
      : Number(parts.year);
    const currentMonth = month
      ? parseInt(month.slice(5, 7), 10)
      : Number(parts.month);
    const selectedMonth =
      month ?? `${parts.year}-${parts.month.padStart(2, '0')}`;

    const currentRange = this.getMonthUtcBounds(currentYear, currentMonth);
    const previousRange = this.getPreviousMonthBounds(currentRange);
    const monthDays = this.buildDailyBuckets(currentRange);

    const [
      activeCurrent,
      activePrevious,
      opsAggCurrent,
      opsAggPrevious,
      gasSumCurrent,
      gasSumPrevious,
      employeesWithOps,
      dailyPerf,
      platformGroups,
      top10Uncollected,
      dailyCollected,
      notifications,
      activeEmployeesByPlatform,
      latestDeductions,
    ] = await Promise.all([
      this.activeEmployeesAtMonthEnd(company_id, currentRange.to),
      this.activeEmployeesAtMonthEnd(company_id, previousRange.to),
      this.prisma.dailyOperation.aggregate({
        where: this.baseOpsWhere(company_id, currentRange),
        _sum: {
          orders_count: true,
          total_revenue: true,
          cash_collected: true,
          deduction_amount: true,
        },
      }),
      this.prisma.dailyOperation.aggregate({
        where: this.baseOpsWhere(company_id, previousRange),
        _sum: {
          orders_count: true,
          total_revenue: true,
          cash_collected: true,
          deduction_amount: true,
        },
      }),
      this.gasSumInRange(company_id, currentRange),
      this.gasSumInRange(company_id, previousRange),
      this.employeeRankingData(company_id, currentRange),
      this.dailyPerformanceSeries(company_id, currentRange, monthDays),
      this.platformsComparison(company_id, currentRange),
      this.top10UncollectedCash(company_id, currentRange),
      this.dailyCollectedSeries(company_id, currentRange, monthDays),
      this.documentsNearExpiry(company_id),
      this.activeEmployeesByPlatform(company_id, currentRange.to),
      this.latestDeductions(company_id, currentRange, 3),
    ]);

    const totalOrdersCurrent = opsAggCurrent._sum.orders_count ?? 0;
    const totalOrdersPrevious = opsAggPrevious._sum.orders_count ?? 0;
    const gasPerOrderCurrent =
      totalOrdersCurrent > 0 ? gasSumCurrent / totalOrdersCurrent : 0;
    const gasPerOrderPrevious =
      totalOrdersPrevious > 0 ? gasSumPrevious / totalOrdersPrevious : 0;

    const gas_summary: GasSummary = {
      total_consumption: gasSumCurrent,
      total_orders: totalOrdersCurrent,
      avg_per_order: gasPerOrderCurrent,
    };

    const kpis = {
      active_employees: this.buildKpi(activeCurrent, activePrevious),
      total_orders: this.buildKpi(totalOrdersCurrent, totalOrdersPrevious),
      total_revenue: this.buildKpi(
        toNum(opsAggCurrent._sum.total_revenue),
        toNum(opsAggPrevious._sum.total_revenue),
      ),
      total_cash_collected: this.buildKpi(
        toNum(opsAggCurrent._sum.cash_collected),
        toNum(opsAggPrevious._sum.cash_collected),
      ),
      total_deductions: this.buildKpi(
        toNum(opsAggCurrent._sum.deduction_amount),
        toNum(opsAggPrevious._sum.deduction_amount),
      ),
      gas_per_order: this.buildKpi(gasPerOrderCurrent, gasPerOrderPrevious),
    };

    const {
      top10_by_orders,
      worst10_by_orders,
      top10_by_revenue,
      worst10_by_revenue,
    } = this.rankEmployees(employeesWithOps);

    const links = this.buildDrillDownLinks(selectedMonth, currentRange);

    const payload = {
      meta: {
        selected_month: selectedMonth,
        currency: 'SAR',
        timezone: timeZone,
        generated_at: new Date().toISOString(),
      },
      kpis,
      operations: {
        top10_by_orders,
        worst10_by_orders,
        top10_by_revenue,
        worst10_by_revenue,
        daily_performance: dailyPerf,
      },
      platforms: platformGroups,
      cashFlow: {
        top10_uncollected: top10Uncollected,
        daily_collected: dailyCollected,
      },
      notifications,
      links,
      active_employees_by_platform: activeEmployeesByPlatform,
      latest_deductions: latestDeductions,
      gas_summary,
    };

    this.cache.set(cacheKey, {
      payload,
      expiresAt: Date.now() + this.cacheTtlMs,
    });
    return payload;
  }

  private buildKpi(current: number, previous: number): KpiCard {
    const delta = current - previous;
    const pct_delta = previous !== 0 ? (delta / previous) * 100 : null;
    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    if (delta > 0) trend = 'up';
    else if (delta < 0) trend = 'down';
    return { current, previous, delta, pct_delta, trend };
  }

  private async activeEmployeesAtMonthEnd(
    company_id: string,
    monthEnd: Date,
  ): Promise<number> {
    return this.prisma.employmentRecord.count({
      where: {
        company_id,
        deleted_at: null,
        status_code: 'EMPLOYMENT_STATUS_ACTIVE',
        created_at: { lte: monthEnd },
      },
    });
  }

  private async activeEmployeesByPlatform(
    company_id: string,
    monthEnd: Date,
  ): Promise<ActiveEmployeesByPlatformRow[]> {
    const groups = await this.prisma.employmentRecord.groupBy({
      by: ['assigned_platform'],
      where: {
        company_id,
        deleted_at: null,
        status_code: 'EMPLOYMENT_STATUS_ACTIVE',
        created_at: { lte: monthEnd },
      },
      _count: { id: true },
    });
    return groups
      .map((g) => ({
        platform: g.assigned_platform ?? 'NONE',
        count: g._count.id,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private async gasSumInRange(
    company_id: string,
    range: DateRange,
  ): Promise<number> {
    const agg = await this.prisma.vehicleGasRecord.aggregate({
      where: {
        company_id,
        date: { gte: range.from, lte: range.to },
      },
      _sum: { gas_cost: true },
    });
    return toNum(agg._sum.gas_cost);
  }

  private async employeeRankingData(
    company_id: string,
    range: DateRange,
  ): Promise<
    Array<{
      employment_record_id: string;
      full_name_ar: string;
      full_name_en: string | null;
      orders: number;
      revenue: number;
    }>
  > {
    const [employees, opsGroup] = await Promise.all([
      this.prisma.employmentRecord.findMany({
        where: {
          company_id,
          deleted_at: null,
          status_code: 'EMPLOYMENT_STATUS_ACTIVE',
        },
        select: {
          id: true,
          full_name_ar: true,
          full_name_en: true,
          recruitment_candidate: {
            select: { full_name_ar: true, full_name_en: true },
          },
        },
      }),
      this.prisma.dailyOperation.groupBy({
        by: ['employment_record_id'],
        where: this.baseOpsWhere(company_id, range),
        _sum: { orders_count: true, total_revenue: true },
      }),
    ]);

    const opsMap = new Map(
      opsGroup.map((r) => [
        r.employment_record_id,
        {
          orders: r._sum.orders_count ?? 0,
          revenue: toNum(r._sum.total_revenue),
        },
      ]),
    );

    return employees.map((e) => {
      const o = opsMap.get(e.id) ?? { orders: 0, revenue: 0 };
      const full_name_ar =
        e.full_name_ar ?? e.full_name_en ?? e.recruitment_candidate?.full_name_ar ?? e.recruitment_candidate?.full_name_en ?? e.id;
      const full_name_en =
        e.full_name_en ?? e.recruitment_candidate?.full_name_en ?? null;
      return {
        employment_record_id: e.id,
        full_name_ar,
        full_name_en,
        orders: o.orders,
        revenue: o.revenue,
      };
    });
  }

  private rankEmployees(
    rows: Array<{
      employment_record_id: string;
      full_name_ar: string;
      full_name_en: string | null;
      orders: number;
      revenue: number;
    }>,
  ): {
    top10_by_orders: EmployeeRankRow[];
    worst10_by_orders: EmployeeRankRow[];
    top10_by_revenue: EmployeeRankRow[];
    worst10_by_revenue: EmployeeRankRow[];
  } {
    const byOrders = [...rows].sort((a, b) => b.orders - a.orders);
    const byRevenue = [...rows].sort((a, b) => b.revenue - a.revenue);
    const toRow = (r: (typeof rows)[number]): EmployeeRankRow => ({
      employment_record_id: r.employment_record_id,
      full_name_ar: r.full_name_ar,
      full_name_en: r.full_name_en,
      orders: r.orders,
      revenue: r.revenue,
    });
    return {
      top10_by_orders: byOrders.slice(0, 10).map(toRow),
      worst10_by_orders: byOrders.slice(-10).reverse().map(toRow),
      top10_by_revenue: byRevenue.slice(0, 10).map(toRow),
      worst10_by_revenue: byRevenue.slice(-10).reverse().map(toRow),
    };
  }

  private async dailyPerformanceSeries(
    company_id: string,
    range: DateRange,
    monthDays: string[],
  ): Promise<DailyPerformancePoint[]> {
    const groups = await this.prisma.dailyOperation.groupBy({
      by: ['date'],
      where: this.baseOpsWhere(company_id, range),
      _sum: { orders_count: true, total_revenue: true },
    });

    const map = new Map(
      groups.map((g) => [
        g.date.toISOString().slice(0, 10),
        {
          orders: g._sum.orders_count ?? 0,
          revenue: toNum(g._sum.total_revenue),
        },
      ]),
    );

    return monthDays.map((date) => {
      const v = map.get(date) ?? { orders: 0, revenue: 0 };
      return { date, orders: v.orders, revenue: v.revenue };
    });
  }

  private async platformsComparison(
    company_id: string,
    range: DateRange,
  ): Promise<PlatformRow[]> {
    const groups = await this.prisma.dailyOperation.groupBy({
      by: ['platform'],
      where: this.baseOpsWhere(company_id, range),
      _sum: { orders_count: true, total_revenue: true },
      _count: { id: true },
    });

    return groups
      .filter((g) => g.platform !== OperatingPlatform.NONE)
      .map((g) => {
        const orders = g._sum.orders_count ?? 0;
        const revenue = toNum(g._sum.total_revenue);
        return {
          platform: g.platform,
          orders,
          revenue,
          avg_order_value: orders > 0 ? revenue / orders : 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue);
  }

  private async top10UncollectedCash(
    company_id: string,
    range: DateRange,
  ): Promise<UncollectedRow[]> {
    const opsAgg = await this.prisma.dailyOperation.groupBy({
      by: ['employment_record_id'],
      where: this.baseOpsWhere(company_id, range),
      _sum: { cash_collected: true, deduction_amount: true },
    });

    const receiptsAgg = await this.prisma.cashTransaction.groupBy({
      by: ['employment_record_id', 'type'],
      where: {
        company_id,
        employment_record_id: { not: null },
        status: CashTransactionStatus.APPROVED,
        date: { gte: range.from, lte: range.to },
        type: {
          in: [CashTransactionType.RECEIPT, CashTransactionType.DEDUCTION],
        },
      },
      _sum: { amount: true },
    });

    const receiptMap = new Map<
      string,
      { receipt: number; deduction: number }
    >();
    for (const row of receiptsAgg) {
      const key = row.employment_record_id!;
      const entry = receiptMap.get(key) ?? { receipt: 0, deduction: 0 };
      if (row.type === CashTransactionType.RECEIPT)
        entry.receipt += toNum(row._sum.amount);
      if (row.type === CashTransactionType.DEDUCTION)
        entry.deduction += toNum(row._sum.amount);
      receiptMap.set(key, entry);
    }

    const dueList: { employment_record_id: string; amount: number }[] = [];
    for (const op of opsAgg) {
      const collected = toNum(op._sum.cash_collected);
      const opsDed = toNum(op._sum.deduction_amount);
      const tx = receiptMap.get(op.employment_record_id) ?? {
        receipt: 0,
        deduction: 0,
      };
      const due = collected - tx.receipt - opsDed - tx.deduction;
      if (due > 0)
        dueList.push({
          employment_record_id: op.employment_record_id,
          amount: due,
        });
    }
    dueList.sort((a, b) => b.amount - a.amount);
    const top10 = dueList.slice(0, 10);
    if (top10.length === 0) return [];

    const empIds = top10.map((t) => t.employment_record_id);
    const employees = await this.prisma.employmentRecord.findMany({
      where: { id: { in: empIds }, company_id },
      select: {
        id: true,
        full_name_ar: true,
        full_name_en: true,
        recruitment_candidate: {
          select: { full_name_ar: true, full_name_en: true },
        },
      },
    });
    const empMap = new Map(employees.map((e) => [e.id, e]));

    return top10.map((t) => {
      const e = empMap.get(t.employment_record_id)!;
      const full_name_ar =
        e.full_name_ar ?? e.full_name_en ?? e.recruitment_candidate?.full_name_ar ?? e.recruitment_candidate?.full_name_en ?? e.id;
      const full_name_en =
        e.full_name_en ?? e.recruitment_candidate?.full_name_en ?? null;
      return {
        employment_record_id: t.employment_record_id,
        full_name_ar,
        full_name_en,
        amount: t.amount,
      };
    });
  }

  private async latestDeductions(
    company_id: string,
    range: DateRange,
    limit: number,
  ): Promise<LatestDeductionRow[]> {
    const rows = await this.prisma.dailyOperation.findMany({
      where: {
        company_id,
        status_code: REVIEWED,
        date: { gte: range.from, lte: range.to },
        deduction_amount: { gt: 0 },
      },
      orderBy: { date: 'desc' },
      take: limit,
      select: {
        date: true,
        deduction_amount: true,
        deduction_reason: true,
        employment_record: {
          select: {
            full_name_ar: true,
            full_name_en: true,
            recruitment_candidate: {
              select: { full_name_ar: true, full_name_en: true },
            },
          },
        },
      },
    });
    return rows.map((r) => {
      const emp = r.employment_record;
      const full_name_ar =
        emp.full_name_ar ?? emp.full_name_en ?? emp.recruitment_candidate?.full_name_ar ?? emp.recruitment_candidate?.full_name_en ?? '';
      const full_name_en =
        emp.full_name_en ?? emp.recruitment_candidate?.full_name_en ?? null;
      return {
        date: r.date.toISOString().slice(0, 10),
        amount: toNum(r.deduction_amount),
        reason: r.deduction_reason,
        full_name_ar,
        full_name_en,
      };
    });
  }

  private async dailyCollectedSeries(
    company_id: string,
    range: DateRange,
    monthDays: string[],
  ): Promise<DailyCollectedPoint[]> {
    const groups = await this.prisma.dailyOperation.groupBy({
      by: ['date'],
      where: this.baseOpsWhere(company_id, range),
      _sum: { cash_collected: true },
    });

    const map = new Map(
      groups.map((g) => [
        g.date.toISOString().slice(0, 10),
        toNum(g._sum.cash_collected),
      ]),
    );
    return monthDays.map((date) => ({ date, amount: map.get(date) ?? 0 }));
  }

  private async documentsNearExpiry(
    company_id: string,
  ): Promise<NotificationRow[]> {
    const now = new Date();
    const expiryWindowStart = addDays(now, -EXPIRED_WINDOW_DAYS);
    const expiryWindowEnd = addDays(now, 30);

    const items: Array<{
      id: string;
      doc_name: string;
      association: string;
      expiry_date: Date;
      entity_type: string;
      entity_id: string;
      document_id: string;
      file_id: string | null;
    }> = [];

    const records = await this.prisma.employmentRecord.findMany({
      where: { company_id, deleted_at: null },
      select: {
        id: true,
        full_name_ar: true,
        full_name_en: true,
        passport_expiry_at: true,
        iqama_expiry_at: true,
        contract_end_at: true,
        license_expiry_at: true,
        extra_documents: {
          select: {
            id: true,
            document_name: true,
            expiry_at: true,
            file_id: true,
          },
        },
      },
    });

    const label = (r: {
      full_name_ar: string | null;
      full_name_en: string | null;
    }) => r.full_name_en || r.full_name_ar || 'Employee';
    for (const r of records) {
      const sl = label(r);
      const fields: {
        key: string;
        name: string;
        expiry: Date | null;
        file_id: string | null;
      }[] = [
        {
          key: 'passport',
          name: 'Passport',
          expiry: r.passport_expiry_at,
          file_id: null,
        },
        {
          key: 'iqama',
          name: 'Iqama',
          expiry: r.iqama_expiry_at,
          file_id: null,
        },
        {
          key: 'contract',
          name: 'Contract',
          expiry: r.contract_end_at,
          file_id: null,
        },
        {
          key: 'license',
          name: 'License',
          expiry: r.license_expiry_at,
          file_id: null,
        },
      ];
      for (const f of fields) {
        if (f.expiry) {
          const exp = f.expiry.getTime();
          if (
            exp >= expiryWindowStart.getTime() &&
            exp <= expiryWindowEnd.getTime()
          ) {
            items.push({
              id: `employment:${r.id}:${f.key}`,
              doc_name: f.name,
              association: sl,
              expiry_date: f.expiry,
              entity_type: 'EMPLOYMENT_RECORD',
              entity_id: r.id,
              document_id: f.key,
              file_id: f.file_id,
            });
          }
        }
      }
      for (const ed of r.extra_documents) {
        if (ed.expiry_at) {
          const exp = ed.expiry_at.getTime();
          if (
            exp >= expiryWindowStart.getTime() &&
            exp <= expiryWindowEnd.getTime()
          ) {
            items.push({
              id: `employment:${r.id}:extra:${ed.id}`,
              doc_name: ed.document_name,
              association: sl,
              expiry_date: ed.expiry_at,
              entity_type: 'EMPLOYMENT_DOCUMENT',
              entity_id: r.id,
              document_id: ed.id,
              file_id: ed.file_id,
            });
          }
        }
      }
    }

    const fleetDocs = await this.prisma.vehicleDocument.findMany({
      where: { company_id },
      include: { vehicle: { select: { license_plate: true } } },
    });
    const typeNames: Record<string, string> = {
      REGISTRATION: 'Registration',
      INSURANCE: 'Insurance',
      CHECKUP: 'Checkup',
      OPERATING_CARD: 'Operating Card',
    };
    for (const d of fleetDocs) {
      const exp = d.expiry_date.getTime();
      if (
        exp >= expiryWindowStart.getTime() &&
        exp <= expiryWindowEnd.getTime()
      ) {
        items.push({
          id: `fleet:${d.vehicle_id}:${d.id}`,
          doc_name: typeNames[d.type_code] ?? d.type_code,
          association: d.vehicle.license_plate,
          expiry_date: d.expiry_date,
          entity_type: 'VEHICLE_DOCUMENT',
          entity_id: d.vehicle_id,
          document_id: d.id,
          file_id: d.file_id,
        });
      }
    }

    const recLinks = await this.prisma.fileLink.findMany({
      where: { company_id, entity_type: 'RECRUITMENT_CANDIDATE' },
      select: { id: true, entity_id: true, purpose_code: true, file_id: true },
    });
    const candidateIds = [...new Set(recLinks.map((l) => l.entity_id))];
    const candidates =
      candidateIds.length > 0
        ? await this.prisma.recruitmentCandidate.findMany({
            where: { company_id, id: { in: candidateIds }, deleted_at: null },
            select: {
              id: true,
              full_name_ar: true,
              full_name_en: true,
              passport_expiry_at: true,
              visa_deadline_at: true,
            },
          })
        : [];
    const candidateMap = new Map(candidates.map((c) => [c.id, c]));
    const purposeNames: Record<string, string> = {
      PASSPORT_IMAGE: 'Passport',
      VISA_IMAGE: 'Visa',
    };
    for (const link of recLinks) {
      const c = candidateMap.get(link.entity_id);
      if (!c) continue;
      let expiry: Date | null = null;
      if (link.purpose_code === 'PASSPORT_IMAGE') expiry = c.passport_expiry_at;
      else if (link.purpose_code === 'VISA_IMAGE')
        expiry = c.visa_deadline_at ?? null;
      if (expiry) {
        const exp = expiry.getTime();
        if (
          exp >= expiryWindowStart.getTime() &&
          exp <= expiryWindowEnd.getTime()
        ) {
          items.push({
            id: `recruitment:${link.entity_id}:${link.id}`,
            doc_name: purposeNames[link.purpose_code] ?? link.purpose_code,
            association: c.full_name_en || c.full_name_ar || 'Candidate',
            expiry_date: expiry,
            entity_type: 'RECRUITMENT_CANDIDATE',
            entity_id: link.entity_id,
            document_id: link.id,
            file_id: link.file_id,
          });
        }
      }
    }

    items.sort((a, b) => a.expiry_date.getTime() - b.expiry_date.getTime());
    const capped = items.slice(0, DASHBOARD_NOTIFICATIONS_CAP);

    return capped.map((i) => {
      const daysRemaining = Math.floor(
        (i.expiry_date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
      );
      let status_bucket: 'expired' | 'critical_5' | 'warning_30' = 'warning_30';
      if (daysRemaining < 0) status_bucket = 'expired';
      else if (daysRemaining <= 5) status_bucket = 'critical_5';

      let associationLabel = i.association;
      if (
        i.entity_type === 'EMPLOYMENT_RECORD' ||
        i.entity_type === 'EMPLOYMENT_DOCUMENT'
      )
        associationLabel = 'Employee';
      else if (i.entity_type === 'VEHICLE_DOCUMENT')
        associationLabel = 'Vehicle';
      else if (i.entity_type === 'RECRUITMENT_CANDIDATE')
        associationLabel = 'Recruitment';

      return {
        id: i.id,
        doc_name: i.doc_name,
        association: associationLabel,
        entity_display_name: i.association,
        expiry_date: i.expiry_date.toISOString().slice(0, 10),
        days_remaining: daysRemaining,
        status_bucket,
        entity_type: i.entity_type,
        entity_id: i.entity_id,
        document_id: i.document_id,
        file_id: i.file_id,
      };
    });
  }

  private buildDrillDownLinks(
    selectedMonth: string,
    range: DateRange,
  ): Record<string, string> {
    const from = range.from.toISOString().slice(0, 10);
    const to = range.to.toISOString().slice(0, 10);
    return {
      daily_operations: `?date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`,
      cash_loans: `?date_from=${encodeURIComponent(from)}&date_to=${encodeURIComponent(to)}`,
      documents: `?tab=near_expiry`,
      fleet: `?month=${selectedMonth}`,
    };
  }
}
