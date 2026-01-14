import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, SubscriptionPlan } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getCompanySubscription(company_id: string) {
    return this.prisma.companySubscription.findUnique({
      where: { company_id },
      include: { plan: true },
    });
  }

  async ensureFeature(company_id: string, featureKey: string) {
    const sub = await this.getCompanySubscription(company_id);
    if (!sub) throw new ForbiddenException('Subscription required');
    const features = sub.plan.features as Prisma.JsonObject;
    if (!features || features[featureKey] !== true) throw new ForbiddenException('Feature not enabled');
  }

  async setCompanyPlan(input: { company_id: string; actor_user_id: string; plan_code: string }) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { code: input.plan_code } });
    if (!plan) throw new NotFoundException('Plan not found');

    const updated = await this.prisma.companySubscription.upsert({
      where: { company_id: input.company_id },
      update: {
        plan_id: plan.id,
        status: 'ACTIVE',
      },
      create: {
        company_id: input.company_id,
        plan_id: plan.id,
        status: 'ACTIVE',
        created_by_user_id: input.actor_user_id,
      },
      include: { plan: true },
    });

    await this.audit.log({
      company_id: input.company_id,
      actor_user_id: input.actor_user_id,
      action: 'SUBSCRIPTION_PLAN_CHANGED',
      entity_type: 'COMPANY_SUBSCRIPTION',
      entity_id: updated.id,
      new_values: { plan_code: updated.plan.code },
    });

    return updated;
  }

  async ensureDefaultPlans() {
    const defaults: Array<Pick<SubscriptionPlan, 'code' | 'name_code'> & { limits: Prisma.InputJsonValue; features: Prisma.InputJsonValue }> =
      [
        {
          code: 'PLAN_FREE',
          name_code: 'PLAN_FREE',
          limits: { users: 5, storage_mb: 500 },
          features: { HR: true, FILES: true, ANALYTICS: false, IMPORT_EXPORT: false },
        },
        {
          code: 'PLAN_PRO',
          name_code: 'PLAN_PRO',
          limits: { users: 50, storage_mb: 5000 },
          features: { HR: true, FILES: true, ANALYTICS: true, IMPORT_EXPORT: true },
        },
      ];

    for (const p of defaults) {
      await this.prisma.subscriptionPlan.upsert({
        where: { code: p.code },
        update: { name_code: p.name_code, limits: p.limits, features: p.features },
        create: { code: p.code, name_code: p.name_code, limits: p.limits, features: p.features },
      });
    }
  }
}


