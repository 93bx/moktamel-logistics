import { Body, Controller, Get, Patch, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PayrollConfigService } from './payroll-config.service';

const ConfigQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
});

const DeductionTierSchema = z.object({
  from: z.number().int().min(0),
  to: z.number().int().min(0),
  deduction: z.number().min(0),
}).refine((data) => data.from <= data.to, {
  message: 'From must be <= To',
});

const UpdateConfigSchema = z.object({
  calculation_method: z.enum(['ORDERS_COUNT', 'REVENUE', 'FIXED_DEDUCTION']),
  monthly_target: z.number().int().positive().optional().nullable(),
  monthly_target_amount: z.number().positive().optional().nullable(),
  bonus_per_order: z.number().min(0).optional().nullable(),
  minimum_salary: z.number().min(0).optional().nullable(),
  unit_amount: z.number().positive().optional().nullable(),
  deduction_per_order: z.number().min(0).optional().nullable(),
  deduction_tiers: z.array(DeductionTierSchema).optional().nullable(),
});

@Controller('payroll-config')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PayrollConfigController {
  constructor(private readonly svc: PayrollConfigService) {}

  @Get('config')
  @Permissions('PAYROLL_CONFIG_READ')
  async getConfig(@Req() req: Request & { user?: any }, @Query() query: any) {
    const q = ConfigQuerySchema.parse(query);
    return this.svc.getConfig(req.user.company_id, q.year, q.month);
  }

  @Patch('config')
  @Permissions('PAYROLL_CONFIG_UPDATE')
  async updateConfig(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const data = UpdateConfigSchema.parse(body);
    return this.svc.updateConfig(req.user.company_id, req.user.sub, data);
  }

  @Get('stats')
  @Permissions('PAYROLL_CONFIG_READ')
  async getStats(@Req() req: Request & { user?: any }, @Query() query: any) {
    const q = ConfigQuerySchema.parse(query);
    return this.svc.getStats(req.user.company_id, q.year, q.month);
  }
}


