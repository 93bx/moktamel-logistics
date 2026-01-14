import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { SubscriptionsService } from './subscriptions.service';

const SetPlanSchema = z.object({
  plan_code: z.string().min(1),
});

@Controller('subscriptions')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SubscriptionsController {
  constructor(private readonly subs: SubscriptionsService) {}

  @Get('current')
  @Permissions('SUBSCRIPTIONS_READ')
  async current(@Req() req: Request & { user?: any }) {
    return this.subs.getCompanySubscription(req.user.company_id);
  }

  @Post('set-plan')
  @Permissions('SUBSCRIPTIONS_MANAGE')
  async setPlan(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const input = SetPlanSchema.parse(body);
    await this.subs.ensureDefaultPlans();
    return this.subs.setCompanyPlan({
      company_id: req.user.company_id,
      actor_user_id: req.user.sub,
      plan_code: input.plan_code,
    });
  }
}


