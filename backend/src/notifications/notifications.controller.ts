import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @Permissions('NOTIFICATIONS_READ')
  async list(
    @Req() req: Request & { user?: { company_id: string; sub: string } },
    @Query('page') page?: string,
    @Query('page_size') page_size?: string,
  ) {
    const company_id = req.user!.company_id;
    const user_id = req.user!.sub;
    const pageNum = Math.max(1, parseInt(String(page || '1'), 10) || 1);
    const pageSizeNum = Math.max(
      1,
      Math.min(100, parseInt(String(page_size || '25'), 10) || 25),
    );
    return this.notifications.list(company_id, user_id, pageNum, pageSizeNum);
  }

  @Get('unread-count')
  @Permissions('NOTIFICATIONS_READ')
  async unreadCount(@Req() req: Request & { user?: { company_id: string; sub: string } }) {
    const company_id = req.user!.company_id;
    const user_id = req.user!.sub;
    const count = await this.notifications.unreadCount(company_id, user_id);
    return { count };
  }

  @Get('preview')
  @Permissions('NOTIFICATIONS_READ')
  async preview(
    @Req() req: Request & { user?: { company_id: string; sub: string } },
    @Query('limit') limit?: string,
  ) {
    const company_id = req.user!.company_id;
    const user_id = req.user!.sub;
    const limitNum = Math.min(20, Math.max(1, parseInt(String(limit || '10'), 10) || 10));
    return this.notifications.preview(company_id, user_id, limitNum);
  }

  @Get('page-for-id')
  @Permissions('NOTIFICATIONS_READ')
  async pageForId(
    @Req() req: Request & { user?: { company_id: string } },
    @Query('id') id?: string,
  ) {
    const company_id = req.user!.company_id;
    if (!id) return { page: 1 };
    return this.notifications.pageForId(company_id, id, 25);
  }

  @Patch(':id/read')
  @Permissions('NOTIFICATIONS_READ')
  async markRead(
    @Req() req: Request & { user?: { company_id: string; sub: string } },
    @Param('id') id: string,
  ) {
    const company_id = req.user!.company_id;
    const user_id = req.user!.sub;
    return this.notifications.markRead(company_id, user_id, id);
  }
}
