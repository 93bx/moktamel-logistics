import {
  BadRequestException,
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { DashboardService } from './dashboard.service';

const OverviewQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM')
    .optional(),
});

@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @Permissions('DAILY_OPS_READ')
  async overview(
    @Req() req: Request & { user?: { company_id: string } },
    @Query() query: unknown,
  ) {
    const parsed = OverviewQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        error_code: 'DASHBOARD_001',
        message: 'Invalid query parameters',
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const month = parsed.data.month ?? undefined;
    return this.dashboardService.getOverview(req.user!.company_id, month);
  }
}
