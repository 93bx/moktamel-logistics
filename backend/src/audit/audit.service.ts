import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type AuditInput = {
  company_id: string;
  actor_user_id?: string | null;
  actor_role?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_values?: unknown;
  new_values?: unknown;
  ip?: string | null;
  user_agent?: string | null;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditInput) {
    await this.prisma.auditLog.create({
      data: {
        company_id: input.company_id,
        actor_user_id: input.actor_user_id ?? null,
        actor_role: input.actor_role ?? null,
        action: input.action,
        entity_type: input.entity_type,
        entity_id: input.entity_id ?? null,
        old_values: input.old_values ?? undefined,
        new_values: input.new_values ?? undefined,
        ip: input.ip ?? null,
        user_agent: input.user_agent ?? null,
      },
    });
  }
}


