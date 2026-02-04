import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { RECRUITMENT_STATUS } from './recruitment.constants';
import { HrEmploymentService } from '../hr-employment/hr-employment.service';

/** Start of day in UTC for date-only comparison */
function startOfDayUTC(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

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

  /**
   * Derive recruitment status from expected_arrival_at.
   * Empty -> UNDER_PROCEDURE; future -> ON_ARRIVAL; today or yesterday -> ON_ARRIVAL; more than 1 day past -> ARRIVED.
   */
  private deriveStatusFromExpectedArrival(expected_arrival_at: Date | string | null): string {
    if (expected_arrival_at == null) return RECRUITMENT_STATUS.UNDER_PROCEDURE;
    const d = typeof expected_arrival_at === 'string' ? new Date(expected_arrival_at) : expected_arrival_at;
    if (isNaN(d.getTime())) return RECRUITMENT_STATUS.UNDER_PROCEDURE;
    const dateOnly = startOfDayUTC(d);
    const now = new Date();
    const startOfToday = startOfDayUTC(now);
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setUTCDate(startOfYesterday.getUTCDate() - 1);
    if (dateOnly > startOfToday) return RECRUITMENT_STATUS.ON_ARRIVAL;
    if (dateOnly >= startOfYesterday) return RECRUITMENT_STATUS.ON_ARRIVAL;
    return RECRUITMENT_STATUS.ARRIVED;
  }

  /** True if date is within 5 days from today (today through today+5). */
  private isWithinArrivalSoonWindow(expected_arrival_at: Date | null): boolean {
    if (!expected_arrival_at) return false;
    const dateOnly = startOfDayUTC(expected_arrival_at);
    const now = new Date();
    const startOfToday = startOfDayUTC(now);
    const fiveDaysLater = new Date(startOfToday);
    fiveDaysLater.setUTCDate(fiveDaysLater.getUTCDate() + 5);
    return dateOnly >= startOfToday && dateOnly <= fiveDaysLater;
  }

  private readonly ARRIVAL_SOON_TYPE = 'HR_RECRUITMENT_ARRIVAL_SOON';

  private async upsertArrivalSoonNotification(
    company_id: string,
    candidate_id: string,
    expected_arrival_at: Date,
    full_name_ar: string,
    full_name_en: string | null,
    created_by_user_id: string,
  ): Promise<void> {
    const daysUntil = Math.ceil((expected_arrival_at.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const payload = {
      candidate_id,
      expected_arrival_at: expected_arrival_at.toISOString(),
      days_until: Math.max(0, daysUntil),
      full_name_ar,
      full_name_en: full_name_en ?? undefined,
    };
    const existing = await this.notifications.findRecentByTypeAndPayloadCandidate(
      company_id,
      this.ARRIVAL_SOON_TYPE,
      candidate_id,
      48,
    );
    if (existing) {
      await this.notifications.updatePayload(existing.id, company_id, payload);
    } else {
      await this.notifications.create({
        company_id,
        type_code: this.ARRIVAL_SOON_TYPE,
        severity: 'WARNING',
        payload,
        created_by_user_id,
      });
    }
  }

  async list(
    company_id: string,
    input: {
      q?: string;
      status_code?: string;
      page: number;
      page_size: number;
      sort?: 'under_procedure' | 'drafts' | 'arriving_soon' | 'older_than_45_days';
    },
  ) {
    const where: Prisma.RecruitmentCandidateWhereInput = { company_id, deleted_at: null };
    if (input.status_code) where.status_code = input.status_code;
    if (input.q) {
      where.OR = [
        { full_name_ar: { contains: input.q, mode: 'insensitive' } },
        { full_name_en: { contains: input.q, mode: 'insensitive' } },
        { passport_no: { contains: input.q, mode: 'insensitive' } },
        { responsible_office: { contains: input.q, mode: 'insensitive' } },
      ];
    }

    const skip = (input.page - 1) * input.page_size;
    const qPattern = input.q ? `%${input.q}%` : null;

    const defaultOrderBy = Prisma.sql`CASE "status_code"
      WHEN 'ON_ARRIVAL' THEN 1
      WHEN 'UNDER_PROCEDURE' THEN 2
      WHEN 'DRAFT' THEN 3
      WHEN 'ARRIVED' THEN 4
      ELSE 5
    END, "expected_arrival_at" ASC NULLS LAST`;
    let orderByFragment: Prisma.Sql;
    switch (input.sort) {
      case 'under_procedure':
        orderByFragment = Prisma.sql`(CASE "status_code" WHEN 'UNDER_PROCEDURE' THEN 0 ELSE 1 END) ASC, "expected_arrival_at" ASC NULLS LAST`;
        break;
      case 'drafts':
        orderByFragment = Prisma.sql`(CASE "status_code" WHEN 'DRAFT' THEN 0 ELSE 1 END) ASC, "expected_arrival_at" ASC NULLS LAST`;
        break;
      case 'arriving_soon':
        orderByFragment = Prisma.sql`"expected_arrival_at" ASC NULLS LAST`;
        break;
      case 'older_than_45_days':
        orderByFragment = Prisma.sql`"visa_sent_at" ASC NULLS LAST`;
        break;
      default:
        orderByFragment = defaultOrderBy;
    }

    const listQuery = Prisma.sql`
      SELECT id, full_name_ar, full_name_en, nationality, passport_no, job_title_code,
             status_code, responsible_office, avatar_file_id, visa_deadline_at, visa_sent_at,
             expected_arrival_at, created_at, updated_at
      FROM "RecruitmentCandidate"
      WHERE "company_id" = ${company_id}::uuid AND "deleted_at" IS NULL
      ${input.status_code ? Prisma.sql`AND "status_code" = ${input.status_code}` : Prisma.empty}
      ${qPattern !== null ? Prisma.sql`AND ("full_name_ar" ILIKE ${qPattern} OR "full_name_en" ILIKE ${qPattern} OR "passport_no" ILIKE ${qPattern} OR "responsible_office" ILIKE ${qPattern})` : Prisma.empty}
      ORDER BY ${orderByFragment}
      LIMIT ${input.page_size}
      OFFSET ${skip}
    `;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.$queryRaw(listQuery),
      this.prisma.recruitmentCandidate.count({ where }),
    ]);

    return { items, total, page: input.page, page_size: input.page_size };
  }

  async getStats(company_id: string) {
    const now = new Date();
    const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000);
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [underProcedureCount, draftCount, olderThan45DaysCount, arrivingWithin7DaysCount] =
      await this.prisma.$transaction([
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
            status_code: RECRUITMENT_STATUS.DRAFT,
          },
        }),
        this.prisma.recruitmentCandidate.count({
          where: {
            company_id,
            deleted_at: null,
            status_code: {
              in: [RECRUITMENT_STATUS.UNDER_PROCEDURE, RECRUITMENT_STATUS.DRAFT],
            },
            visa_sent_at: {
              lt: fortyFiveDaysAgo,
            },
          },
        }),
        this.prisma.recruitmentCandidate.count({
          where: {
            company_id,
            deleted_at: null,
            status_code: { not: RECRUITMENT_STATUS.DRAFT },
            expected_arrival_at: {
              gte: now,
              lte: sevenDaysFromNow,
            },
          },
        }),
      ]);

    return {
      underProcedureCount,
      draftCount,
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
    if (data.status_code === RECRUITMENT_STATUS.DRAFT) {
      return this.createDraft(company_id, actor_user_id, data);
    }

    // Validation for required fields
    if (!data.full_name_ar || data.full_name_ar.trim().length < 2) {
      throw new BadRequestException('full_name_ar is required and must be at least 2 characters');
    }
    if (!data.full_name_en || data.full_name_en.trim().length < 2) {
      throw new BadRequestException('full_name_en is required and must be at least 2 characters');
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
    if (!data.passport_expiry_at || isNaN(Date.parse(data.passport_expiry_at))) {
      throw new BadRequestException('passport_expiry_at is required and must be a valid date');
    }
    if (data.responsible_office_number && data.responsible_office_number.length > 10) {
      throw new BadRequestException('responsible_office_number must be at most 10 characters');
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

    const expectedArrival = data.expected_arrival_at ? new Date(data.expected_arrival_at) : null;
    const statusCode = this.deriveStatusFromExpectedArrival(expectedArrival);

    const created = await this.prisma.recruitmentCandidate.create({
      data: {
        company_id,
        created_by_user_id: actor_user_id,
        full_name_ar: data.full_name_ar,
        full_name_en: data.full_name_en.trim(),
        nationality: data.nationality,
        passport_no: data.passport_no,
        passport_expiry_at: new Date(data.passport_expiry_at),
        job_title_code: data.job_title_code ?? null,
        department_id: data.department_id ?? null,
        responsible_office: data.responsible_office,
        responsible_office_number: data.responsible_office_number?.trim() || null,
        avatar_file_id: data.personal_picture_file_id ?? data.avatar_file_id ?? null,
        status_code: statusCode,
        visa_deadline_at: data.visa_deadline_at ? new Date(data.visa_deadline_at) : null,
        visa_sent_at: data.visa_sent_at ? new Date(data.visa_sent_at) : null,
        expected_arrival_at: expectedArrival,
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

    if (created.expected_arrival_at && this.isWithinArrivalSoonWindow(created.expected_arrival_at)) {
      await this.upsertArrivalSoonNotification(
        company_id,
        created.id,
        created.expected_arrival_at,
        created.full_name_ar,
        created.full_name_en,
        actor_user_id,
      );
    }

    return created;
  }

  private hasDraftField(data: any): boolean {
    const hasValue = (v: unknown) => v != null && String(v).trim() !== '';
    return (
      hasValue(data?.full_name_ar) ||
      hasValue(data?.full_name_en) ||
      hasValue(data?.nationality) ||
      hasValue(data?.passport_no) ||
      hasValue(data?.responsible_office) ||
      hasValue(data?.responsible_office_number) ||
      hasValue(data?.notes) ||
      !!(data?.passport_expiry_at && !isNaN(Date.parse(data.passport_expiry_at))) ||
      !!(data?.visa_deadline_at && !isNaN(Date.parse(data.visa_deadline_at))) ||
      !!(data?.visa_sent_at && !isNaN(Date.parse(data.visa_sent_at))) ||
      !!(data?.expected_arrival_at && !isNaN(Date.parse(data.expected_arrival_at))) ||
      !!data?.passport_image_file_id ||
      !!data?.visa_image_file_id ||
      !!data?.flight_ticket_image_file_id ||
      !!data?.personal_picture_file_id
    );
  }

  private async createDraft(company_id: string, actor_user_id: string, data: any) {
    if (!this.hasDraftField(data)) {
      throw new BadRequestException('At least one field is required to save as draft');
    }
    if (data.responsible_office_number && data.responsible_office_number.length > 10) {
      throw new BadRequestException('responsible_office_number must be at most 10 characters');
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

    const fullNameAr = data.full_name_ar != null ? String(data.full_name_ar).trim() : '';
    const fullNameEn = data.full_name_en != null ? String(data.full_name_en).trim() : null;
    const nationality = data.nationality != null ? String(data.nationality).trim() : '';
    const passportNo = data.passport_no != null ? String(data.passport_no).trim() : '';
    const responsibleOffice = data.responsible_office != null ? String(data.responsible_office).trim() : '';
    const responsibleOfficeNumber =
      data.responsible_office_number != null ? String(data.responsible_office_number).trim() || null : null;
    const passportExpiryAt =
      data.passport_expiry_at && !isNaN(Date.parse(data.passport_expiry_at))
        ? new Date(data.passport_expiry_at)
        : null;
    const visaDeadlineAt =
      data.visa_deadline_at && !isNaN(Date.parse(data.visa_deadline_at))
        ? new Date(data.visa_deadline_at)
        : null;
    const visaSentAt =
      data.visa_sent_at && !isNaN(Date.parse(data.visa_sent_at)) ? new Date(data.visa_sent_at) : null;
    const expectedArrival =
      data.expected_arrival_at && !isNaN(Date.parse(data.expected_arrival_at))
        ? new Date(data.expected_arrival_at)
        : null;

    const created = await this.prisma.recruitmentCandidate.create({
      data: {
        company_id,
        created_by_user_id: actor_user_id,
        full_name_ar: fullNameAr,
        full_name_en: fullNameEn,
        nationality,
        passport_no: passportNo,
        passport_expiry_at: passportExpiryAt,
        job_title_code: data.job_title_code ?? null,
        department_id: data.department_id ?? null,
        responsible_office: responsibleOffice,
        responsible_office_number: responsibleOfficeNumber,
        avatar_file_id: data.personal_picture_file_id ?? data.avatar_file_id ?? null,
        status_code: RECRUITMENT_STATUS.DRAFT,
        visa_deadline_at: visaDeadlineAt,
        visa_sent_at: visaSentAt,
        expected_arrival_at: expectedArrival,
        notes: data.notes != null ? String(data.notes).trim() || null : null,
      },
    });

    const filePurposes = [
      { file_id: data.passport_image_file_id, purpose_code: 'PASSPORT_IMAGE' },
      { file_id: data.visa_image_file_id, purpose_code: 'VISA_IMAGE' },
      { file_id: data.flight_ticket_image_file_id, purpose_code: 'FLIGHT_TICKET_IMAGE' },
      { file_id: data.personal_picture_file_id, purpose_code: 'PERSONAL_PICTURE' },
    ].filter(f => f.file_id);

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

    // Publishing draft: client sends status_code UNDER_PROCEDURE (or other non-draft) when current is DRAFT
    const isPublishingDraft =
      existing.status_code === RECRUITMENT_STATUS.DRAFT &&
      data.status_code != null &&
      data.status_code !== RECRUITMENT_STATUS.DRAFT;

    if (isPublishingDraft) {
      const merged = {
        full_name_ar: (data.full_name_ar ?? existing.full_name_ar) ?? '',
        full_name_en: (data.full_name_en ?? existing.full_name_en) ?? '',
        nationality: (data.nationality ?? existing.nationality) ?? '',
        passport_no: (data.passport_no ?? existing.passport_no) ?? '',
        responsible_office: (data.responsible_office ?? existing.responsible_office) ?? '',
        passport_expiry_at: data.passport_expiry_at ?? existing.passport_expiry_at,
        responsible_office_number: data.responsible_office_number !== undefined ? data.responsible_office_number : existing.responsible_office_number,
      };
      if (!merged.full_name_ar || merged.full_name_ar.trim().length < 2) {
        throw new BadRequestException('full_name_ar is required and must be at least 2 characters');
      }
      if (!merged.full_name_en || merged.full_name_en.trim().length < 2) {
        throw new BadRequestException('full_name_en is required and must be at least 2 characters');
      }
      if (!merged.nationality || merged.nationality.trim().length < 2) {
        throw new BadRequestException('nationality is required and must be at least 2 characters');
      }
      if (!merged.passport_no || merged.passport_no.trim().length < 3) {
        throw new BadRequestException('passport_no is required and must be at least 3 characters');
      }
      if (!merged.responsible_office || merged.responsible_office.trim().length < 1) {
        throw new BadRequestException('responsible_office is required');
      }
      if (!merged.passport_expiry_at || isNaN(new Date(merged.passport_expiry_at).getTime())) {
        throw new BadRequestException('passport_expiry_at is required and must be a valid date');
      }
      if (merged.responsible_office_number != null && String(merged.responsible_office_number).length > 10) {
        throw new BadRequestException('responsible_office_number must be at most 10 characters');
      }
      if (!data.passport_image_file_id) {
        throw new BadRequestException('passport_image_file_id is required when submitting a draft');
      }
    }

    // Explicit "Mark as Arrived": client sends status_code ARRIVED and current is ON_ARRIVAL (not for drafts)
    const explicitMarkAsArrived =
      existing.status_code !== RECRUITMENT_STATUS.DRAFT &&
      data.status_code === RECRUITMENT_STATUS.ARRIVED &&
      existing.status_code === RECRUITMENT_STATUS.ON_ARRIVAL;

    let statusCode: string | undefined;
    if (explicitMarkAsArrived) {
      statusCode = RECRUITMENT_STATUS.ARRIVED;
    } else if (isPublishingDraft) {
      const expectedArrival = data.expected_arrival_at != null
        ? (data.expected_arrival_at ? new Date(data.expected_arrival_at) : null)
        : existing.expected_arrival_at;
      statusCode = this.deriveStatusFromExpectedArrival(expectedArrival);
    } else if (data.expected_arrival_at !== undefined) {
      const expectedArrival = data.expected_arrival_at ? new Date(data.expected_arrival_at) : null;
      statusCode = this.deriveStatusFromExpectedArrival(expectedArrival);
    }

    const isChangingToArrived =
      (statusCode ?? existing.status_code) === RECRUITMENT_STATUS.ARRIVED &&
      existing.status_code !== RECRUITMENT_STATUS.ARRIVED;

    const updated = await this.prisma.recruitmentCandidate.update({
      where: { id },
      data: {
        full_name_ar: data.full_name_ar ?? undefined,
        full_name_en: data.full_name_en ?? undefined,
        nationality: data.nationality ?? undefined,
        passport_no: data.passport_no ?? undefined,
        passport_expiry_at: data.passport_expiry_at ? new Date(data.passport_expiry_at) : undefined,
        job_title_code: data.job_title_code ?? undefined,
        department_id: data.department_id ?? undefined,
        responsible_office: data.responsible_office ?? undefined,
        responsible_office_number: data.responsible_office_number !== undefined ? (data.responsible_office_number?.trim() || null) : undefined,
        avatar_file_id: data.personal_picture_file_id ?? data.avatar_file_id ?? undefined,
        ...(statusCode !== undefined && { status_code: statusCode }),
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

    if (updated.expected_arrival_at && this.isWithinArrivalSoonWindow(updated.expected_arrival_at)) {
      await this.upsertArrivalSoonNotification(
        company_id,
        updated.id,
        updated.expected_arrival_at,
        updated.full_name_ar,
        updated.full_name_en,
        actor_user_id,
      );
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

  /**
   * Daily job: recompute status for all candidates with expected_arrival_at.
   * Only syncs UNDER_PROCEDURE and ON_ARRIVAL from expected date. ARRIVED is never set automatically;
   * it only changes when the user clicks "Mark as Arrived".
   */
  async runDailyStatusRecompute(): Promise<{ updated: number }> {
    const candidates = await this.prisma.recruitmentCandidate.findMany({
      where: { deleted_at: null, expected_arrival_at: { not: null } },
      select: {
        id: true,
        company_id: true,
        status_code: true,
        expected_arrival_at: true,
        full_name_ar: true,
        full_name_en: true,
        avatar_file_id: true,
      },
    });
    let updated = 0;
    for (const row of candidates) {
      if (row.status_code === RECRUITMENT_STATUS.DRAFT) continue;
      const expectedArrival = row.expected_arrival_at!;
      const newStatus = this.deriveStatusFromExpectedArrival(expectedArrival);
      if (newStatus === RECRUITMENT_STATUS.ARRIVED) continue;
      if (newStatus === row.status_code) continue;
      await this.prisma.recruitmentCandidate.update({
        where: { id: row.id },
        data: { status_code: newStatus },
      });
      updated++;
    }
    return { updated };
  }
}


