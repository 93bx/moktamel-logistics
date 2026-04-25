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
import { OperatingPlatform } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { DailyOperationsService } from './daily-operations.service';

const ListQuerySchema = z.object({
  q: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().min(1).optional(),
  ),
  platform: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.nativeEnum(OperatingPlatform).optional(),
  ),
  date_from: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().datetime().optional(),
  ),
  date_to: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().datetime().optional(),
  ),
  employment_record_id: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().uuid().optional(),
  ),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(25),
});

const ListByEmployeeQuerySchema = z.object({
  date_from: z.string().datetime(),
  date_to: z.string().datetime(),
  q: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().min(1).optional(),
  ),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(100).default(25),
});

const StatsQuerySchema = z.object({
  date_from: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().datetime().optional(),
  ),
  date_to: z.preprocess(
    (val) => (val === '' ? undefined : val),
    z.string().datetime().optional(),
  ),
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
  work_hours: z.number().min(0).optional().nullable(),
  deduction_amount: z.number().min(0).default(0),
  deduction_reason: z.string().min(2).max(200).optional().nullable(),
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
        work_hours: z.number().min(0).optional().nullable(),
        deduction_amount: z.number().min(0).default(0),
        deduction_reason: z.string().min(2).max(200).optional().nullable(),
      }),
    )
    .min(1),
});

const StatusUpdateSchema = z.object({
  status_code: z.string().min(2),
});

const UpdateRecordSchema = z.object({
  orders_count: z.number().int().min(0),
  total_revenue: z.number().min(0),
  cash_collected: z.number().min(0),
  cash_received: z.number().min(0),
  tips: z.number().min(0),
  work_hours: z.number().min(0).optional().nullable(),
  deduction_amount: z.number().min(0),
  deduction_reason: z.string().min(2).max(200).optional().nullable(),
});

const CheckEntryQuerySchema = z.object({
  employment_record_id: z.string().uuid(),
  date: z.string(),
});

const LogsQuerySchema = z.object({
  employment_record_id: z.string().uuid(),
  date_from: z.string().datetime(),
  date_to: z.string().datetime(),
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

  @Get('records/by-employee')
  @Permissions('DAILY_OPS_READ')
  async listByEmployee(@Req() req: Request & { user?: any }, @Query() query: any) {
    const q = ListByEmployeeQuerySchema.parse(query);
    return this.svc.listByEmployee(req.user.company_id, q);
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
  async createBulk(
    @Req() req: Request & { user?: any },
    @Body() body: unknown,
  ) {
    const data = BulkCreateSchema.parse(body);
    return this.svc.createBulk(req.user.company_id, req.user.sub, data);
  }

  @Patch('records/:id/status')
  @Permissions('DAILY_OPS_UPDATE')
  async updateStatus(
    @Req() req: Request & { user?: any },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const data = StatusUpdateSchema.parse(body);
    return this.svc.updateStatus(
      req.user.company_id,
      req.user.sub,
      id,
      data.status_code,
    );
  }

  @Patch('records/:id')
  @Permissions('DAILY_OPS_UPDATE')
  async updateRecord(
    @Req() req: Request & { user?: any },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const data = UpdateRecordSchema.parse(body);
    return this.svc.updateRecord(req.user.company_id, req.user.sub, id, data);
  }

  @Delete('records/:id')
  @Permissions('DAILY_OPS_UPDATE')
  async delete(@Req() req: Request & { user?: any }, @Param('id') id: string) {
    await this.svc.delete(req.user.company_id, req.user.sub, id);
  }

  @Get('logs')
  @Permissions('DAILY_OPS_READ')
  async logs(@Req() req: Request & { user?: any }, @Query() query: unknown) {
    const q = LogsQuerySchema.parse(query);
    return this.svc.logsForEmployee(
      req.user.company_id,
      q.employment_record_id,
      q.date_from,
      q.date_to,
    );
  }

  @Get('records/check')
  @Permissions('DAILY_OPS_READ')
  async checkEntry(
    @Req() req: Request & { user?: any },
    @Query() query: unknown,
  ) {
    const { employment_record_id, date } = CheckEntryQuerySchema.parse(query);
    return this.svc.checkHasEntryForDay(
      req.user.company_id,
      employment_record_id,
      date,
    );
  }

  @Get('employees/search')
  @Permissions('DAILY_OPS_READ')
  async searchEmployees(
    @Req() req: Request & { user?: any },
    @Query('q') q: string,
  ) {
    return this.svc.searchActiveEmployees(req.user.company_id, q ?? '');
  }

  @Get('monthly-charts')
  @Permissions('DAILY_OPS_READ')
  async monthlyCharts(
    @Req() req: Request & { user?: any },
    @Query('month') month?: string,
  ) {
    const parsed = month?.trim() && /^\d{4}-\d{2}$/.test(month) ? month : undefined;
    return this.svc.monthlyCharts(req.user.company_id, parsed);
  }
}
