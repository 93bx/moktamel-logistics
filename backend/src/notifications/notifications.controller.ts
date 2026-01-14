import { Controller, Get, Patch, Param, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { PrismaService } from '../prisma/prisma.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Permissions('NOTIFICATIONS_READ')
  async list(@Req() req: Request & { user?: any }) {
    return this.prisma.notification.findMany({
      where: { company_id: req.user.company_id, user_id: req.user.sub },
      orderBy: { created_at: 'desc' },
      take: 100,
    });
  }

  @Patch(':id/read')
  @Permissions('NOTIFICATIONS_READ')
  async markRead(@Req() req: Request & { user?: any }, @Param('id') id: string) {
    const updated = await this.prisma.notification.updateMany({
      where: { id, company_id: req.user.company_id, user_id: req.user.sub },
      data: { read_at: new Date() },
    });
    return { updated: updated.count };
  }
}


