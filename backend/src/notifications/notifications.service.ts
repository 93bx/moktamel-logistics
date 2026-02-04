import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export type NotificationItem = {
  id: string;
  company_id: string;
  user_id: string | null;
  type_code: string;
  payload: unknown;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  read_at: Date | null;
  created_at: Date;
  updated_at: Date;
  created_by_user_id: string | null;
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    company_id: string;
    user_id?: string | null;
    type_code: string;
    payload?: unknown;
    severity?: 'INFO' | 'WARNING' | 'CRITICAL';
    created_by_user_id?: string | null;
  }) {
    await this.prisma.notification.create({
      data: {
        company_id: input.company_id,
        user_id: input.user_id ?? null,
        type_code: input.type_code,
        payload: input.payload ?? undefined,
        severity: input.severity ?? 'INFO',
        created_by_user_id: input.created_by_user_id ?? null,
      },
    });
  }

  async updatePayload(
    notification_id: string,
    company_id: string,
    payload: unknown,
  ): Promise<void> {
    const existing = await this.prisma.notification.findFirst({
      where: { id: notification_id, company_id },
    });
    if (!existing) return;
    await this.prisma.notification.update({
      where: { id: notification_id },
      data: { payload: payload as object },
    });
  }

  /**
   * Find a recent notification by type_code and payload.candidate_id (for deduplication).
   * Returns the first match created within the last withinHours hours.
   */
  async findRecentByTypeAndPayloadCandidate(
    company_id: string,
    type_code: string,
    candidate_id: string,
    withinHours: number = 48,
  ): Promise<{ id: string; payload: unknown } | null> {
    const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000);
    const list = await this.prisma.notification.findMany({
      where: {
        company_id,
        type_code,
        created_at: { gte: cutoff },
      },
      orderBy: { created_at: 'desc' },
      take: 50,
      select: { id: true, payload: true },
    });
    const found = list.find(
      (n) => n.payload && typeof n.payload === 'object' && (n.payload as { candidate_id?: string }).candidate_id === candidate_id,
    );
    return found ? { id: found.id, payload: found.payload } : null;
  }

  async list(
    company_id: string,
    user_id: string,
    page: number,
    page_size: number,
  ): Promise<{
    items: NotificationItem[];
    total: number;
    page: number;
    page_size: number;
  }> {
    const size = Math.min(Math.max(1, page_size), MAX_PAGE_SIZE);
    const skip = (Math.max(1, page) - 1) * size;

    const [notifications, total] = await Promise.all([
      this.prisma.notification.findMany({
        where: { company_id },
        orderBy: { created_at: 'desc' },
        skip,
        take: size,
        include: {
          notification_reads: { where: { user_id }, take: 1 },
        },
      }),
      this.prisma.notification.count({ where: { company_id } }),
    ]);

    const items: NotificationItem[] = notifications.map((n) => ({
      id: n.id,
      company_id: n.company_id,
      user_id: n.user_id,
      type_code: n.type_code,
      payload: n.payload,
      severity: n.severity as 'INFO' | 'WARNING' | 'CRITICAL',
      read_at: n.notification_reads[0]?.read_at ?? null,
      created_at: n.created_at,
      updated_at: n.updated_at,
      created_by_user_id: n.created_by_user_id,
    }));

    return {
      items,
      total,
      page: Math.max(1, page),
      page_size: size,
    };
  }

  async markRead(
    company_id: string,
    user_id: string,
    notification_id: string,
  ): Promise<{ updated: number }> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notification_id, company_id },
    });
    if (!notification) return { updated: 0 };

    await this.prisma.notificationRead.upsert({
      where: {
        notification_id_user_id: { notification_id, user_id },
      },
      create: {
        notification_id,
        user_id,
        company_id,
      },
      update: { read_at: new Date() },
    });
    return { updated: 1 };
  }

  async unreadCount(company_id: string, user_id: string): Promise<number> {
    const [total, readCount] = await Promise.all([
      this.prisma.notification.count({ where: { company_id } }),
      this.prisma.notificationRead.count({
        where: { company_id, user_id },
      }),
    ]);
    return Math.max(0, total - readCount);
  }

  async preview(
    company_id: string,
    user_id: string,
    limit: number,
  ): Promise<NotificationItem[]> {
    const [notifications, readIds] = await Promise.all([
      this.prisma.notification.findMany({
        where: { company_id },
        orderBy: { created_at: 'desc' },
        take: 100,
      }),
      this.prisma.notificationRead.findMany({
        where: { company_id, user_id },
        select: { notification_id: true },
      }),
    ]);
    const readSet = new Set(readIds.map((r) => r.notification_id));
    const unread = notifications
      .filter((n) => !readSet.has(n.id))
      .slice(0, limit);

    return unread.map((n) => ({
      id: n.id,
      company_id: n.company_id,
      user_id: n.user_id,
      type_code: n.type_code,
      payload: n.payload,
      severity: n.severity as 'INFO' | 'WARNING' | 'CRITICAL',
      read_at: null as Date | null,
      created_at: n.created_at,
      updated_at: n.updated_at,
      created_by_user_id: n.created_by_user_id,
    }));
  }

  async pageForId(
    company_id: string,
    notification_id: string,
    page_size: number = DEFAULT_PAGE_SIZE,
  ): Promise<{ page: number }> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notification_id, company_id },
    });
    if (!notification) return { page: 1 };

    const countNewerOrSame = await this.prisma.notification.count({
      where: {
        company_id,
        created_at: { gte: notification.created_at },
      },
    });
    const page = Math.ceil(countNewerOrSame / page_size) || 1;
    return { page };
  }
}
