import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { OperatingPlatform } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { DailyOperationsService } from './daily-operations.service';

const ListQuerySchema = z.object({
  q: z.preprocess((val) => (val === '' ? undefined : val), z.string().min(1).optional()),
  platform: z
    .preprocess((val) => (val === '' ? undefined : val), z.nativeEnum(OperatingPlatform).optional()),
  date_from: z.preprocess((val) => (val === '' ? undefined : val), z.string().datetime().optional()),
  date_to: z.preprocess((val) => (val === '' ? undefined : val), z.string().datetime().optional()),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(25),
});

const StatsQuerySchema = z.object({
  date_from: z.preprocess((val) => (val === '' ? undefined : val), z.string().datetime().optional()),
  date_to: z.preprocess((val) => (val === '' ? undefined : val), z.string().datetime().optional()),
});

const SubmitActionSchema = z.enum(['draft', 'approve']).default('draft');

const CreateSchema = z.object({
  employment_record_id: z.string().uuid(),
  date: z.string().datetime(),
  orders_count: z.number().int().min(0).optional(),
  total_revenue: z.number().min(0).optional(),
  cash_collected: z.number().min(0).optional(),
  cash_received: z.number().min(0).default(0),
  tips: z.number().min(0).default(0),
  deduction_amount: z.number().min(0).default(0),
  deduction_reason: z.string().min(2).max(200).optional().nullable(),
  loan_amount: z.number().min(0).default(0),
  loan_reason: z.string().min(2).max(200).optional().nullable(),
  submit_action: SubmitActionSchema,
});

const BulkCreateSchema = z.object({
  date: z.string().datetime(),
  submit_action: SubmitActionSchema,
  rows: z
    .array(
      z.object({
        employment_record_id: z.string().uuid(),
        orders_count: z.number().int().min(0).optional(),
        total_revenue: z.number().min(0).optional(),
        cash_collected: z.number().min(0).optional(),
        cash_received: z.number().min(0).default(0),
        tips: z.number().min(0).default(0),
        deduction_amount: z.number().min(0).default(0),
        deduction_reason: z.string().min(2).max(200).optional().nullable(),
        loan_amount: z.number().min(0).default(0),
        loan_reason: z.string().min(2).max(200).optional().nullable(),
      }),
    )
    .min(1),
});

const StatusUpdateSchema = z.object({
  status_code: z.string().min(2),
});

@Controller('operations/daily')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DailyOperationsController {
  constructor(private readonly svc: DailyOperationsService) {}

  @Get('stats')
  @Permissions('DAILY_OPS_READ')
  async stats(@Req() req: Request & { user?: any }, @Query() query: any) {
    const q = StatsQuerySchema.parse(query);
    return this.svc.stats(req.user.company_id, q);
  }

  @Get('records')
  @Permissions('DAILY_OPS_READ')
  async list(@Req() req: Request & { user?: any }, @Query() query: any) {
    const q = ListQuerySchema.parse(query);
    return this.svc.list(req.user.company_id, q);
  }

  @Post('records')
  @Permissions('DAILY_OPS_CREATE')
  async create(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const data = CreateSchema.parse(body);
    return this.svc.createOne(req.user.company_id, req.user.sub, data);
  }

  @Post('bulk')
  @Permissions('DAILY_OPS_CREATE_BULK')
  async createBulk(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const data = BulkCreateSchema.parse(body);
    return this.svc.createBulk(req.user.company_id, req.user.sub, data);
  }

  @Patch('records/:id/status')
  @Permissions('DAILY_OPS_UPDATE')
  async updateStatus(@Req() req: Request & { user?: any }, @Param('id') id: string, @Body() body: unknown) {
    const data = StatusUpdateSchema.parse(body);
    return this.svc.updateStatus(req.user.company_id, req.user.sub, id, data.status_code);
  }

  @Get('employees/search')
  @Permissions('DAILY_OPS_READ')
  async searchEmployees(@Req() req: Request & { user?: any }, @Query('q') q: string) {
    return this.svc.searchActiveEmployees(req.user.company_id, q ?? '');
  }
}


