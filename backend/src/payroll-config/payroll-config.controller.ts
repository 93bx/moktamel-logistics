import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
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

const DeductionTierSchema = z
  .object({
    from: z.number().int().min(0),
    to: z.number().int().min(0),
    deduction: z.number().min(0),
  })
  .refine((data) => data.from <= data.to, {
    message: 'From must be <= To',
  });

const UpdateConfigSchema = z.object({
  minimum_salary: z.number().min(0).optional().nullable(),
  tip_recipient: z.enum(['REPRESENTATIVE', 'COMPANY']).optional().nullable(),
  count_bonus_enabled: z.boolean().optional().nullable(),
  count_bonus_amount: z.number().min(0).optional().nullable(),
  revenue_bonus_enabled: z.boolean().optional().nullable(),
  revenue_bonus_amount: z.number().min(0).optional().nullable(),
  deduction_per_order: z.number().min(0).optional().nullable(),
  orders_deduction_tiers: z.array(DeductionTierSchema).optional().nullable(),
  revenue_deduction_tiers: z.array(DeductionTierSchema).optional().nullable(),
  revenue_unit_amount: z.number().positive().optional().nullable(),
});

const ApproveMonthSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
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
  async updateConfig(
    @Req() req: Request & { user?: any },
    @Body() body: unknown,
  ) {
    const data = UpdateConfigSchema.parse(body);
    return this.svc.updateConfig(req.user.company_id, req.user.sub, data);
  }

  @Get('stats')
  @Permissions('PAYROLL_CONFIG_READ')
  async getStats(@Req() req: Request & { user?: any }, @Query() query: any) {
    const q = ConfigQuerySchema.parse(query);
    return this.svc.getStats(req.user.company_id, q.year, q.month);
  }

  @Post('approve-month')
  @Permissions('PAYROLL_APPROVE')
  async approveMonth(
    @Req() req: Request & { user?: any },
    @Body() body: unknown,
  ) {
    const data = ApproveMonthSchema.parse(body);
    const ip = req.ip || req.socket.remoteAddress || null;
    const userAgent = req.get('user-agent') || null;

    return this.svc.approveMonth(
      req.user.company_id,
      req.user.sub,
      data.year,
      data.month,
      ip,
      userAgent,
    );
  }
}
