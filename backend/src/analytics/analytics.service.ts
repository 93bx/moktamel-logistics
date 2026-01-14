import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async track(input: {
    company_id: string;
    actor_user_id?: string | null;
    event_code: string;
    entity_type?: string | null;
    entity_id?: string | null;
    payload?: unknown;
    occurred_at?: Date;
  }) {
    await this.prisma.analyticsEvent.create({
      data: {
        company_id: input.company_id,
        actor_user_id: input.actor_user_id ?? null,
        event_code: input.event_code,
        entity_type: input.entity_type ?? null,
        entity_id: input.entity_id ?? null,
        payload: input.payload ?? undefined,
        occurred_at: input.occurred_at ?? new Date(),
      },
    });
  }
}


