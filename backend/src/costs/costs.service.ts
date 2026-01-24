import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AnalyticsService } from '../analytics/analytics.service';

type CostTypeCode =
  | 'COST_TYPE_EMPLOYEE_SALARIES'
  | 'COST_TYPE_HOUSING'
  | 'COST_TYPE_FUEL'
  | 'COST_TYPE_MAINTENANCE'
  | 'COST_TYPE_ADMIN_SALARIES'
  | 'COST_TYPE_GOVERNMENT_EXPENSES';

type CostRecurrenceCode = 'ONE_TIME' | 'MONTHLY' | 'YEARLY';

type CostCreateInput = {
  name: string;
  type_code: CostTypeCode;
  amount_input: number;
  vat_included: boolean;
  recurrence_code: CostRecurrenceCode;
  one_time_date?: string | null;
  notes?: string | null;
};

type CostUpdateInput = Partial<CostCreateInput>;

const VAT_RATE = 0.15; // 15%

type CostRow = {
  id: string;
  name: string;
  type_code: string;
  amount_input: Prisma.Decimal;
  vat_included: boolean;
  vat_rate: Prisma.Decimal;
  vat_amount: Prisma.Decimal;
  net_amount: Prisma.Decimal;
  recurrence_code: string;
  one_time_date: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class CostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly analytics: AnalyticsService,
  ) {}

  private computeVatAndNet(amountInput: number, vatIncluded: boolean) {
    const roundedAmount = Number(amountInput.toFixed(2));
    const vatAmountRaw = roundedAmount * VAT_RATE;
    const vat_amount = Number(vatAmountRaw.toFixed(2));
    const net_amount = vatIncluded
      ? Number((roundedAmount - vat_amount).toFixed(2))
      : roundedAmount;

    return {
      vat_rate: VAT_RATE,
      vat_amount,
      net_amount,
    };
  }

  private mapCost(row: CostRow) {
    return {
      id: row.id,
      name: row.name,
      type_code: row.type_code as CostTypeCode,
      amount_input: Number(row.amount_input),
      vat_included: row.vat_included,
      vat_rate: Number(row.vat_rate),
      vat_amount: Number(row.vat_amount),
      net_amount: Number(row.net_amount),
      recurrence_code: row.recurrence_code as CostRecurrenceCode,
      one_time_date: row.one_time_date ? row.one_time_date.toISOString() : null,
      notes: row.notes,
      created_at: row.created_at.toISOString(),
      updated_at: row.updated_at.toISOString(),
    };
  }

  async list(
    company_id: string,
    input: { q?: string; type_code?: CostTypeCode; page: number; page_size: number },
  ) {
    const where: Prisma.CostWhereInput = {
      company_id,
      is_deleted: false,
    };

    if (input.type_code) {
      where.type_code = input.type_code;
    }

    if (input.q) {
      const term = input.q.trim();
      const numeric = Number(term);
      const isNumeric = !Number.isNaN(numeric);

      where.AND = [
        {
          OR: [
            { name: { contains: term, mode: 'insensitive' } },
            ...(isNumeric
              ? [
                  {
                    amount_input: {
                      equals: new Prisma.Decimal(numeric),
                    },
                  },
                ]
              : []),
          ],
        },
      ];
    }

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.cost.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (input.page - 1) * input.page_size,
        take: input.page_size,
      }),
      this.prisma.cost.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.mapCost(r as unknown as CostRow)),
      total,
      page: input.page,
      page_size: input.page_size,
    };
  }

  async create(company_id: string, actor_user_id: string, input: CostCreateInput) {
    if (
      input.recurrence_code === 'ONE_TIME' &&
      (!input.one_time_date || !input.one_time_date.trim())
    ) {
      throw new BadRequestException(
        'COSTS_MANAGEMENT_001: one_time_date is required for ONE_TIME recurrence',
      );
    }

    const { vat_rate, vat_amount, net_amount } = this.computeVatAndNet(
      input.amount_input,
      input.vat_included,
    );

    const created = await this.prisma.cost.create({
      data: {
        company_id,
        name: input.name.trim(),
        type_code: input.type_code,
        amount_input: input.amount_input,
        vat_included: input.vat_included,
        vat_rate,
        vat_amount,
        net_amount,
        recurrence_code: input.recurrence_code,
        one_time_date: input.one_time_date
          ? new Date(input.one_time_date)
          : null,
        notes: input.notes?.trim() || null,
        created_by_user_id: actor_user_id,
      },
    });

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'COST_CREATE',
      entity_type: 'COST',
      entity_id: created.id,
      new_values: created,
    });

    await this.analytics.track({
      company_id,
      actor_user_id,
      event_code: 'COST_CREATED',
      entity_type: 'COST',
      entity_id: created.id,
      payload: {
        type_code: created.type_code,
        amount_input: Number(created.amount_input),
        net_amount: Number(created.net_amount),
      },
    });

    return this.mapCost(created as unknown as CostRow);
  }

  async update(
    company_id: string,
    actor_user_id: string,
    id: string,
    input: CostUpdateInput,
  ) {
    const existing = await this.prisma.cost.findFirst({
      where: { id, company_id, is_deleted: false },
    });
    if (!existing) {
      throw new NotFoundException('COSTS_MANAGEMENT_002: Cost not found');
    }

    const next: CostCreateInput = {
      name: input.name ?? existing.name,
      type_code: (input.type_code ?? existing.type_code) as CostTypeCode,
      amount_input:
        input.amount_input !== undefined
          ? input.amount_input
          : Number(existing.amount_input),
      vat_included:
        input.vat_included !== undefined
          ? input.vat_included
          : existing.vat_included,
      recurrence_code: (input.recurrence_code ??
        existing.recurrence_code) as CostRecurrenceCode,
      one_time_date:
        input.one_time_date !== undefined
          ? input.one_time_date
          : existing.one_time_date
            ? existing.one_time_date.toISOString()
            : null,
      notes:
        input.notes !== undefined ? input.notes : existing.notes ?? null,
    };

    if (
      next.recurrence_code === 'ONE_TIME' &&
      (!next.one_time_date || !next.one_time_date.trim())
    ) {
      throw new BadRequestException(
        'COSTS_MANAGEMENT_003: one_time_date is required for ONE_TIME recurrence',
      );
    }

    const { vat_rate, vat_amount, net_amount } = this.computeVatAndNet(
      next.amount_input,
      next.vat_included,
    );

    const updated = await this.prisma.cost.update({
      where: { id },
      data: {
        name: next.name.trim(),
        type_code: next.type_code,
        amount_input: next.amount_input,
        vat_included: next.vat_included,
        vat_rate,
        vat_amount,
        net_amount,
        recurrence_code: next.recurrence_code,
        one_time_date: next.one_time_date
          ? new Date(next.one_time_date)
          : null,
        notes: next.notes?.trim() || null,
        updated_at: new Date(),
      },
    });

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'COST_UPDATE',
      entity_type: 'COST',
      entity_id: updated.id,
      old_values: existing,
      new_values: updated,
    });

    await this.analytics.track({
      company_id,
      actor_user_id,
      event_code: 'COST_UPDATED',
      entity_type: 'COST',
      entity_id: updated.id,
      payload: {
        type_code: updated.type_code,
        amount_input: Number(updated.amount_input),
        net_amount: Number(updated.net_amount),
      },
    });

    return this.mapCost(updated as unknown as CostRow);
  }

  async softDelete(company_id: string, actor_user_id: string, id: string) {
    const existing = await this.prisma.cost.findFirst({
      where: { id, company_id, is_deleted: false },
    });
    if (!existing) {
      throw new NotFoundException('COSTS_MANAGEMENT_004: Cost not found');
    }

    const deleted = await this.prisma.cost.update({
      where: { id },
      data: {
        is_deleted: true,
        updated_at: new Date(),
      },
    });

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'COST_DELETE',
      entity_type: 'COST',
      entity_id: deleted.id,
      old_values: existing,
      new_values: deleted,
    });

    await this.analytics.track({
      company_id,
      actor_user_id,
      event_code: 'COST_DELETED',
      entity_type: 'COST',
      entity_id: deleted.id,
    });

    return { ok: true };
  }
}

