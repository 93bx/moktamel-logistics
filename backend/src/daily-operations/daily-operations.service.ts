import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, OperatingPlatform } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

type SubmitAction = 'draft' | 'approve';

type CreateInput = {
  employment_record_id: string;
  date: string;
  orders_count?: number;
  total_revenue?: number;
  cash_collected?: number;
  cash_received?: number;
  tips?: number;
  deduction_amount?: number;
  deduction_reason?: string | null;
  submit_action: SubmitAction;
};

type BulkRowInput = Omit<CreateInput, 'date' | 'submit_action'>;

@Injectable()
export class DailyOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async resolveCompanyTimezone(company_id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: company_id },
      select: { timezone: true },
    });
    return company?.timezone ?? 'Asia/Riyadh';
  }

  private partsToDate(parts: Record<string, string>) {
    return new Date(
      Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        Number(parts.hour ?? '0'),
        Number(parts.minute ?? '0'),
        Number(parts.second ?? '0'),
        0,
      ),
    );
  }

  private getDateParts(date: Date, timeZone: string) {
    const formatter = new Intl.DateTimeFormat('en-US', {
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
    for (const part of formatter.formatToParts(date)) {
      if (part.type !== 'literal') {
        map[part.type] = part.value;
      }
    }
    return map;
  }

  private getDayBounds(date: Date, timeZone: string) {
    const parts = this.getDateParts(date, timeZone);
    const start = new Date(
      Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        0,
        0,
        0,
        0,
      ),
    );
    const end = new Date(
      Date.UTC(
        Number(parts.year),
        Number(parts.month) - 1,
        Number(parts.day),
        23,
        59,
        59,
        999,
      ),
    );
    return { start, end };
  }

  private ensureNotFuture(dateStr: string, timeZone: string) {
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) {
      throw new BadRequestException('OPS_DAILY_001: Invalid date');
    }
    const nowZoned = this.partsToDate(this.getDateParts(new Date(), timeZone));
    if (parsed.getTime() > nowZoned.getTime()) {
      throw new BadRequestException(
        'OPS_DAILY_002: Date cannot be in the future',
      );
    }
    const { start, end } = this.getDayBounds(parsed, timeZone);
    return { parsed, startOfDay: start, endOfDay: end };
  }

  private async ensureActiveEmployment(
    company_id: string,
    employment_record_id: string,
  ) {
    const employment = await this.prisma.employmentRecord.findFirst({
      where: {
        id: employment_record_id,
        company_id,
        deleted_at: null,
        status_code: 'EMPLOYMENT_STATUS_ACTIVE',
      },
      select: {
        id: true,
        assigned_platform: true,
        employee_no: true,
        status_code: true,
      },
    });
    if (!employment) {
      throw new BadRequestException(
        'OPS_DAILY_003: Employment record must be active',
      );
    }
    return employment;
  }

  private normalizeNumbers(input: CreateInput) {
    return {
      orders_count: Math.max(0, Math.trunc(Number(input.orders_count ?? 0))),
      total_revenue: Number(input.total_revenue ?? 0),
      cash_collected: Number(input.cash_collected ?? 0),
      cash_received: Number(input.cash_received ?? 0),
      tips: Number(input.tips ?? 0),
      deduction_amount: Number(input.deduction_amount ?? 0),
    };
  }

  private validateForApproval(
    values: ReturnType<DailyOperationsService['normalizeNumbers']>,
    input: CreateInput,
  ) {
    if (!values.orders_count || values.orders_count <= 0) {
      throw new BadRequestException(
        'OPS_DAILY_005: Orders count must be positive',
      );
    }
    if (!values.total_revenue || values.total_revenue <= 0) {
      throw new BadRequestException(
        'OPS_DAILY_006: Total revenue must be positive',
      );
    }
    if (!values.cash_collected || values.cash_collected <= 0) {
      throw new BadRequestException(
        'OPS_DAILY_007: Cash collected must be positive',
      );
    }
    if (values.deduction_amount > 0 && !input.deduction_reason) {
      throw new BadRequestException('OPS_DAILY_008: Deduction reason required');
    }
  }

  private buildStatus(
    values: ReturnType<DailyOperationsService['normalizeNumbers']>,
    isDraft: boolean,
  ) {
    if (isDraft) return 'DRAFT';
    return values.deduction_amount > 0 ? 'FLAGGED_DEDUCTION' : 'APPROVED';
  }

  private async ensureDayNotClosed(
    company_id: string,
    startOfDay: Date,
    endOfDay: Date,
  ) {
    const existing = await this.prisma.dailyOperation.findFirst({
      where: {
        company_id,
        is_draft: false,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException(
        'OPS_DAILY_004: Day already closed for this company',
      );
    }
  }

  /** Ensures no daily operation (draft or approved) exists for this employee on this day. */
  private async ensureNoExistingEntryForDay(
    company_id: string,
    employment_record_id: string,
    startOfDay: Date,
    endOfDay: Date,
  ) {
    const existing = await this.prisma.dailyOperation.findFirst({
      where: {
        company_id,
        employment_record_id,
        date: { gte: startOfDay, lte: endOfDay },
      },
      select: { id: true },
    });
    if (existing) {
      throw new BadRequestException('OPS_DAILY_012');
    }
  }

  /**
   * Check if the given employee already has a daily operation (draft or approved) for the given date.
   * Used by the frontend for early validation before submitting.
   */
  async checkHasEntryForDay(
    company_id: string,
    employment_record_id: string,
    dateStr: string,
  ): Promise<{ hasEntry: boolean }> {
    const timeZone = await this.resolveCompanyTimezone(company_id);
    try {
      const { start, end } = this.getDayBounds(new Date(dateStr), timeZone);
      const existing = await this.prisma.dailyOperation.findFirst({
        where: {
          company_id,
          employment_record_id,
          date: { gte: start, lte: end },
        },
        select: { id: true },
      });
      return { hasEntry: !!existing };
    } catch {
      return { hasEntry: false };
    }
  }

  async searchActiveEmployees(company_id: string, q: string) {
    const trimmed = q.trim();
    if (trimmed.length < 1) return [];
    return this.prisma.employmentRecord.findMany({
      where: {
        company_id,
        deleted_at: null,
        status_code: 'EMPLOYMENT_STATUS_ACTIVE',
        OR: [
          { employee_no: { contains: trimmed, mode: 'insensitive' } },
          { employee_code: { contains: trimmed, mode: 'insensitive' } },
          { full_name_ar: { contains: trimmed, mode: 'insensitive' } },
          { full_name_en: { contains: trimmed, mode: 'insensitive' } },
          {
            recruitment_candidate: {
              OR: [
                { full_name_ar: { contains: trimmed, mode: 'insensitive' } },
                { full_name_en: { contains: trimmed, mode: 'insensitive' } },
              ],
            },
          },
        ],
      },
      take: 15,
      select: {
        id: true,
        employee_no: true,
        employee_code: true,
        full_name_ar: true,
        full_name_en: true,
        assigned_platform: true,
        platform_user_no: true,
        status_code: true,
        avatar_file_id: true,
        recruitment_candidate: {
          select: { full_name_ar: true, full_name_en: true },
        },
      },
    });
  }

  async list(
    company_id: string,
    input: {
      q?: string;
      platform?: OperatingPlatform;
      date_from?: string;
      date_to?: string;
      page: number;
      page_size: number;
    },
  ) {
    const where: Prisma.DailyOperationWhereInput = { company_id };
    if (input.q) {
      where.OR = [
        {
          employment_record: {
            employee_no: { contains: input.q, mode: 'insensitive' },
          },
        },
        {
          employment_record: {
            recruitment_candidate: {
              OR: [
                { full_name_ar: { contains: input.q, mode: 'insensitive' } },
                { full_name_en: { contains: input.q, mode: 'insensitive' } },
              ],
            },
          },
        },
      ];
    }
    if (input.platform) where.platform = input.platform;
    if (input.date_from || input.date_to) {
      where.date = {};
      if (input.date_from) (where.date as any).gte = new Date(input.date_from);
      if (input.date_to) (where.date as any).lte = new Date(input.date_to);
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.dailyOperation.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (input.page - 1) * input.page_size,
        take: input.page_size,
        select: {
          id: true,
          date: true,
          platform: true,
          orders_count: true,
          total_revenue: true,
          cash_collected: true,
          cash_received: true,
          difference_amount: true,
          tips: true,
          deduction_amount: true,
          deduction_reason: true,
          is_draft: true,
          approved_at: true,
          approved_by_user_id: true,
          status_code: true,
          created_at: true,
          employment_record: {
            select: {
              id: true,
              employee_no: true,
              avatar_file_id: true,
              platform_user_no: true,
              recruitment_candidate: {
                select: { full_name_ar: true, full_name_en: true },
              },
            },
          },
        },
      }),
      this.prisma.dailyOperation.count({ where }),
    ]);

    return { items, total, page: input.page, page_size: input.page_size };
  }

  async stats(
    company_id: string,
    input: { date_from?: string; date_to?: string },
  ) {
    const where: Prisma.DailyOperationWhereInput = {
      company_id,
      status_code: 'REVIEWED',
    };
    if (input.date_from || input.date_to) {
      where.date = {};
      if (input.date_from) (where.date as any).gte = new Date(input.date_from);
      if (input.date_to) (where.date as any).lte = new Date(input.date_to);
    }

    const [agg, activeEmployees] = await this.prisma.$transaction([
      this.prisma.dailyOperation.aggregate({
        where,
        _sum: {
          orders_count: true,
          total_revenue: true,
          deduction_amount: true,
        },
      }),
      this.prisma.employmentRecord.count({
        where: {
          company_id,
          deleted_at: null,
          status_code: 'EMPLOYMENT_STATUS_ACTIVE',
        },
      }),
    ]);

    return {
      totalOrders: agg._sum.orders_count ?? 0,
      totalSales: Number(agg._sum.total_revenue ?? 0),
      totalDeductions: Number(agg._sum.deduction_amount ?? 0),
      activeEmployees,
    };
  }

  /** Current month bounds in company timezone (year/month from TZ, range in UTC). */
  private async getCurrentMonthBounds(company_id: string) {
    const timeZone = await this.resolveCompanyTimezone(company_id);
    const parts = this.getDateParts(new Date(), timeZone);
    const year = Number(parts.year);
    const month = Number(parts.month);
    const dateFrom = new Date(Date.UTC(year, month - 1, 1));
    const dateTo = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { dateFrom, dateTo };
  }

  async monthlyCharts(company_id: string) {
    const { dateFrom, dateTo } = await this.getCurrentMonthBounds(company_id);

    const activeEmployments = await this.prisma.employmentRecord.findMany({
      where: {
        company_id,
        deleted_at: null,
        status_code: 'EMPLOYMENT_STATUS_ACTIVE',
      },
      select: {
        id: true,
        monthly_orders_target: true,
        employee_no: true,
        full_name_ar: true,
        full_name_en: true,
        recruitment_candidate: {
          select: { full_name_ar: true, full_name_en: true },
        },
      },
    });

    const employmentIds = activeEmployments.map((e) => e.id);
    if (employmentIds.length === 0) {
      return {
        pie: { totalTarget: 0, totalAchieved: 0 },
        byEmployee: [],
      };
    }

    const ordersByEmployee = await this.prisma.dailyOperation.groupBy({
      by: ['employment_record_id'],
      where: {
        company_id,
        employment_record_id: { in: employmentIds },
        date: { gte: dateFrom, lte: dateTo },
      },
      _sum: { orders_count: true },
    });

    const achievedMap = new Map(
      ordersByEmployee.map((r) => [
        r.employment_record_id,
        r._sum.orders_count ?? 0,
      ]),
    );

    let totalTarget = 0;
    const byEmployee: Array<{
      employment_record_id: string;
      full_name_ar: string;
      full_name_en: string | null;
      orders_count: number;
      monthly_orders_target: number | null;
    }> = [];

    for (const emp of activeEmployments) {
      const target = emp.monthly_orders_target ?? 0;
      totalTarget += target;
      const orders_count = achievedMap.get(emp.id) ?? 0;
      const nameAr =
        emp.recruitment_candidate?.full_name_ar ??
        emp.full_name_ar ??
        emp.employee_no ??
        emp.id;
      const nameEn =
        emp.recruitment_candidate?.full_name_en ?? emp.full_name_en ?? null;
      byEmployee.push({
        employment_record_id: emp.id,
        full_name_ar: nameAr,
        full_name_en: nameEn,
        orders_count,
        monthly_orders_target: emp.monthly_orders_target,
      });
    }

    const totalAchieved = byEmployee.reduce((s, e) => s + e.orders_count, 0);

    return {
      pie: { totalTarget, totalAchieved },
      byEmployee,
    };
  }

  async createOne(
    company_id: string,
    actor_user_id: string,
    input: CreateInput,
  ) {
    const timeZone = await this.resolveCompanyTimezone(company_id);
    const {
      parsed: date,
      startOfDay,
      endOfDay,
    } = this.ensureNotFuture(input.date, timeZone);
    const employment = await this.ensureActiveEmployment(
      company_id,
      input.employment_record_id,
    );
    await this.ensureNoExistingEntryForDay(
      company_id,
      input.employment_record_id,
      startOfDay,
      endOfDay,
    );
    const normalized = this.normalizeNumbers(input);
    const isDraft = input.submit_action === 'draft';

    if (!isDraft) {
      this.validateForApproval(normalized, input);
      await this.ensureDayNotClosed(company_id, startOfDay, endOfDay);
    }

    const status_code = this.buildStatus(normalized, isDraft);
    const difference_amount =
      normalized.cash_received - normalized.cash_collected;
    const platform = employment.assigned_platform ?? OperatingPlatform.NONE;

    const created = await this.prisma.dailyOperation.create({
      data: {
        company_id,
        employment_record_id: input.employment_record_id,
        date,
        platform,
        orders_count: normalized.orders_count,
        total_revenue: normalized.total_revenue,
        cash_collected: normalized.cash_collected,
        cash_received: normalized.cash_received,
        difference_amount,
        tips: normalized.tips,
        deduction_amount: normalized.deduction_amount,
        deduction_reason:
          normalized.deduction_amount > 0
            ? (input.deduction_reason ?? null)
            : null,
        is_draft: isDraft,
        approved_at: isDraft ? null : new Date(),
        approved_by_user_id: isDraft ? null : actor_user_id,
        status_code,
        created_by_user_id: actor_user_id,
      },
    });

    await this.audit.log({
      company_id,
      actor_user_id,
      action: isDraft ? 'OPS_DAILY_CREATE_DRAFT' : 'OPS_DAILY_CREATE_APPROVED',
      entity_type: 'DAILY_OPERATION',
      entity_id: created.id,
      new_values: created,
    });

    return created;
  }

  async createBulk(
    company_id: string,
    actor_user_id: string,
    input: { date: string; submit_action: SubmitAction; rows: BulkRowInput[] },
  ) {
    if (input.rows.length === 0)
      throw new BadRequestException(
        'OPS_DAILY_010: At least one row is required',
      );
    const timeZone = await this.resolveCompanyTimezone(company_id);
    const {
      parsed: date,
      startOfDay,
      endOfDay,
    } = this.ensureNotFuture(input.date, timeZone);
    const isDraft = input.submit_action === 'draft';

    if (!isDraft) {
      await this.ensureDayNotClosed(company_id, startOfDay, endOfDay);
    }

    const operationsData = [];
    const seen = new Set<string>();
    for (const row of input.rows) {
      if (seen.has(row.employment_record_id)) {
        throw new BadRequestException(
          'OPS_DAILY_011: Duplicate employees are not allowed',
        );
      }
      seen.add(row.employment_record_id);

      const employment = await this.ensureActiveEmployment(
        company_id,
        row.employment_record_id,
      );
      await this.ensureNoExistingEntryForDay(
        company_id,
        row.employment_record_id,
        startOfDay,
        endOfDay,
      );
      const normalized = this.normalizeNumbers({
        ...row,
        submit_action: input.submit_action,
        date: input.date,
      });
      if (!isDraft) {
        this.validateForApproval(normalized, row as CreateInput);
      }
      const difference_amount =
        normalized.cash_received - normalized.cash_collected;

      operationsData.push({
        company_id,
        employment_record_id: row.employment_record_id,
        date,
        platform: employment.assigned_platform ?? OperatingPlatform.NONE,
        orders_count: normalized.orders_count,
        total_revenue: normalized.total_revenue,
        cash_collected: normalized.cash_collected,
        cash_received: normalized.cash_received,
        difference_amount,
        tips: normalized.tips,
        deduction_amount: normalized.deduction_amount,
        deduction_reason:
          normalized.deduction_amount > 0
            ? (row.deduction_reason ?? null)
            : null,
        is_draft: isDraft,
        approved_at: isDraft ? null : new Date(),
        approved_by_user_id: isDraft ? null : actor_user_id,
        status_code: this.buildStatus(normalized, isDraft),
        created_by_user_id: actor_user_id,
      });
    }

    const created = await this.prisma.dailyOperation.createMany({
      data: operationsData,
    });

    await this.audit.log({
      company_id,
      actor_user_id,
      action: isDraft ? 'OPS_DAILY_BULK_DRAFT' : 'OPS_DAILY_BULK_APPROVED',
      entity_type: 'DAILY_OPERATION',
      entity_id: created.count.toString(),
      new_values: { date: input.date, count: created.count },
    });

    return { created: created.count };
  }

  async updateStatus(
    company_id: string,
    actor_user_id: string,
    id: string,
    status_code: string,
  ) {
    const existing = await this.prisma.dailyOperation.findFirst({
      where: { id, company_id },
    });
    if (!existing)
      throw new NotFoundException('OPS_DAILY_020: Operation not found');

    const updated = await this.prisma.dailyOperation.update({
      where: { id },
      data: { status_code },
    });

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'OPS_DAILY_STATUS_UPDATE',
      entity_type: 'DAILY_OPERATION',
      entity_id: id,
      old_values: { status_code: existing.status_code },
      new_values: { status_code: updated.status_code },
    });

    return updated;
  }

  async delete(company_id: string, actor_user_id: string, id: string) {
    const existing = await this.prisma.dailyOperation.findFirst({
      where: { id, company_id },
    });
    if (!existing)
      throw new NotFoundException('OPS_DAILY_020: Operation not found');
    if (existing.status_code !== 'DRAFT') {
      throw new BadRequestException(
        'OPS_DAILY_021: Only draft operations can be deleted',
      );
    }

    await this.prisma.dailyOperation.delete({ where: { id } });

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'OPS_DAILY_DELETE',
      entity_type: 'DAILY_OPERATION',
      entity_id: id,
      old_values: existing,
    });
  }

  async updateRecord(
    company_id: string,
    actor_user_id: string,
    id: string,
    input: {
      orders_count: number;
      total_revenue: number;
      cash_collected: number;
      cash_received: number;
      tips: number;
      deduction_amount: number;
      deduction_reason?: string | null;
    },
  ) {
    const existing = await this.prisma.dailyOperation.findFirst({
      where: { id, company_id },
    });
    if (!existing)
      throw new NotFoundException('OPS_DAILY_020: Operation not found');
    if (
      existing.status_code !== 'DRAFT' &&
      existing.status_code !== 'APPROVED'
    ) {
      throw new BadRequestException(
        'OPS_DAILY_022: Only draft or approved operations can be edited',
      );
    }

    const normalized = this.normalizeNumbers({
      ...input,
      employment_record_id: existing.employment_record_id,
      date: existing.date.toISOString(),
      submit_action: existing.status_code === 'DRAFT' ? 'draft' : 'approve',
    });
    this.validateForApproval(normalized, {
      ...input,
      employment_record_id: existing.employment_record_id,
      date: existing.date.toISOString(),
      submit_action: existing.status_code === 'DRAFT' ? 'draft' : 'approve',
      deduction_reason: input.deduction_reason ?? undefined,
    });

    const difference_amount =
      normalized.cash_received - normalized.cash_collected;
    const newStatus =
      existing.status_code === 'DRAFT'
        ? 'DRAFT'
        : normalized.deduction_amount > 0
          ? 'FLAGGED_DEDUCTION'
          : 'APPROVED';

    const updated = await this.prisma.dailyOperation.update({
      where: { id },
      data: {
        orders_count: normalized.orders_count,
        total_revenue: normalized.total_revenue,
        cash_collected: normalized.cash_collected,
        cash_received: normalized.cash_received,
        tips: normalized.tips,
        deduction_amount: normalized.deduction_amount,
        deduction_reason:
          normalized.deduction_amount > 0
            ? (input.deduction_reason ?? null)
            : null,
        difference_amount,
        status_code: newStatus,
      },
    });

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'OPS_DAILY_UPDATE',
      entity_type: 'DAILY_OPERATION',
      entity_id: id,
      old_values: existing,
      new_values: updated,
    });

    return updated;
  }
}
