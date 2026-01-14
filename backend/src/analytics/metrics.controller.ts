import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PrismaService } from '../prisma/prisma.service';

const MetricsQuerySchema = z.object({
  metric_code: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

@Controller('analytics')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class MetricsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('metrics/daily')
  @Permissions('ANALYTICS_READ')
  async daily(@Req() req: Request & { user?: any }, @Query() query: any) {
    const q = MetricsQuerySchema.parse(query);
    return this.prisma.metricDaily.findMany({
      where: {
        company_id: req.user.company_id,
        metric_code: q.metric_code,
        date: {
          gte: q.from ? new Date(q.from) : undefined,
          lte: q.to ? new Date(q.to) : undefined,
        },
      },
      orderBy: { date: 'asc' },
      take: 500,
    });
  }
}


