import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}


