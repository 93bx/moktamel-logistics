import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { HrRecruitmentService } from './hr-recruitment.service';

const ListQuerySchema = z.object({
  q: z.preprocess((val) => (val === '' ? undefined : val), z.string().min(1).optional()),
  status_code: z.preprocess((val) => (val === '' ? undefined : val), z.string().min(2).optional()),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(25),
});

const CandidateCreateSchema = z.object({
  full_name_ar: z.string().min(2),
  full_name_en: z.string().min(2).optional(),
  nationality: z.string().min(2),
  passport_no: z.string().min(3),
  job_title_code: z.string().min(1).optional(),
  status_code: z.string().min(1).optional(),
  department_id: z.string().uuid().optional(),
  responsible_office: z.string().min(1),
  visa_deadline_at: z.string().datetime().optional(),
  visa_sent_at: z.string().datetime().optional(),
  expected_arrival_at: z.string().datetime().optional(),
  notes: z.string().max(5000).optional(),
  avatar_file_id: z.string().uuid().optional(),
  passport_image_file_id: z.string().uuid(),
  visa_image_file_id: z.string().uuid().optional(),
  flight_ticket_image_file_id: z.string().uuid().optional(),
  personal_picture_file_id: z.string().uuid().optional(),
});

const CandidateUpdateSchema = CandidateCreateSchema.partial();

@Controller('hr/recruitment')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HrRecruitmentController {
  constructor(private readonly svc: HrRecruitmentService) {}

  @Get('stats')
  @Permissions('HR_RECRUITMENT_READ')
  async stats(@Req() req: Request & { user?: any }) {
    return this.svc.getStats(req.user.company_id);
  }

  @Get('candidates')
  @Permissions('HR_RECRUITMENT_READ')
  async list(@Req() req: Request & { user?: any }, @Query() query: any) {
    const q = ListQuerySchema.parse(query);
    return this.svc.list(req.user.company_id, q);
  }

  @Get('candidates/:id')
  @Permissions('HR_RECRUITMENT_READ')
  async get(@Req() req: Request & { user?: any }, @Param('id') id: string) {
    return this.svc.get(req.user.company_id, id);
  }

  @Post('candidates')
  @Permissions('HR_RECRUITMENT_CREATE')
  async create(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const data = CandidateCreateSchema.parse(body);
    return this.svc.create(req.user.company_id, req.user.sub, data);
  }

  @Patch('candidates/:id')
  @Permissions('HR_RECRUITMENT_UPDATE')
  async update(
    @Req() req: Request & { user?: any },
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const data = CandidateUpdateSchema.parse(body);
    return this.svc.update(req.user.company_id, req.user.sub, id, data);
  }

  @Delete('candidates/:id')
  @Permissions('HR_RECRUITMENT_DELETE')
  async remove(@Req() req: Request & { user?: any }, @Param('id') id: string) {
    return this.svc.remove(req.user.company_id, req.user.sub, id);
  }
}


