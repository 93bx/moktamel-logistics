import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { RECRUITMENT_STATUS } from './recruitment.constants';
import { HrEmploymentService } from '../hr-employment/hr-employment.service';

@Injectable()
export class HrRecruitmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly analytics: AnalyticsService,
    private readonly notifications: NotificationsService,
    private readonly files: FilesService,
    private readonly employmentSvc: HrEmploymentService,
  ) {}

  async list(company_id: string, input: { q?: string; status_code?: string; page: number; page_size: number }) {
    const where: any = { company_id, deleted_at: null };
    if (input.status_code) where.status_code = input.status_code;
    if (input.q) {
      where.OR = [
        { full_name_ar: { contains: input.q, mode: 'insensitive' } },
        { full_name_en: { contains: input.q, mode: 'insensitive' } },
        { passport_no: { contains: input.q, mode: 'insensitive' } },
        { responsible_office: { contains: input.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.recruitmentCandidate.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (input.page - 1) * input.page_size,
        take: input.page_size,
        select: {
          id: true,
          full_name_ar: true,
          full_name_en: true,
          nationality: true,
          passport_no: true,
          job_title_code: true,
          status_code: true,
          responsible_office: true,
          avatar_file_id: true,
          visa_deadline_at: true,
          visa_sent_at: true,
          expected_arrival_at: true,
          created_at: true,
          updated_at: true,
        },
      }),
      this.prisma.recruitmentCandidate.count({ where }),
    ]);

    return { items, total, page: input.page, page_size: input.page_size };
  }

  async getStats(company_id: string) {
    const now = new Date();
    const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [underProcedureCount, olderThan45DaysCount, arrivingWithin7DaysCount] = await this.prisma.$transaction([
      this.prisma.recruitmentCandidate.count({
        where: {
          company_id,
          deleted_at: null,
          status_code: RECRUITMENT_STATUS.UNDER_PROCEDURE,
        },
      }),
      this.prisma.recruitmentCandidate.count({
        where: {
          company_id,
          deleted_at: null,
          created_at: {
            lt: fortyFiveDaysAgo,
          },
        },
      }),
      this.prisma.recruitmentCandidate.count({
        where: {
          company_id,
          deleted_at: null,
          expected_arrival_at: {
            gte: now,
            lte: sevenDaysFromNow,
          },
        },
      }),
    ]);

    return {
      underProcedureCount,
      olderThan45DaysCount,
      arrivingWithin7DaysCount,
    };
  }

  async get(company_id: string, id: string) {
    const row = await this.prisma.recruitmentCandidate.findFirst({
      where: { id, company_id, deleted_at: null },
    });
    if (!row) throw new NotFoundException();

    // Get file links for this candidate
    const fileLinks = await this.prisma.fileLink.findMany({
      where: {
        company_id,
        entity_type: 'RECRUITMENT_CANDIDATE',
        entity_id: id,
      },
      include: {
        file: {
          select: {
            id: true,
            original_name: true,
            mime_type: true,
            size_bytes: true,
          },
        },
      },
    });

    return {
      ...row,
      files: fileLinks.map(link => ({
        file_id: link.file.id,
        purpose_code: link.purpose_code,
        original_name: link.file.original_name,
        mime_type: link.file.mime_type,
        size_bytes: link.file.size_bytes,
      })),
    };
  }

  async create(company_id: string, actor_user_id: string, data: any) {
    // Validation for required fields
    if (!data.full_name_ar || data.full_name_ar.trim().length < 2) {
      throw new BadRequestException('full_name_ar is required and must be at least 2 characters');
    }
    if (!data.nationality || data.nationality.trim().length < 2) {
      throw new BadRequestException('nationality is required and must be at least 2 characters');
    }
    if (!data.passport_no || data.passport_no.trim().length < 3) {
      throw new BadRequestException('passport_no is required and must be at least 3 characters');
    }
    if (!data.responsible_office || data.responsible_office.trim().length < 1) {
      throw new BadRequestException('responsible_office is required');
    }
    if (!data.passport_image_file_id) {
      throw new BadRequestException('passport_image_file_id is required');
    }

    if (data.visa_deadline_at && isNaN(Date.parse(data.visa_deadline_at))) {
      throw new BadRequestException('Invalid visa_deadline_at');
    }
    if (data.visa_sent_at && isNaN(Date.parse(data.visa_sent_at))) {
      throw new BadRequestException('Invalid visa_sent_at');
    }
    if (data.expected_arrival_at && isNaN(Date.parse(data.expected_arrival_at))) {
      throw new BadRequestException('Invalid expected_arrival_at');
    }

    const created = await this.prisma.recruitmentCandidate.create({
      data: {
        company_id,
        created_by_user_id: actor_user_id,
        full_name_ar: data.full_name_ar,
        full_name_en: data.full_name_en ?? null,
        nationality: data.nationality,
        passport_no: data.passport_no,
        job_title_code: data.job_title_code ?? null,
        department_id: data.department_id ?? null,
        responsible_office: data.responsible_office,
        avatar_file_id: data.personal_picture_file_id ?? data.avatar_file_id ?? null,
        status_code: data.status_code ?? RECRUITMENT_STATUS.UNDER_PROCEDURE,
        visa_deadline_at: data.visa_deadline_at ? new Date(data.visa_deadline_at) : null,
        visa_sent_at: data.visa_sent_at ? new Date(data.visa_sent_at) : null,
        expected_arrival_at: data.expected_arrival_at ? new Date(data.expected_arrival_at) : null,
        notes: data.notes ?? null,
      },
    });

    // If status is Arrived, create employment record
    if (created.status_code === RECRUITMENT_STATUS.ARRIVED) {
      await this.employmentSvc.create(company_id, actor_user_id, {
        recruitment_candidate_id: created.id,
        full_name_ar: created.full_name_ar,
        full_name_en: created.full_name_en,
        avatar_file_id: created.avatar_file_id,
        status_code: 'EMPLOYMENT_STATUS_UNDER_PROCEDURE',
      });
    }

    // Link files
    const filePurposes = [
      { file_id: data.passport_image_file_id, purpose_code: 'PASSPORT_IMAGE' },
      { file_id: data.visa_image_file_id, purpose_code: 'VISA_IMAGE' },
      { file_id: data.flight_ticket_image_file_id, purpose_code: 'FLIGHT_TICKET_IMAGE' },
      { file_id: data.personal_picture_file_id, purpose_code: 'PERSONAL_PICTURE' },
    ].filter(f => f.file_id); // Only link files that were provided

    for (const { file_id, purpose_code } of filePurposes) {
      await this.files.linkToEntity({
        company_id,
        actor_user_id,
        file_id,
        entity_type: 'RECRUITMENT_CANDIDATE',
        entity_id: created.id,
        purpose_code,
      });
    }

    await this.audit.log({
      company_id,
      actor_user_id,
      actor_role: null,
      action: 'HR_RECRUITMENT_CREATE',
      entity_type: 'RECRUITMENT_CANDIDATE',
      entity_id: created.id,
      new_values: created,
    });

    await this.analytics.track({
      company_id,
      actor_user_id,
      event_code: 'HR_RECRUITMENT_CREATED',
      entity_type: 'RECRUITMENT_CANDIDATE',
      entity_id: created.id,
      payload: { status_code: created.status_code },
    });

    return created;
  }

  async update(company_id: string, actor_user_id: string, id: string, data: any) {
    const existing = await this.prisma.recruitmentCandidate.findFirst({
      where: { id, company_id, deleted_at: null },
    });
    if (!existing) throw new NotFoundException();

    // If status is being changed to "Arrived", create employment record
    const isChangingToArrived = data.status_code === RECRUITMENT_STATUS.ARRIVED && 
                                 existing.status_code !== RECRUITMENT_STATUS.ARRIVED;

    const updated = await this.prisma.recruitmentCandidate.update({
      where: { id },
      data: {
        full_name_ar: data.full_name_ar ?? undefined,
        full_name_en: data.full_name_en ?? undefined,
        nationality: data.nationality ?? undefined,
        passport_no: data.passport_no ?? undefined,
        job_title_code: data.job_title_code ?? undefined,
        department_id: data.department_id ?? undefined,
        responsible_office: data.responsible_office ?? undefined,
        avatar_file_id: data.personal_picture_file_id ?? data.avatar_file_id ?? undefined,
        status_code: data.status_code ?? undefined,
        visa_deadline_at: data.visa_deadline_at ? new Date(data.visa_deadline_at) : undefined,
        visa_sent_at: data.visa_sent_at ? new Date(data.visa_sent_at) : undefined,
        expected_arrival_at: data.expected_arrival_at ? new Date(data.expected_arrival_at) : undefined,
        notes: data.notes ?? undefined,
      },
    });

    // Update file links if provided
    const fileUpdates = [
      { file_id: data.passport_image_file_id, purpose_code: 'PASSPORT_IMAGE' },
      { file_id: data.visa_image_file_id, purpose_code: 'VISA_IMAGE' },
      { file_id: data.flight_ticket_image_file_id, purpose_code: 'FLIGHT_TICKET_IMAGE' },
      { file_id: data.personal_picture_file_id, purpose_code: 'PERSONAL_PICTURE' },
    ].filter(f => f.file_id);

    for (const { file_id, purpose_code } of fileUpdates) {
      // Delete existing link for this purpose if exists
      await this.prisma.fileLink.deleteMany({
        where: {
          company_id,
          entity_type: 'RECRUITMENT_CANDIDATE',
          entity_id: id,
          purpose_code,
        },
      });
      // Create new link
      await this.files.linkToEntity({
        company_id,
        actor_user_id,
        file_id,
        entity_type: 'RECRUITMENT_CANDIDATE',
        entity_id: id,
        purpose_code,
      });
    }

    // If status changed to "Arrived", create employment record
    if (isChangingToArrived) {
      await this.employmentSvc.create(company_id, actor_user_id, {
        recruitment_candidate_id: id,
        full_name_ar: updated.full_name_ar,
        full_name_en: updated.full_name_en,
        avatar_file_id: updated.avatar_file_id,
        status_code: 'EMPLOYMENT_STATUS_UNDER_PROCEDURE',
      });
    }

    await this.audit.log({
      company_id,
      actor_user_id,
      actor_role: null,
      action: 'HR_RECRUITMENT_UPDATE',
      entity_type: 'RECRUITMENT_CANDIDATE',
      entity_id: updated.id,
      old_values: existing,
      new_values: updated,
    });

    if (existing.status_code !== updated.status_code) {
      await this.analytics.track({
        company_id,
        actor_user_id,
        event_code: 'HR_RECRUITMENT_STATUS_CHANGED',
        entity_type: 'RECRUITMENT_CANDIDATE',
        entity_id: updated.id,
        payload: { from: existing.status_code, to: updated.status_code },
      });
    }

    // Notification for visa deadline
    if (updated.visa_deadline_at) {
      const days = Math.ceil((updated.visa_deadline_at.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (days >= 0 && days <= 7) {
        await this.notifications.create({
          company_id,
          type_code: 'HR_RECRUITMENT_VISA_DEADLINE_SOON',
          severity: 'WARNING',
          payload: { candidate_id: updated.id, days },
          created_by_user_id: actor_user_id,
        });
      }
    }

    return updated;
  }

  async remove(company_id: string, actor_user_id: string, id: string) {
    const existing = await this.prisma.recruitmentCandidate.findFirst({
      where: { id, company_id, deleted_at: null },
    });
    if (!existing) throw new NotFoundException();

    const deleted = await this.prisma.recruitmentCandidate.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    await this.audit.log({
      company_id,
      actor_user_id,
      actor_role: null,
      action: 'HR_RECRUITMENT_DELETE',
      entity_type: 'RECRUITMENT_CANDIDATE',
      entity_id: deleted.id,
      old_values: existing,
      new_values: { deleted_at: deleted.deleted_at },
    });

    await this.analytics.track({
      company_id,
      actor_user_id,
      event_code: 'HR_RECRUITMENT_DELETED',
      entity_type: 'RECRUITMENT_CANDIDATE',
      entity_id: deleted.id,
    });

    return { ok: true };
  }
}


