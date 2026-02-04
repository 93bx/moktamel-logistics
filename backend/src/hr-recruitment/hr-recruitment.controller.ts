import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { HrRecruitmentService } from './hr-recruitment.service';

const SORT_VALUES = ['under_procedure', 'drafts', 'arriving_soon', 'older_than_45_days'] as const;
const ListQuerySchema = z.object({
  q: z.preprocess((val) => (val === '' ? undefined : val), z.string().min(1).optional()),
  status_code: z.preprocess((val) => (val === '' ? undefined : val), z.string().min(2).optional()),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(25),
  sort: z
    .preprocess((val) => (val === '' ? undefined : val), z.enum(SORT_VALUES).optional()),
});

const CandidateCreateSchema = z.object({
  full_name_ar: z.string().min(2),
  full_name_en: z.string().min(2),
  nationality: z.string().min(2),
  passport_no: z.string().min(3),
  passport_expiry_at: z.string().datetime(),
  job_title_code: z.string().min(1).optional(),
  status_code: z.string().min(1).optional(),
  department_id: z.string().uuid().optional(),
  responsible_office: z.string().min(1),
  responsible_office_number: z.string().max(10).optional(),
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

const CandidateDraftCreateSchema = z
  .object({
    status_code: z.string().optional(),
    full_name_ar: z.string().optional(),
    full_name_en: z.string().optional(),
    nationality: z.string().optional(),
    passport_no: z.string().optional(),
    passport_expiry_at: z.string().datetime().optional(),
    job_title_code: z.string().min(1).optional(),
    department_id: z.string().uuid().optional(),
    responsible_office: z.string().optional(),
    responsible_office_number: z.string().max(10).optional(),
    visa_deadline_at: z.string().datetime().optional(),
    visa_sent_at: z.string().datetime().optional(),
    expected_arrival_at: z.string().datetime().optional(),
    notes: z.string().max(5000).optional(),
    avatar_file_id: z.string().uuid().optional(),
    passport_image_file_id: z.string().uuid().optional(),
    visa_image_file_id: z.string().uuid().optional(),
    flight_ticket_image_file_id: z.string().uuid().optional(),
    personal_picture_file_id: z.string().uuid().optional(),
  })
  .refine(
    (data) => {
      const hasValue = (v: unknown) => v != null && String(v).trim() !== '';
      return (
        hasValue(data.full_name_ar) ||
        hasValue(data.full_name_en) ||
        hasValue(data.nationality) ||
        hasValue(data.passport_no) ||
        hasValue(data.responsible_office) ||
        hasValue(data.responsible_office_number) ||
        hasValue(data.notes) ||
        !!data.passport_expiry_at ||
        !!data.visa_deadline_at ||
        !!data.visa_sent_at ||
        !!data.expected_arrival_at ||
        !!data.passport_image_file_id ||
        !!data.visa_image_file_id ||
        !!data.flight_ticket_image_file_id ||
        !!data.personal_picture_file_id
      );
    },
    { message: 'At least one field is required to save as draft' },
  );

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
    const raw = body as { status_code?: string };
    const data =
      raw.status_code === 'DRAFT'
        ? CandidateDraftCreateSchema.parse({ ...raw, status_code: 'DRAFT' })
        : CandidateCreateSchema.parse(body);
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


