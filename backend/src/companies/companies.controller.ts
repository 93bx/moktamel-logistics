import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { CompaniesService } from './companies.service';

const UpdateCompanySchema = z.object({
  name: z.string().min(2).optional(),
  timezone: z.string().min(3).optional(),
  default_locale: z.enum(['en', 'ar']).optional(),
});

@Controller('companies')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}

  @Get('current')
  @Permissions('PLATFORM_COMPANY_READ')
  async current(@Req() req: Request & { user?: any }) {
    return this.companies.getCurrent(req.user.company_id);
  }

  @Patch('current')
  @Permissions('PLATFORM_COMPANY_UPDATE')
  async updateCurrent(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const data = UpdateCompanySchema.parse(body);
    return this.companies.updateCurrent(req.user.company_id, data);
  }
}


