import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { HrEmploymentService } from './hr-employment.service';

const ListQuerySchema = z.object({
  q: z.preprocess((val) => (val === '' ? undefined : val), z.string().min(1).optional()),
  status_code: z.preprocess((val) => (val === '' ? undefined : val), z.string().min(2).optional()),
  platform: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
  has_assets: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(25),
});

const EmploymentCreateSchema = z.object({
  recruitment_candidate_id: z.string().uuid().optional().nullable(),
  employee_no: z.string().min(1).optional().nullable(),
  employee_code: z.string().min(1).optional().nullable(),
  full_name_ar: z.string().min(1).optional().nullable(),
  full_name_en: z.string().min(1).optional().nullable(),
  nationality: z.string().min(1).optional().nullable(),
  phone: z.string().min(1).optional().nullable(),
  date_of_birth: z.string().datetime().optional().nullable(),
  iqama_no: z.string().min(1).optional().nullable(),
  iqama_expiry_at: z.string().datetime().optional().nullable(),
  iqama_file_id: z.string().uuid().optional().nullable(),
  passport_no: z.string().min(1).optional().nullable(),
  passport_expiry_at: z.string().datetime().optional().nullable(),
  passport_file_id: z.string().uuid().optional().nullable(),
  contract_no: z.string().min(1).optional().nullable(),
  contract_end_at: z.string().datetime().optional().nullable(),
  contract_file_id: z.string().uuid().optional().nullable(),
  license_expiry_at: z.string().datetime().optional().nullable(),
  license_file_id: z.string().uuid().optional().nullable(),
  promissory_note_file_id: z.string().uuid().optional().nullable(),
  avatar_file_id: z.string().uuid().optional().nullable(),
  custody_status: z.string().min(1).optional().nullable(),
  start_date_at: z.string().datetime().optional().nullable(),
  medical_expiry_at: z.string().datetime().optional().nullable(),
  status_code: z.string().min(1).optional(),
  salary_amount: z.number().optional().nullable(),
  salary_currency_code: z.string().min(1).optional().nullable(),
  cost_center_code: z.string().min(1).optional().nullable(),
  assigned_platform: z.enum(['JAHEZ', 'HUNGERSTATION', 'NINJA', 'KEETA']).optional().nullable(),
  platform_user_no: z.string().min(1).optional().nullable(),
  job_type: z.string().min(1).optional().nullable(),
});

const EmploymentUpdateSchema = EmploymentCreateSchema.partial();

@Controller('hr/employment')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HrEmploymentController {
  constructor(private readonly svc: HrEmploymentService) {}

  @Get('stats')
  @Permissions('HR_EMPLOYMENT_READ')
  async stats(@Req() req: Request & { user?: any }) {
    return this.svc.getStats(req.user.company_id);
  }

  @Get('records')
  @Permissions('HR_EMPLOYMENT_READ')
  async list(@Req() req: Request & { user?: any }, @Query() query: any) {
    const q = ListQuerySchema.parse(query);
    return this.svc.list(req.user.company_id, q);
  }

  @Get('records/:id')
  @Permissions('HR_EMPLOYMENT_READ')
  async get(@Req() req: Request & { user?: any }, @Param('id') id: string) {
    return this.svc.get(req.user.company_id, id);
  }

  @Post('records')
  @Permissions('HR_EMPLOYMENT_CREATE')
  async create(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const data = EmploymentCreateSchema.parse(body);
    return this.svc.create(req.user.company_id, req.user.sub, data);
  }

  @Patch('records/:id')
  @Permissions('HR_EMPLOYMENT_UPDATE')
  async update(@Req() req: Request & { user?: any }, @Param('id') id: string, @Body() body: unknown) {
    const data = EmploymentUpdateSchema.parse(body);
    return this.svc.update(req.user.company_id, req.user.sub, id, data);
  }

  @Delete('records/:id')
  @Permissions('HR_EMPLOYMENT_DELETE')
  async remove(@Req() req: Request & { user?: any }, @Param('id') id: string) {
    return this.svc.remove(req.user.company_id, req.user.sub, id);
  }
}


