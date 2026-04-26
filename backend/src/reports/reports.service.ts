import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { REPORTS_REGISTRY } from './reports.registry';
import {
  ReportCatalogItem,
  ReportDataResponse,
  ReportExportFormat,
} from './reports.types';
import { ReportsExcelService } from './reports-excel.service';
import { ReportsPdfService } from './reports-pdf.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly excel: ReportsExcelService,
    private readonly pdf: ReportsPdfService,
    private readonly audit: AuditService,
  ) {}

  getCatalog() {
    return REPORTS_REGISTRY;
  }

  getReportOrThrow(key: string): ReportCatalogItem {
    const report = REPORTS_REGISTRY.find((r) => r.key === key);
    if (!report) throw new BadRequestException('REPORTS_001');
    return report;
  }

  async getReportData(
    companyId: string,
    key: string,
    filters: Record<string, unknown>,
  ): Promise<ReportDataResponse> {
    const report = this.getReportOrThrow(key);
    const rows = await this.loadRows(companyId, key, filters, true);
    const columns = report.preview_columns;
    const filteredRows = rows.map((row) => this.pickColumns(row, columns));
    return {
      key,
      summary: { rows: rows.length },
      columns,
      rows: filteredRows,
      totalRows: rows.length,
      appliedFilters: filters,
    };
  }

  async exportReport(
    companyId: string,
    actorUserId: string,
    key: string,
    format: ReportExportFormat,
    locale: string,
    filters: Record<string, unknown>,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const report = this.getReportOrThrow(key);
    const rows = await this.loadRows(companyId, key, filters, false);
    let buffer: Buffer;
    let contentType: string;
    const filename = `report-${key}-${Date.now()}.${format === 'xlsx' ? 'xlsx' : 'pdf'}`;
    if (format === 'xlsx') {
      buffer = await this.excel.buildWorkbookBuffer(report, rows);
      contentType =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    } else {
      buffer = await this.pdf.buildPdfBuffer(report, rows, locale);
      contentType = 'application/pdf';
    }
    await this.audit.log({
      company_id: companyId,
      actor_user_id: actorUserId,
      action: 'REPORT_EXPORT',
      entity_type: 'REPORT',
      entity_id: key,
      new_values: { format, filters },
    });
    return { buffer, filename, contentType };
  }

  private async loadRows(
    companyId: string,
    key: string,
    filters: Record<string, unknown>,
    preview: boolean,
  ): Promise<Array<Record<string, string | number | boolean | null>>> {
    const { from, to } = this.resolveRange(filters);
    const take = preview ? 10 : 10000;
    const employeeId =
      typeof filters.employee_id === 'string' && filters.employee_id.trim()
        ? filters.employee_id.trim()
        : null;

    switch (key) {
      case 'daily-operations':
        return this.mapDailyOperationsRows(
          await this.prisma.dailyOperation.findMany({
            where: {
              company_id: companyId,
              date: { gte: from, lte: to },
              ...(employeeId ? { employment_record_id: employeeId } : {}),
            },
            orderBy: { date: 'desc' },
            take,
            include: {
              employment_record: {
                select: {
                  employee_code: true,
                  full_name_ar: true,
                  full_name_en: true,
                },
              },
            },
          }),
        );
      case 'employee-performance':
        return this.getEmployeePerformance(companyId, from, to, take);
      case 'platform':
        return this.getPlatformDistribution(companyId, take);
      case 'working-days':
        return this.getWorkingDaysReport(companyId, from, to, take);
      case 'tips-deductions':
        return this.getTipsAndDeductions(companyId, from, to, take);
      case 'revenue':
        return this.getRevenueReport(companyId, from, to, take);
      case 'costs':
        return this.getCostsReport(companyId, from, to, take);
      case 'cash':
        return this.getCashReport(companyId, from, to, take);
      case 'cash-custody':
        return this.prisma.handoverBatch.findMany({
          where: { company_id: companyId, date: { gte: from, lte: to } },
          orderBy: { date: 'desc' },
          take,
        }) as any;
      case 'loans':
        return this.prisma.cashTransaction.findMany({
          where: {
            company_id: companyId,
            type: 'LOAN',
            date: { gte: from, lte: to },
          },
          orderBy: { date: 'desc' },
          take,
        }) as any;
      case 'salaries':
        return this.prisma.payrollRunEmployee.findMany({
          where: {
            company_id: companyId,
            payroll_run: { status: 'LOCKED' },
          },
          orderBy: { created_at: 'desc' },
          take,
          include: {
            payroll_run: { select: { month: true, status: true } },
            employee: {
              select: {
                employee_code: true,
                full_name_ar: true,
                full_name_en: true,
              },
            },
          },
        }) as any;
      case 'employees':
        return this.prisma.employmentRecord.findMany({
          where: { company_id: companyId, deleted_at: null },
          orderBy: { created_at: 'desc' },
          take,
        }) as any;
      case 'attendance':
        return this.getAttendanceReport(companyId, from, to, take);
      case 'contracts':
        return this.getContractsReport(companyId, take);
      case 'vehicles':
        return this.prisma.vehicle.findMany({
          where: { company_id: companyId },
          orderBy: { created_at: 'desc' },
          take,
          include: {
            current_driver: {
              select: {
                employee_code: true,
                full_name_ar: true,
                full_name_en: true,
              },
            },
          },
        }) as any;
      case 'maintenance':
        return this.prisma.vehicleMaintenance.findMany({
          where: { company_id: companyId, start_date: { gte: from, lte: to } },
          orderBy: { start_date: 'desc' },
          take,
        }) as any;
      case 'gas':
        return this.prisma.vehicleGasRecord.findMany({
          where: { company_id: companyId, date: { gte: from, lte: to } },
          orderBy: { date: 'desc' },
          take,
        }) as any;
      case 'assets':
        return this.prisma.assetAssignment.findMany({
          where: { company_id: companyId },
          orderBy: { receive_date: 'desc' },
          take,
          include: {
            asset: true,
            employment_record: {
              select: {
                employee_code: true,
                full_name_ar: true,
                full_name_en: true,
              },
            },
          },
        }) as any;
      case 'documents':
        return this.getDocumentsExpiryReport(companyId, take);
      default:
        return [];
    }
  }

  private resolveRange(filters: Record<string, unknown>) {
    if (
      typeof filters.date_from === 'string' ||
      typeof filters.date_to === 'string'
    ) {
      const dateFrom =
        typeof filters.date_from === 'string'
          ? new Date(filters.date_from)
          : new Date('1970-01-01T00:00:00.000Z');
      const dateTo =
        typeof filters.date_to === 'string'
          ? new Date(filters.date_to)
          : new Date();
      return { from: dateFrom, to: dateTo };
    }
    if (
      typeof filters.month === 'string' &&
      /^\d{4}-\d{2}$/.test(filters.month)
    ) {
      const [y, m] = filters.month.split('-').map(Number);
      return {
        from: new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0)),
        to: new Date(Date.UTC(y, m, 0, 23, 59, 59, 999)),
      };
    }
    const dateFrom =
      typeof filters.date_from === 'string'
        ? new Date(filters.date_from)
        : null;
    const dateTo =
      typeof filters.date_to === 'string' ? new Date(filters.date_to) : null;
    return {
      from: dateFrom ?? new Date('1970-01-01T00:00:00.000Z'),
      to: dateTo ?? new Date(),
    };
  }

  private pickColumns(
    row: Record<string, string | number | boolean | null>,
    columns: Array<{ key: string; label_code: string }>,
  ): Record<string, string | number | boolean | null> {
    const picked: Record<string, string | number | boolean | null> = {};
    for (const col of columns) {
      picked[col.key] = row[col.key] ?? null;
    }
    return picked;
  }

  private mapDailyOperationsRows(
    rows: Array<
      Prisma.DailyOperationGetPayload<{
        include: {
          employment_record: {
            select: {
              employee_code: true;
              full_name_ar: true;
              full_name_en: true;
            };
          };
        };
      }>
    >,
  ) {
    return rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      employee_name:
        r.employment_record.full_name_en ??
        r.employment_record.full_name_ar ??
        r.employment_record.employee_code ??
        '',
      employee_code: r.employment_record.employee_code ?? '',
      orders_count: r.orders_count,
      total_revenue: Number(r.total_revenue),
      cash_collected: Number(r.cash_collected),
      cash_received: Number(r.cash_received),
      difference_amount: Number(r.difference_amount),
      tips: Number(r.tips),
      work_hours: r.work_hours == null ? null : Number(r.work_hours),
      deduction_amount: Number(r.deduction_amount),
      platform: r.platform,
      status_code: r.status_code,
    }));
  }

  private async getEmployeePerformance(
    companyId: string,
    from: Date,
    to: Date,
    take: number,
  ) {
    const grouped = await this.prisma.dailyOperation.groupBy({
      by: ['employment_record_id'],
      where: { company_id: companyId, date: { gte: from, lte: to } },
      _sum: { orders_count: true, total_revenue: true, work_hours: true },
      orderBy: { _sum: { orders_count: 'desc' } },
      take,
    });
    const ids = grouped.map((g) => g.employment_record_id);
    const employees = await this.prisma.employmentRecord.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        employee_code: true,
        full_name_ar: true,
        full_name_en: true,
      },
    });
    const byId = new Map(employees.map((e) => [e.id, e]));
    return grouped.map((g, i) => {
      const emp = byId.get(g.employment_record_id);
      return {
        rank: i + 1,
        employee_code: emp?.employee_code ?? '',
        employee_name: emp?.full_name_en ?? emp?.full_name_ar ?? '',
        orders_count: g._sum.orders_count ?? 0,
        total_revenue: Number(g._sum.total_revenue ?? 0),
        work_hours: Number(g._sum.work_hours ?? 0),
      };
    });
  }

  private async getPlatformDistribution(companyId: string, take: number) {
    const grouped = await this.prisma.employmentRecord.groupBy({
      by: ['assigned_platform'],
      where: {
        company_id: companyId,
        deleted_at: null,
        status_code: 'EMPLOYMENT_STATUS_ACTIVE',
      },
      _count: { assigned_platform: true },
      orderBy: { _count: { assigned_platform: 'desc' } },
    });
    return grouped.slice(0, take).map((g) => ({
      platform: g.assigned_platform ?? 'NONE',
      employees_count: g._count.assigned_platform ?? 0,
    }));
  }

  private async getWorkingDaysReport(
    companyId: string,
    from: Date,
    to: Date,
    take: number,
  ) {
    const employees = await this.prisma.employmentRecord.findMany({
      where: {
        company_id: companyId,
        deleted_at: null,
        status_code: 'EMPLOYMENT_STATUS_ACTIVE',
      },
      select: {
        id: true,
        employee_code: true,
        full_name_ar: true,
        full_name_en: true,
        work_days: true,
        day_work_hours: true,
      },
      take,
    });
    const ops = await this.prisma.dailyOperation.findMany({
      where: {
        company_id: companyId,
        date: { gte: from, lte: to },
        employment_record_id: { in: employees.map((e) => e.id) },
      },
      select: { employment_record_id: true, date: true, work_hours: true },
    });
    const byEmp = new Map<
      string,
      { actualDays: Set<string>; actualHours: number }
    >();
    for (const op of ops) {
      const entry = byEmp.get(op.employment_record_id) ?? {
        actualDays: new Set<string>(),
        actualHours: 0,
      };
      entry.actualDays.add(op.date.toISOString().slice(0, 10));
      entry.actualHours += Number(op.work_hours ?? 0);
      byEmp.set(op.employment_record_id, entry);
    }
    const totalDays = Math.max(
      1,
      Math.floor((to.getTime() - from.getTime()) / 86400000) + 1,
    );
    return employees.map((e) => {
      const workDays = Array.isArray(e.work_days)
        ? (e.work_days as string[])
        : [];
      const expectedDays = Math.round(
        (totalDays * Math.max(workDays.length, 1)) / 7,
      );
      const expectedHours = expectedDays * Number(e.day_work_hours ?? 8);
      const actual = byEmp.get(e.id) ?? {
        actualDays: new Set<string>(),
        actualHours: 0,
      };
      return {
        employee_code: e.employee_code ?? '',
        employee_name: e.full_name_en ?? e.full_name_ar ?? '',
        expected_days: expectedDays,
        actual_days: actual.actualDays.size,
        expected_hours: expectedHours,
        actual_hours: Number(actual.actualHours.toFixed(2)),
      };
    });
  }

  private async getTipsAndDeductions(
    companyId: string,
    from: Date,
    to: Date,
    take: number,
  ) {
    const grouped = await this.prisma.dailyOperation.groupBy({
      by: ['employment_record_id'],
      where: { company_id: companyId, date: { gte: from, lte: to } },
      _sum: { tips: true, deduction_amount: true },
      orderBy: { _sum: { deduction_amount: 'desc' } },
      take,
    });
    const emps = await this.prisma.employmentRecord.findMany({
      where: { id: { in: grouped.map((g) => g.employment_record_id) } },
      select: {
        id: true,
        employee_code: true,
        full_name_ar: true,
        full_name_en: true,
      },
    });
    const byId = new Map(emps.map((e) => [e.id, e]));
    return grouped.map((g) => {
      const e = byId.get(g.employment_record_id);
      return {
        employee_code: e?.employee_code ?? '',
        employee_name: e?.full_name_en ?? e?.full_name_ar ?? '',
        tips: Number(g._sum.tips ?? 0),
        deduction_amount: Number(g._sum.deduction_amount ?? 0),
      };
    });
  }

  private async getRevenueReport(
    companyId: string,
    from: Date,
    to: Date,
    take: number,
  ) {
    const rows = await this.prisma.dailyOperation.findMany({
      where: { company_id: companyId, date: { gte: from, lte: to } },
      orderBy: { date: 'desc' },
      include: {
        employment_record: {
          select: {
            employee_code: true,
            full_name_ar: true,
            full_name_en: true,
          },
        },
      },
      take,
    });
    return rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      platform: r.platform,
      employee_code: r.employment_record.employee_code ?? '',
      employee_name:
        r.employment_record.full_name_en ??
        r.employment_record.full_name_ar ??
        '',
      orders_count: r.orders_count,
      total_revenue: Number(r.total_revenue),
    }));
  }

  private async getCostsReport(
    companyId: string,
    from: Date,
    to: Date,
    take: number,
  ) {
    const rows = await this.prisma.cost.findMany({
      where: { company_id: companyId, is_deleted: false },
      orderBy: { created_at: 'desc' },
      take,
    });
    const monthCount = Math.max(
      1,
      (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
        (to.getUTCMonth() - from.getUTCMonth()) +
        1,
    );
    return rows.map((r) => {
      const net = Number(r.net_amount);
      let estimated = 0;
      if (r.recurrence_code === 'MONTHLY') estimated = net * monthCount;
      else if (r.recurrence_code === 'YEARLY')
        estimated = (net / 12) * monthCount;
      else if (
        r.one_time_date &&
        r.one_time_date >= from &&
        r.one_time_date <= to
      )
        estimated = net;
      return {
        name: r.name,
        type_code: r.type_code,
        recurrence_code: r.recurrence_code,
        net_amount: net,
        estimated_period_cost: Number(estimated.toFixed(2)),
      };
    });
  }

  private async getCashReport(
    companyId: string,
    from: Date,
    to: Date,
    take: number,
  ) {
    const rows = await this.prisma.dailyOperation.findMany({
      where: { company_id: companyId, date: { gte: from, lte: to } },
      orderBy: { date: 'desc' },
      take,
    });
    return rows.map((r) => ({
      date: r.date.toISOString().slice(0, 10),
      cash_collected: Number(r.cash_collected),
      cash_received: Number(r.cash_received),
      difference_amount: Number(r.difference_amount),
    }));
  }

  private async getAttendanceReport(
    companyId: string,
    from: Date,
    to: Date,
    take: number,
  ) {
    const employees = await this.prisma.employmentRecord.findMany({
      where: {
        company_id: companyId,
        deleted_at: null,
        status_code: 'EMPLOYMENT_STATUS_ACTIVE',
      },
      select: {
        id: true,
        employee_code: true,
        full_name_ar: true,
        full_name_en: true,
        work_days: true,
      },
      take,
    });
    const ops = await this.prisma.dailyOperation.findMany({
      where: {
        company_id: companyId,
        date: { gte: from, lte: to },
        employment_record_id: { in: employees.map((e) => e.id) },
      },
      select: { employment_record_id: true, date: true },
    });
    const actualByEmp = new Map<string, Set<string>>();
    for (const op of ops) {
      const s = actualByEmp.get(op.employment_record_id) ?? new Set<string>();
      s.add(op.date.toISOString().slice(0, 10));
      actualByEmp.set(op.employment_record_id, s);
    }
    const totalDays = Math.max(
      1,
      Math.floor((to.getTime() - from.getTime()) / 86400000) + 1,
    );
    return employees.map((e) => {
      const workDays = Array.isArray(e.work_days)
        ? (e.work_days as string[])
        : [];
      const expected = Math.round(
        (totalDays * Math.max(workDays.length, 1)) / 7,
      );
      const actual = actualByEmp.get(e.id)?.size ?? 0;
      return {
        employee_code: e.employee_code ?? '',
        employee_name: e.full_name_en ?? e.full_name_ar ?? '',
        expected_days: expected,
        present_days: actual,
        absent_days: Math.max(0, expected - actual),
      };
    });
  }

  private async getContractsReport(companyId: string, take: number) {
    const rows = await this.prisma.employmentRecord.findMany({
      where: { company_id: companyId, deleted_at: null },
      orderBy: { created_at: 'desc' },
      take,
      select: {
        employee_code: true,
        full_name_ar: true,
        full_name_en: true,
        contract_no: true,
        contract_end_at: true,
      },
    });
    const now = new Date();
    return rows.map((r) => ({
      employee_code: r.employee_code ?? '',
      employee_name: r.full_name_en ?? r.full_name_ar ?? '',
      contract_no: r.contract_no ?? '',
      contract_end_at: r.contract_end_at
        ? r.contract_end_at.toISOString()
        : null,
      bucket: this.expiryBucket(r.contract_end_at, now),
    }));
  }

  private async getDocumentsExpiryReport(companyId: string, take: number) {
    const [employees, vehicles] = await Promise.all([
      this.prisma.employmentRecord.findMany({
        where: { company_id: companyId, deleted_at: null },
        select: {
          employee_code: true,
          contract_end_at: true,
          iqama_expiry_at: true,
          passport_expiry_at: true,
          license_expiry_at: true,
        },
        take,
      }),
      this.prisma.vehicleDocument.findMany({
        where: { company_id: companyId },
        select: {
          vehicle_id: true,
          type_code: true,
          expiry_date: true,
          number: true,
        },
        take,
      }),
    ]);
    const now = new Date();
    const employeeDocs = employees.flatMap((e) => [
      {
        owner: e.employee_code ?? '',
        document_type: 'CONTRACT',
        expiry_at: e.contract_end_at,
        bucket: this.expiryBucket(e.contract_end_at, now),
      },
      {
        owner: e.employee_code ?? '',
        document_type: 'IQAMA',
        expiry_at: e.iqama_expiry_at,
        bucket: this.expiryBucket(e.iqama_expiry_at, now),
      },
      {
        owner: e.employee_code ?? '',
        document_type: 'PASSPORT',
        expiry_at: e.passport_expiry_at,
        bucket: this.expiryBucket(e.passport_expiry_at, now),
      },
      {
        owner: e.employee_code ?? '',
        document_type: 'LICENSE',
        expiry_at: e.license_expiry_at,
        bucket: this.expiryBucket(e.license_expiry_at, now),
      },
    ]);
    const vehicleDocs = vehicles.map((v) => ({
      owner: v.vehicle_id,
      document_type: v.type_code,
      expiry_at: v.expiry_date,
      bucket: this.expiryBucket(v.expiry_date, now),
    }));
    return [...employeeDocs, ...vehicleDocs].slice(0, take).map((r) => ({
      ...r,
      expiry_at: r.expiry_at ? r.expiry_at.toISOString() : null,
    }));
  }

  private expiryBucket(date: Date | null, now: Date) {
    if (!date) return 'MISSING';
    const diffDays = Math.floor((date.getTime() - now.getTime()) / 86400000);
    if (diffDays < 0) return 'EXPIRED';
    if (diffDays <= 30) return 'EXPIRING_30';
    if (diffDays <= 60) return 'EXPIRING_60';
    if (diffDays <= 90) return 'EXPIRING_90';
    return 'VALID';
  }
}
