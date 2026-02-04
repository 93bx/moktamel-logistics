import { randomUUID } from 'crypto';
import { BadRequestException, HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { CashHandoverStatus, CashTransactionStatus, CashTransactionType, Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../prisma/prisma.service';

type SubmitAction = 'draft' | 'approve';

type DateRange = { from: Date; to: Date };

@Injectable()
export class CashLoansService {
  private readonly logger = new Logger(CashLoansService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly analytics: AnalyticsService,
  ) {}

  private async resolveCompanyTimezone(company_id: string) {
    const company = await this.prisma.company.findUnique({ where: { id: company_id }, select: { timezone: true, slug: true } });
    return { tz: company?.timezone ?? 'Asia/Riyadh', slug: company?.slug ?? company_id.slice(0, 8) };
  }

  private getMonthBounds(now: Date, timeZone: string): DateRange {
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
    const parts: Record<string, string> = {};
    for (const part of fmt.formatToParts(now)) {
      if (part.type !== 'literal') parts[part.type] = part.value;
    }
    const year = Number(parts.year);
    const month = Number(parts.month);
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, Number(parts.day), 23, 59, 59, 999));
    return { from: start, to: end };
  }

  private getMonthToDateRange(target: Date, timeZone: string): DateRange {
    const parts: Record<string, string> = {};
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
    for (const part of fmt.formatToParts(target)) {
      if (part.type !== 'literal') parts[part.type] = part.value;
    }
    const year = Number(parts.year);
    const month = Number(parts.month);
    const day = Number(parts.day);
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999));
    return { from: start, to: end };
  }

  private ensureCurrentMonth(dateStr: string, timeZone: string) {
    const parsed = new Date(dateStr);
    if (isNaN(parsed.getTime())) throw new BadRequestException('FIN_CASH_001: Invalid date');
    const now = new Date();
    const { from, to } = this.getMonthBounds(now, timeZone);
    if (parsed.getTime() < from.getTime() || parsed.getTime() > to.getTime()) {
      throw new BadRequestException('FIN_CASH_002: Date must be within the current month and not in the future');
    }
    return parsed;
  }

  private async ensureActiveEmployment(company_id: string, employment_record_id: string) {
    const employment = await this.prisma.employmentRecord.findFirst({
      where: { id: employment_record_id, company_id, deleted_at: null, status_code: 'EMPLOYMENT_STATUS_ACTIVE' },
      select: {
        id: true,
        employee_no: true,
        recruitment_candidate: { select: { full_name_ar: true, full_name_en: true } },
      },
    });
    if (!employment) throw new BadRequestException('FIN_CASH_003: Employment record must be active');
    return employment;
  }

  private async ensureWallet(company_id: string, user_id: string, actor_user_id: string) {
    const wallet = await this.prisma.walletBalance.upsert({
      where: { company_id_user_id: { company_id, user_id } },
      update: {},
      create: { company_id, user_id, balance: 0, created_by_user_id: actor_user_id },
    });
    return wallet;
  }

  private async verifyFile(company_id: string, file_id?: string | null) {
    if (!file_id) return null;
    const file = await this.prisma.fileObject.findFirst({ where: { id: file_id, company_id, deleted_at: null }, select: { id: true } });
    if (!file) throw new BadRequestException('FIN_CASH_004: Attachment not found for this company');
    return file.id;
  }

  private async nextReceipt(company_id: string, company_slug: string, prefix: string) {
    const counter = await this.prisma.usageCounter.upsert({
      where: { company_id_counter_code: { company_id, counter_code: prefix } },
      update: { value: { increment: 1 } },
      create: { company_id, counter_code: prefix, value: 1 },
      select: { value: true },
    });
    return `${company_slug.toUpperCase()}-${prefix}-${String(counter.value).padStart(6, '0')}`;
  }

  private async applyWalletDelta(company_id: string, user_id: string, delta: Prisma.Decimal, actor_user_id: string) {
    const wallet = await this.ensureWallet(company_id, user_id, actor_user_id);
    const newBalance = new Prisma.Decimal(wallet.balance).plus(delta);
    if (newBalance.lt(0)) throw new BadRequestException('FIN_CASH_005: Wallet balance cannot be negative');
    const updated = await this.prisma.walletBalance.update({
      where: { company_id_user_id: { company_id, user_id } },
      data: { balance: newBalance, updated_at: new Date() },
    });
    return updated;
  }

  private async computeAggregates(company_id: string, range: DateRange) {
    const opsAgg = await this.prisma.dailyOperation.groupBy({
      by: ['employment_record_id'],
      where: {
        company_id,
        date: { gte: range.from, lte: range.to },
        is_draft: false,
      },
      _sum: { total_revenue: true, cash_collected: true, deduction_amount: true, loan_amount: true },
    });

    const txnAgg = await this.prisma.cashTransaction.groupBy({
      by: ['employment_record_id', 'type'],
      where: {
        company_id,
        employment_record_id: { not: null },
        status: CashTransactionStatus.APPROVED,
        date: { gte: range.from, lte: range.to },
        type: { in: [CashTransactionType.RECEIPT, CashTransactionType.LOAN, CashTransactionType.DEDUCTION] },
      },
      _sum: { amount: true },
    });

    return { opsAgg, txnAgg };
  }

  async stats(company_id: string, user_id: string, input: { date_from?: string; date_to?: string }) {
    try {
      this.logger.debug(`Computing stats for company ${company_id}, user ${user_id}`, { input });
      
      const { tz } = await this.resolveCompanyTimezone(company_id);
      this.logger.debug(`Resolved timezone: ${tz}`);
      
      const range = this.normalizeRange(input, tz);
      this.logger.debug(`Normalized range:`, { from: range.from, to: range.to });

      this.logger.debug('Starting parallel queries...');
      const [{ _sum: txnSum }, loans, wallet] = await Promise.all([
        this.prisma.cashTransaction.aggregate({
          where: {
            company_id,
            status: CashTransactionStatus.APPROVED,
            type: CashTransactionType.RECEIPT,
            date: { gte: range.from, lte: range.to },
          },
          _sum: { amount: true },
        }),
        this.prisma.cashTransaction.aggregate({
          where: {
            company_id,
            status: CashTransactionStatus.APPROVED,
            type: CashTransactionType.LOAN,
            date: { gte: range.from, lte: range.to },
          },
          _sum: { amount: true },
        }),
        this.ensureWallet(company_id, user_id, user_id),
      ]);
      
      this.logger.debug('Parallel queries completed', { 
        txnSum: txnSum.amount, 
        loans: loans._sum.amount,
        walletBalance: wallet.balance 
      });

      this.logger.debug('Computing not collected total...');
      const notCollectedAgg = await this.computeNotCollectedTotal(company_id, range);
      this.logger.debug(`Not collected total: ${notCollectedAgg}`);

      return {
        myWallet: Number(wallet.balance ?? 0),
        cashNotCollected: notCollectedAgg,
        totalLoans: Number(loans._sum.amount ?? 0),
        cashCollected: Number(txnSum.amount ?? 0),
      };
    } catch (error) {
      this.logger.error(
        `Error computing cash loans stats`,
        error instanceof Error ? error.stack : undefined,
        {
          company_id,
          user_id,
          input,
          error: error instanceof Error ? error.message : String(error),
        },
      );
      
      // Re-throw HttpExceptions as-is
      if (error instanceof HttpException) {
        throw error;
      }
      
      // Wrap other errors
      throw new HttpException(
        {
          error_code: 'FIN_CASH_LOANS_STATS_001',
          message: `Failed to compute cash loans stats: ${error instanceof Error ? error.message : String(error)}`,
          details: {
            company_id,
            user_id,
            input,
          },
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private normalizeRange(input: { date_from?: string; date_to?: string }, tz: string): DateRange {
    const now = new Date();
    const month = this.getMonthBounds(now, tz);
    const fromCandidate = input.date_from ? new Date(input.date_from) : month.from;
    const toCandidate = input.date_to ? new Date(input.date_to) : month.to;
    const from = isNaN(fromCandidate.getTime()) ? month.from : fromCandidate;
    const toRaw = isNaN(toCandidate.getTime()) ? month.to : toCandidate;
    const cappedTo = toRaw.getTime() > month.to.getTime() ? month.to : toRaw;
    return { from, to: cappedTo };
  }

  private async computeNotCollectedTotal(company_id: string, range: DateRange) {
    const opsAgg = await this.prisma.dailyOperation.groupBy({
      by: ['employment_record_id'],
      where: { company_id, date: { gte: range.from, lte: range.to }, is_draft: false },
      _sum: { cash_collected: true, deduction_amount: true },
    });
    const receiptsAgg = await this.prisma.cashTransaction.groupBy({
      by: ['employment_record_id', 'type'],
      where: {
        company_id,
        employment_record_id: { not: null },
        status: CashTransactionStatus.APPROVED,
        date: { gte: range.from, lte: range.to },
        type: { in: [CashTransactionType.RECEIPT, CashTransactionType.DEDUCTION] },
      },
      _sum: { amount: true },
    });

    const receiptMap = new Map<string, { receipt: Prisma.Decimal; deduction: Prisma.Decimal }>();
    for (const row of receiptsAgg) {
      const key = row.employment_record_id!;
      const entry = receiptMap.get(key) ?? { receipt: new Prisma.Decimal(0), deduction: new Prisma.Decimal(0) };
      if (row.type === CashTransactionType.RECEIPT) entry.receipt = entry.receipt.plus(row._sum.amount ?? 0);
      if (row.type === CashTransactionType.DEDUCTION) entry.deduction = entry.deduction.plus(row._sum.amount ?? 0);
      receiptMap.set(key, entry);
    }

    let total = new Prisma.Decimal(0);
    for (const op of opsAgg) {
      const key = op.employment_record_id!;
      const receipts = receiptMap.get(key);
      const collected = new Prisma.Decimal(op._sum.cash_collected ?? 0);
      const deductions = new Prisma.Decimal(op._sum.deduction_amount ?? 0);
      const receiptsSum = receipts?.receipt ?? new Prisma.Decimal(0);
      const deductionTx = receipts?.deduction ?? new Prisma.Decimal(0);
      const remaining = collected.minus(receiptsSum).minus(deductionTx).minus(deductions);
      if (remaining.gt(0)) total = total.plus(remaining);
    }
    return Number(total);
  }

  private async computeEmployeeDue(company_id: string, employment_record_id: string, range: DateRange) {
    const [opsAgg, receiptsAgg, deductionAgg] = await Promise.all([
      this.prisma.dailyOperation.aggregate({
        where: { company_id, employment_record_id, is_draft: false, date: { gte: range.from, lte: range.to } },
        _sum: { cash_collected: true, deduction_amount: true },
      }),
      this.prisma.cashTransaction.aggregate({
        where: {
          company_id,
          employment_record_id,
          status: CashTransactionStatus.APPROVED,
          type: CashTransactionType.RECEIPT,
          date: { gte: range.from, lte: range.to },
        },
        _sum: { amount: true },
      }),
      this.prisma.cashTransaction.aggregate({
        where: {
          company_id,
          employment_record_id,
          status: CashTransactionStatus.APPROVED,
          type: CashTransactionType.DEDUCTION,
          date: { gte: range.from, lte: range.to },
        },
        _sum: { amount: true },
      }),
    ]);

    const collected = new Prisma.Decimal(opsAgg._sum.cash_collected ?? 0);
    const opsDeductions = new Prisma.Decimal(opsAgg._sum.deduction_amount ?? 0);
    const receipts = new Prisma.Decimal(receiptsAgg._sum.amount ?? 0);
    const deductionTx = new Prisma.Decimal(deductionAgg._sum.amount ?? 0);

    return collected.minus(receipts).minus(opsDeductions).minus(deductionTx);
  }

  async searchEmployees(company_id: string, q: string) {
    const term = q.trim();
    if (term.length < 1) return [];
    return this.prisma.employmentRecord.findMany({
      where: {
        company_id,
        deleted_at: null,
        status_code: 'EMPLOYMENT_STATUS_ACTIVE',
        OR: [
          { employee_no: { contains: term, mode: 'insensitive' } },
          {
            recruitment_candidate: {
              OR: [
                { full_name_ar: { contains: term, mode: 'insensitive' } },
                { full_name_en: { contains: term, mode: 'insensitive' } },
              ],
            },
          },
        ],
      },
      select: {
        id: true,
        employee_no: true,
        recruitment_candidate: { select: { full_name_ar: true, full_name_en: true } },
      },
      take: 15,
    });
  }

  async listEmployees(company_id: string, input: { q?: string; status?: 'balanced' | 'unbalanced'; page: number; page_size: number; date_from?: string; date_to?: string }) {
    const { tz } = await this.resolveCompanyTimezone(company_id);
    const range = this.normalizeRange(input, tz);

    const baseWhere: Prisma.EmploymentRecordWhereInput = {
      company_id,
      deleted_at: null,
      status_code: 'EMPLOYMENT_STATUS_ACTIVE',
    };
    if (input.q) {
      baseWhere.OR = [
        { employee_no: { contains: input.q, mode: 'insensitive' } },
        {
          recruitment_candidate: {
            OR: [
              { full_name_ar: { contains: input.q, mode: 'insensitive' } },
              { full_name_en: { contains: input.q, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    const employees = await this.prisma.employmentRecord.findMany({
      where: baseWhere,
      select: {
        id: true,
        employee_no: true,
        employee_code: true,
        avatar_file_id: true,
        full_name_ar: true,
        full_name_en: true,
        recruitment_candidate: { select: { full_name_ar: true, full_name_en: true } },
      },
    });

    const ids = employees.map((e) => e.id);
    if (ids.length === 0) return { items: [], total: 0, page: input.page, page_size: input.page_size };

    const { opsAgg, txnAgg } = await this.computeAggregates(company_id, range);
    const opsMap = new Map<string, (typeof opsAgg)[number]>();
    opsAgg.forEach((row) => {
      if (row.employment_record_id) opsMap.set(row.employment_record_id, row);
    });

    const txnMap = new Map<string, { receipt: Prisma.Decimal; loan: Prisma.Decimal; deduction: Prisma.Decimal }>();
    txnAgg.forEach((row: { employment_record_id: string | null; type: CashTransactionType; _sum: { amount: Prisma.Decimal | null } }) => {
      if (!row.employment_record_id) return;
      const entry = txnMap.get(row.employment_record_id) ?? { receipt: new Prisma.Decimal(0), loan: new Prisma.Decimal(0), deduction: new Prisma.Decimal(0) };
      if (row.type === CashTransactionType.RECEIPT) entry.receipt = entry.receipt.plus(row._sum.amount ?? 0);
      if (row.type === CashTransactionType.LOAN) entry.loan = entry.loan.plus(row._sum.amount ?? 0);
      if (row.type === CashTransactionType.DEDUCTION) entry.deduction = entry.deduction.plus(row._sum.amount ?? 0);
      txnMap.set(row.employment_record_id, entry);
    });

    const computed = employees.map((emp) => {
      const ops = opsMap.get(emp.id);
      const tx = txnMap.get(emp.id);
      const totalRevenue = new Prisma.Decimal(ops?._sum.total_revenue ?? 0);
      const totalCashCollected = new Prisma.Decimal(ops?._sum.cash_collected ?? 0);
      const loans = tx?.loan ?? new Prisma.Decimal(0);
      const receipts = tx?.receipt ?? new Prisma.Decimal(0);
      const deductions = (tx?.deduction ?? new Prisma.Decimal(0)).plus(new Prisma.Decimal(ops?._sum.deduction_amount ?? 0));
      const notCollected = totalCashCollected.minus(receipts).minus(deductions);
      const balanced = notCollected.lte(0);
      return {
        id: emp.id,
        employee_no: emp.employee_no,
        employee_code: emp.employee_code,
        avatar_file_id: emp.avatar_file_id,
        full_name_ar: emp.recruitment_candidate?.full_name_ar ?? emp.full_name_ar ?? '',
        full_name_en: emp.recruitment_candidate?.full_name_en ?? emp.full_name_en ?? '',
        total_revenue: Number(totalRevenue),
        total_cash_collected: Number(totalCashCollected),
        total_cash_not_collected: Math.max(0, Number(notCollected)),
        total_loans: Number(loans),
        total_deductions: Number(deductions),
        status: balanced ? 'BALANCED' : 'UNBALANCED',
      };
    });

    const filtered =
      input.status === 'balanced'
        ? computed.filter((c) => c.status === 'BALANCED')
        : input.status === 'unbalanced'
          ? computed.filter((c) => c.status === 'UNBALANCED')
          : computed;

    const total = filtered.length;
    const start = (input.page - 1) * input.page_size;
    const end = start + input.page_size;
    const paged = filtered.slice(start, end);

    return { items: paged, total, page: input.page, page_size: input.page_size };
  }

  async employeeDetail(company_id: string, employment_record_id: string, input: { date_from?: string; date_to?: string }) {
    const { tz } = await this.resolveCompanyTimezone(company_id);
    const range = this.normalizeRange(input, tz);
    const employment = await this.prisma.employmentRecord.findFirst({
      where: { id: employment_record_id, company_id, deleted_at: null },
      select: { id: true, employee_no: true, recruitment_candidate: { select: { full_name_ar: true, full_name_en: true } } },
    });
    if (!employment) throw new NotFoundException('FIN_CASH_006: Employee not found');

    const [opsAgg, txns] = await Promise.all([
      this.prisma.dailyOperation.aggregate({
        where: { company_id, employment_record_id, date: { gte: range.from, lte: range.to }, is_draft: false },
        _sum: { total_revenue: true, cash_collected: true, deduction_amount: true, loan_amount: true, cash_received: true },
      }),
      this.prisma.cashTransaction.findMany({
        where: { company_id, employment_record_id, date: { gte: range.from, lte: range.to } },
        orderBy: { date: 'desc' },
        select: {
          id: true,
          date: true,
          type: true,
          status: true,
          amount: true,
          balance_after: true,
          receipt_no: true,
          description: true,
        },
      }),
    ]);

    const receipts = txns
      .filter((t) => t.type === CashTransactionType.RECEIPT)
      .reduce((acc: Prisma.Decimal, t) => acc.plus(t.amount), new Prisma.Decimal(0));
    const deductionTx = txns
      .filter((t) => t.type === CashTransactionType.DEDUCTION)
      .reduce((acc: Prisma.Decimal, t) => acc.plus(t.amount), new Prisma.Decimal(0));
    const notCollected = new Prisma.Decimal(opsAgg._sum.cash_collected ?? 0)
      .minus(receipts)
      .minus(new Prisma.Decimal(opsAgg._sum.deduction_amount ?? 0))
      .minus(deductionTx);

    return {
      employee: employment,
      summary: {
        total_revenue: Number(opsAgg._sum.total_revenue ?? 0),
        total_cash: Number(opsAgg._sum.cash_collected ?? 0),
        total_loan: Number(opsAgg._sum.loan_amount ?? 0),
        total_deductions: Number(opsAgg._sum.deduction_amount ?? 0),
        cash_not_collected: Math.max(0, Number(notCollected)),
      },
      transactions: txns.map((t) => ({
        id: t.id,
        date: t.date,
        type: t.type,
        status: t.status,
        amount: Number(t.amount),
        balance_after: t.balance_after ? Number(t.balance_after) : null,
        receipt_no: t.receipt_no,
        description: t.description,
      })),
    };
  }

  async createReceipt(company_id: string, actor_user_id: string, input: { employment_record_id: string; amount: number; date: string; attachment_file_id?: string | null; submit_action: SubmitAction }) {
    const { tz, slug } = await this.resolveCompanyTimezone(company_id);
    const date = this.ensureCurrentMonth(input.date, tz);
    const employment = await this.ensureActiveEmployment(company_id, input.employment_record_id);
    const attachment = await this.verifyFile(company_id, input.attachment_file_id);

    const amount = Number(input.amount ?? 0);
    if (amount <= 0) throw new BadRequestException('FIN_CASH_007: Amount must be positive');
    const isDraft = input.submit_action === 'draft';
    if (!isDraft && !attachment) throw new BadRequestException('FIN_CASH_008: Attachment required for approval');
    const monthRange = this.getMonthToDateRange(date, tz);
    const due = await this.computeEmployeeDue(company_id, employment.id, monthRange);
    if (!isDraft && new Prisma.Decimal(amount).gt(due)) {
      throw new BadRequestException('FIN_CASH_021: Amount exceeds outstanding due');
    }

    return this.prisma.$transaction(async (trx) => {
      const company = slug;
      let receipt_no: string | null = null;
      let balance_after: Prisma.Decimal | null = null;

      if (!isDraft) {
        const counter = await trx.usageCounter.upsert({
          where: { company_id_counter_code: { company_id, counter_code: 'CASH_RECEIPT_SEQ' } },
          update: { value: { increment: 1 } },
          create: { company_id, counter_code: 'CASH_RECEIPT_SEQ', value: 1 },
          select: { value: true },
        });
        receipt_no = `${company.toUpperCase()}-RCPT-${String(counter.value).padStart(6, '0')}`;
        const wallet = await this.ensureWallet(company_id, actor_user_id, actor_user_id);
        const newBalance = new Prisma.Decimal(wallet.balance).plus(amount);
        balance_after = newBalance;
        await trx.walletBalance.update({
          where: { company_id_user_id: { company_id, user_id: actor_user_id } },
          data: { balance: newBalance, updated_at: new Date() },
        });
      }

      const created = await trx.cashTransaction.create({
        data: {
          company_id,
          employment_record_id: employment.id,
          supervisor_user_id: actor_user_id,
          type: CashTransactionType.RECEIPT,
          status: isDraft ? CashTransactionStatus.DRAFT : CashTransactionStatus.APPROVED,
          amount,
          date,
          receipt_no,
          attachment_file_id: attachment,
          balance_after: balance_after ?? undefined,
          description: null,
          created_by_user_id: actor_user_id,
        },
      });

      await this.audit.log({
        company_id,
        actor_user_id,
        action: isDraft ? 'FIN_CASH_RECEIPT_DRAFT' : 'FIN_CASH_RECEIPT_APPROVED',
        entity_type: 'CASH_TRANSACTION',
        entity_id: created.id,
        new_values: created,
      });

      if (!isDraft) {
        await this.analytics.track({
          company_id,
          actor_user_id,
          event_code: 'FIN_CASH_RECEIPT_APPROVED',
          entity_type: 'CASH_TRANSACTION',
          entity_id: created.id,
          payload: { amount, employment_record_id: employment.id },
        });
      }

      return created;
    });
  }

  async createLoan(company_id: string, actor_user_id: string, input: { employment_record_id: string; amount: number; reason?: string; supervisor_user_id?: string | null; date: string; submit_action: SubmitAction }) {
    const { tz, slug } = await this.resolveCompanyTimezone(company_id);
    const date = this.ensureCurrentMonth(input.date, tz);
    const employment = await this.ensureActiveEmployment(company_id, input.employment_record_id);
    const amount = Number(input.amount ?? 0);
    if (amount <= 0) throw new BadRequestException('FIN_CASH_009: Loan amount must be positive');
    const isDraft = input.submit_action === 'draft';

    return this.prisma.$transaction(async (trx) => {
      let receipt_no: string | null = null;
      let balance_after: Prisma.Decimal | null = null;

      if (!isDraft) {
        const counter = await trx.usageCounter.upsert({
          where: { company_id_counter_code: { company_id, counter_code: 'CASH_LOAN_SEQ' } },
          update: { value: { increment: 1 } },
          create: { company_id, counter_code: 'CASH_LOAN_SEQ', value: 1 },
          select: { value: true },
        });
        receipt_no = `${slug.toUpperCase()}-LOAN-${String(counter.value).padStart(6, '0')}`;
        const wallet = await this.ensureWallet(company_id, actor_user_id, actor_user_id);
        const newBalance = new Prisma.Decimal(wallet.balance).minus(amount);
        if (newBalance.lt(0)) throw new BadRequestException('FIN_CASH_010: Loan exceeds supervisor wallet balance');
        balance_after = newBalance;
        await trx.walletBalance.update({
          where: { company_id_user_id: { company_id, user_id: actor_user_id } },
          data: { balance: newBalance, updated_at: new Date() },
        });
      }

      const created = await trx.cashTransaction.create({
        data: {
          company_id,
          employment_record_id: employment.id,
          supervisor_user_id: input.supervisor_user_id ?? actor_user_id,
          type: CashTransactionType.LOAN,
          status: isDraft ? CashTransactionStatus.DRAFT : CashTransactionStatus.APPROVED,
          amount,
          date,
          receipt_no,
          description: input.reason ?? null,
          balance_after: balance_after ?? undefined,
          created_by_user_id: actor_user_id,
        },
      });

      await this.audit.log({
        company_id,
        actor_user_id,
        action: isDraft ? 'FIN_CASH_LOAN_DRAFT' : 'FIN_CASH_LOAN_APPROVED',
        entity_type: 'CASH_TRANSACTION',
        entity_id: created.id,
        new_values: created,
      });

      if (!isDraft) {
        await this.analytics.track({
          company_id,
          actor_user_id,
          event_code: 'FIN_CASH_LOAN_APPROVED',
          entity_type: 'CASH_TRANSACTION',
          entity_id: created.id,
          payload: { amount, employment_record_id: employment.id },
        });
      }

      return created;
    });
  }

  async createDeduction(company_id: string, actor_user_id: string, input: { employment_record_id: string; amount: number; reason?: string | null; date: string; submit_action: SubmitAction }) {
    const { tz, slug } = await this.resolveCompanyTimezone(company_id);
    const date = this.ensureCurrentMonth(input.date, tz);
    const employment = await this.ensureActiveEmployment(company_id, input.employment_record_id);
    const amount = Number(input.amount ?? 0);
    if (amount <= 0) throw new BadRequestException('FIN_CASH_011: Deduction amount must be positive');
    const isDraft = input.submit_action === 'draft';

    return this.prisma.$transaction(async (trx) => {
      let receipt_no: string | null = null;
      let balance_after: Prisma.Decimal | null = null;

      if (!isDraft) {
        const counter = await trx.usageCounter.upsert({
          where: { company_id_counter_code: { company_id, counter_code: 'CASH_DED_SEQ' } },
          update: { value: { increment: 1 } },
          create: { company_id, counter_code: 'CASH_DED_SEQ', value: 1 },
          select: { value: true },
        });
        receipt_no = `${slug.toUpperCase()}-DED-${String(counter.value).padStart(6, '0')}`;
        const wallet = await this.ensureWallet(company_id, actor_user_id, actor_user_id);
        const newBalance = new Prisma.Decimal(wallet.balance).plus(amount);
        balance_after = newBalance;
        await trx.walletBalance.update({
          where: { company_id_user_id: { company_id, user_id: actor_user_id } },
          data: { balance: newBalance, updated_at: new Date() },
        });
      }

      const created = await trx.cashTransaction.create({
        data: {
          company_id,
          employment_record_id: employment.id,
          supervisor_user_id: actor_user_id,
          type: CashTransactionType.DEDUCTION,
          status: isDraft ? CashTransactionStatus.DRAFT : CashTransactionStatus.APPROVED,
          amount,
          date,
          receipt_no,
          description: input.reason ?? null,
          balance_after: balance_after ?? undefined,
          created_by_user_id: actor_user_id,
        },
      });

      await this.audit.log({
        company_id,
        actor_user_id,
        action: isDraft ? 'FIN_CASH_DED_DRAFT' : 'FIN_CASH_DED_APPROVED',
        entity_type: 'CASH_TRANSACTION',
        entity_id: created.id,
        new_values: created,
      });

      return created;
    });
  }

  async updateTransactionStatus(company_id: string, actor_user_id: string, id: string, action: SubmitAction, attachment_file_id?: string | null) {
    const existing = await this.prisma.cashTransaction.findFirst({ where: { id, company_id } });
    if (!existing) throw new NotFoundException('FIN_CASH_012: Transaction not found');
    if (existing.status !== CashTransactionStatus.DRAFT) throw new BadRequestException('FIN_CASH_013: Only drafts can be updated');

    const attachment = await this.verifyFile(company_id, attachment_file_id ?? existing.attachment_file_id);
    const { slug } = await this.resolveCompanyTimezone(company_id);

    if (action === 'draft') {
      await this.audit.log({
        company_id,
        actor_user_id,
        action: 'FIN_CASH_DRAFT_UPDATE',
        entity_type: 'CASH_TRANSACTION',
        entity_id: id,
        old_values: existing,
        new_values: existing,
      });
      return existing;
    }

    return this.prisma.$transaction(async (trx) => {
      let receipt_no = existing.receipt_no;
      let balance_after: Prisma.Decimal | null = null;

      if (!receipt_no) {
        const code = existing.type === CashTransactionType.LOAN ? 'CASH_LOAN_SEQ' : existing.type === CashTransactionType.DEDUCTION ? 'CASH_DED_SEQ' : 'CASH_RECEIPT_SEQ';
        const prefix = existing.type === CashTransactionType.LOAN ? 'LOAN' : existing.type === CashTransactionType.DEDUCTION ? 'DED' : 'RCPT';
        const counter = await trx.usageCounter.upsert({
          where: { company_id_counter_code: { company_id, counter_code: code } },
          update: { value: { increment: 1 } },
          create: { company_id, counter_code: code, value: 1 },
          select: { value: true },
        });
        receipt_no = `${slug.toUpperCase()}-${prefix}-${String(counter.value).padStart(6, '0')}`;
      }

      const amount = new Prisma.Decimal(existing.amount);
      if (existing.type === CashTransactionType.RECEIPT || existing.type === CashTransactionType.DEDUCTION) {
        const wallet = await this.ensureWallet(company_id, actor_user_id, actor_user_id);
        const newBalance = new Prisma.Decimal(wallet.balance).plus(amount);
        balance_after = newBalance;
        await trx.walletBalance.update({
          where: { company_id_user_id: { company_id, user_id: actor_user_id } },
          data: { balance: newBalance, updated_at: new Date() },
        });
      }
      if (existing.type === CashTransactionType.LOAN) {
        const wallet = await this.ensureWallet(company_id, actor_user_id, actor_user_id);
        const newBalance = new Prisma.Decimal(wallet.balance).minus(amount);
        if (newBalance.lt(0)) throw new BadRequestException('FIN_CASH_014: Loan exceeds supervisor wallet balance');
        balance_after = newBalance;
        await trx.walletBalance.update({
          where: { company_id_user_id: { company_id, user_id: actor_user_id } },
          data: { balance: newBalance, updated_at: new Date() },
        });
      }

      const updated = await trx.cashTransaction.update({
        where: { id },
        data: {
          status: CashTransactionStatus.APPROVED,
          receipt_no,
          attachment_file_id: attachment ?? existing.attachment_file_id,
          balance_after: balance_after ?? undefined,
          updated_by_user_id: actor_user_id,
        },
      });

      await this.audit.log({
        company_id,
        actor_user_id,
        action: 'FIN_CASH_APPROVED',
        entity_type: 'CASH_TRANSACTION',
        entity_id: updated.id,
        old_values: { status: existing.status },
        new_values: { status: updated.status, receipt_no },
      });

      return updated;
    });
  }

  async handover(company_id: string, actor_user_id: string, input: { date: string; expenses: Array<{ statement: string; amount: number; receipt_file_id?: string | null }>; submit_action: SubmitAction }) {
    const { tz } = await this.resolveCompanyTimezone(company_id);
    const date = this.ensureCurrentMonth(input.date, tz);
    if (!Array.isArray(input.expenses) || input.expenses.length === 0) {
      throw new BadRequestException('FIN_CASH_015: At least one expense is required');
    }

    const expensesValidated: { statement: string; amount: Prisma.Decimal; receipt_file_id: string | null }[] = [];
    for (const row of input.expenses) {
      const amount = Number(row.amount ?? 0);
      if (amount <= 0) throw new BadRequestException('FIN_CASH_016: Expense amount must be positive');
      const statement = (row.statement ?? '').trim();
      if (statement.length < 2) throw new BadRequestException('FIN_CASH_017: Expense statement required');
      const fileId = await this.verifyFile(company_id, row.receipt_file_id);
      expensesValidated.push({ statement, amount: new Prisma.Decimal(amount), receipt_file_id: fileId ?? null });
    }

    const isDraft = input.submit_action === 'draft';

    return this.prisma.$transaction(async (trx) => {
      const wallet = await this.ensureWallet(company_id, actor_user_id, actor_user_id);
      const expensesTotal = expensesValidated.reduce((acc: Prisma.Decimal, e) => acc.plus(e.amount), new Prisma.Decimal(0));
      const handedOverAmount = new Prisma.Decimal(wallet.balance).minus(expensesTotal);
      if (handedOverAmount.lt(0)) throw new BadRequestException('FIN_CASH_018: Expenses exceed wallet balance');
      if (!isDraft && !handedOverAmount.plus(expensesTotal).equals(wallet.balance)) {
        throw new BadRequestException('FIN_CASH_019: Handover totals mismatch wallet balance');
      }

      const batch = await trx.handoverBatch.create({
        data: {
          company_id,
          supervisor_user_id: actor_user_id,
          status: isDraft ? CashHandoverStatus.DRAFT : CashHandoverStatus.APPROVED,
          date,
          expenses_total: expensesTotal,
          handed_over_amount: handedOverAmount,
          wallet_balance_snapshot: wallet.balance,
          created_by_user_id: actor_user_id,
        },
      });

      for (const row of expensesValidated) {
        await trx.handoverExpense.create({
          data: {
            company_id,
            batch_id: batch.id,
            statement: row.statement,
            amount: row.amount,
            receipt_file_id: row.receipt_file_id ?? null,
            created_by_user_id: actor_user_id,
          },
        });
      }

      if (!isDraft) {
        const newBalance = new Prisma.Decimal(wallet.balance).minus(expensesTotal).minus(handedOverAmount);
        if (newBalance.lt(0)) throw new BadRequestException('FIN_CASH_020: Handover would create negative wallet balance');
        await trx.walletBalance.update({
          where: { company_id_user_id: { company_id, user_id: actor_user_id } },
          data: { balance: newBalance, updated_at: new Date() },
        });

        await trx.cashTransaction.createMany({
          data: [
            {
              id: randomUUID(),
              company_id,
              supervisor_user_id: actor_user_id,
              type: CashTransactionType.HANDOVER_EXPENSE,
              status: CashTransactionStatus.APPROVED,
              amount: expensesTotal,
              date,
              batch_id: batch.id,
              description: 'Expenses deducted from wallet',
              created_by_user_id: actor_user_id,
            },
            {
              id: randomUUID(),
              company_id,
              supervisor_user_id: actor_user_id,
              type: CashTransactionType.HANDOVER_SETTLEMENT,
              status: CashTransactionStatus.APPROVED,
              amount: handedOverAmount,
              date,
              batch_id: batch.id,
              description: 'Amount handed to management',
              created_by_user_id: actor_user_id,
            },
          ],
        });
      }

      await this.audit.log({
        company_id,
        actor_user_id,
        action: isDraft ? 'FIN_CASH_HANDOVER_DRAFT' : 'FIN_CASH_HANDOVER_APPROVED',
        entity_type: 'CASH_HANDOVER',
        entity_id: batch.id,
        new_values: { batch, expenses: expensesValidated },
      });

      return batch;
    });
  }
}

