import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { CostsService } from './costs.service';

const COST_TYPE_VALUES = [
  'COST_TYPE_EMPLOYEE_SALARIES',
  'COST_TYPE_HOUSING',
  'COST_TYPE_FUEL',
  'COST_TYPE_MAINTENANCE',
  'COST_TYPE_ADMIN_SALARIES',
  'COST_TYPE_GOVERNMENT_EXPENSES',
] as const;

const RECURRENCE_VALUES = ['ONE_TIME', 'MONTHLY', 'YEARLY'] as const;

const ListCostsQuerySchema = z.object({
  q: z
    .preprocess((val) => (val === '' ? undefined : val), z.string().min(1).optional())
    .optional(),
  type_code: z
    .preprocess(
      (val) => (val === '' ? undefined : val),
      z.enum(COST_TYPE_VALUES).optional(),
    )
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(25),
});

const CostBaseSchema = z.object({
  name: z.string().min(1),
  type_code: z.enum(COST_TYPE_VALUES),
  amount_input: z.number().positive(),
  vat_included: z.boolean().default(false),
  recurrence_code: z.enum(RECURRENCE_VALUES),
  one_time_date: z.string().datetime().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
});

const CostCreateSchema = CostBaseSchema.superRefine((data, ctx) => {
  if (data.recurrence_code === 'ONE_TIME' && !data.one_time_date) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'one_time_date is required for ONE_TIME recurrence',
      path: ['one_time_date'],
    });
  }
});

const CostUpdateSchema = CostBaseSchema.partial();

@Controller('costs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CostsController {
  constructor(private readonly svc: CostsService) {}

  @Get()
  @Permissions('COSTS_READ')
  async list(@Req() req: Request & { user?: any }, @Query() query: any) {
    const q = ListCostsQuerySchema.parse(query);
    return this.svc.list(req.user.company_id, q);
  }

  @Post()
  @Permissions('COSTS_MANAGE')
  async create(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const data = CostCreateSchema.parse(body);
    return this.svc.create(req.user.company_id, req.user.sub, data);
  }

  @Patch(':id')
  @Permissions('COSTS_MANAGE')
  async update(
    @Req() req: Request & { user?: any },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const data = CostUpdateSchema.parse(body);
    return this.svc.update(req.user.company_id, req.user.sub, id, data);
  }

  @Delete(':id')
  @Permissions('COSTS_MANAGE')
  async remove(@Req() req: Request & { user?: any }, @Param('id') id: string) {
    return this.svc.softDelete(req.user.company_id, req.user.sub, id);
  }
}

