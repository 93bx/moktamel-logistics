import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HrEmploymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly analytics: AnalyticsService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(company_id: string, input: { q?: string; status_code?: string; platform?: string; has_assets?: string; page: number; page_size: number }) {
    const where: any = { company_id, deleted_at: null };
    if (input.status_code) where.status_code = input.status_code;
    if (input.platform) where.assigned_platform = input.platform;
    if (input.has_assets === 'true') {
      where.assets = { some: { recovered_at: null } };
    }
    if (input.q) {
      where.OR = [
        { employee_no: { contains: input.q, mode: 'insensitive' } },
        { employee_code: { contains: input.q, mode: 'insensitive' } },
        { full_name_ar: { contains: input.q, mode: 'insensitive' } },
        { full_name_en: { contains: input.q, mode: 'insensitive' } },
        { iqama_no: { contains: input.q, mode: 'insensitive' } },
        { cost_center_code: { contains: input.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.employmentRecord.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (input.page - 1) * input.page_size,
        take: input.page_size,
        select: {
          id: true,
          recruitment_candidate_id: true,
          employee_no: true,
          employee_code: true,
          full_name_ar: true,
          full_name_en: true,
          nationality: true,
          phone: true,
          date_of_birth: true,
          iqama_no: true,
          iqama_expiry_at: true,
          iqama_file_id: true,
          passport_no: true,
          passport_expiry_at: true,
          passport_file_id: true,
          contract_no: true,
          contract_end_at: true,
          contract_file_id: true,
          license_expiry_at: true,
          license_file_id: true,
          promissory_note_file_id: true,
          avatar_file_id: true,
          custody_status: true,
          start_date_at: true,
          medical_expiry_at: true,
          status_code: true,
          salary_amount: true,
          salary_currency_code: true,
          cost_center_code: true,
          assigned_platform: true,
          platform_user_no: true,
          job_type: true,
          created_at: true,
          updated_at: true,
          assets: {
            where: { recovered_at: null },
            select: {
              id: true,
              asset: {
                select: {
                  type: true,
                  name: true,
                },
              },
            },
          },
          recruitment_candidate: {
            select: {
              full_name_ar: true,
              full_name_en: true,
            },
          },
        },
      }),
      this.prisma.employmentRecord.count({ where }),
    ]);

    return { items, total, page: input.page, page_size: input.page_size };
  }

  async getStats(company_id: string) {
    const now = new Date();
    const twentyDaysFromNow = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000);

    const [
      totalEmployees,
      employeesOnDuty,
      employeesOnboarding,
      documentsExpiringSoon,
      employeesLostOrEscaped,
    ] = await this.prisma.$transaction([
      // Total employees
      this.prisma.employmentRecord.count({
        where: {
          company_id,
          deleted_at: null,
        },
      }),
      // Employees on duty (ready for work + custody received)
      this.prisma.employmentRecord.count({
        where: {
          company_id,
          deleted_at: null,
          status_code: 'EMPLOYMENT_STATUS_READY_FOR_WORK',
          custody_status: 'received',
        },
      }),
      // Employees onboarding (under procedure)
      this.prisma.employmentRecord.count({
        where: {
          company_id,
          deleted_at: null,
          status_code: 'EMPLOYMENT_STATUS_UNDER_PROCEDURE',
        },
      }),
      // Documents expiring within 20 days
      this.prisma.employmentRecord.count({
        where: {
          company_id,
          deleted_at: null,
          OR: [
            {
              contract_end_at: {
                gte: now,
                lte: twentyDaysFromNow,
              },
            },
            {
              iqama_expiry_at: {
                gte: now,
                lte: twentyDaysFromNow,
              },
            },
            {
              passport_expiry_at: {
                gte: now,
                lte: twentyDaysFromNow,
              },
            },
            {
              medical_expiry_at: {
                gte: now,
                lte: twentyDaysFromNow,
              },
            },
          ],
        },
      }),
      // Employees lost contact or escaped
      this.prisma.employmentRecord.count({
        where: {
          company_id,
          deleted_at: null,
          status_code: {
            in: ['EMPLOYMENT_STATUS_LOST_CONTACT', 'EMPLOYMENT_STATUS_ESCAPED'],
          },
        },
      }),
    ]);

    return {
      totalEmployees,
      employeesOnDuty,
      employeesOnboarding,
      documentsExpiringSoon,
      employeesLostOrEscaped,
    };
  }

  async get(company_id: string, id: string) {
    const row = await this.prisma.employmentRecord.findFirst({
      where: { id, company_id, deleted_at: null },
      include: {
        assets: {
          where: { recovered_at: null },
          include: {
            asset: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  private generateEmployeeCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // Exclude I, O for clarity
    const nums = '123456789'; // Exclude 0 for clarity
    const r = (set: string) => set.charAt(Math.floor(Math.random() * set.length));
    // Pattern: A1B2C
    return `${r(chars)}${r(nums)}${r(chars)}${r(nums)}${r(chars)}`;
  }

  private validateActiveStatus(data: any) {
    if (data.status_code === 'EMPLOYMENT_STATUS_ACTIVE') {
      const requiredFiles = [
        { id: data.passport_file_id, name: 'Passport' },
        { id: data.iqama_file_id, name: 'Iqama' },
        { id: data.contract_file_id, name: 'Contract' },
      ];

      for (const file of requiredFiles) {
        if (!file.id) {
          throw new BadRequestException(`${file.name} file is required for Active status`);
        }
      }

      const now = new Date();
      const expiries = [
        { date: data.passport_expiry_at, name: 'Passport' },
        { date: data.iqama_expiry_at, name: 'Iqama' },
        { date: data.contract_end_at, name: 'Contract' },
      ];

      for (const exp of expiries) {
        if (!exp.date) {
          throw new BadRequestException(`${exp.name} expiry date is required for Active status`);
        }
        if (new Date(exp.date) <= now) {
          throw new BadRequestException(`${exp.name} has expired. Cannot set status to Active.`);
        }
      }
    }
  }

  private async getUniqueEmployeeCode(company_id: string): Promise<string> {
    let code = '';
    let exists = true;
    let attempts = 0;
    while (exists && attempts < 10) {
      code = this.generateEmployeeCode();
      const count = await this.prisma.employmentRecord.count({
        where: { company_id, employee_code: code },
      });
      exists = count > 0;
      attempts++;
    }
    return code;
  }

  async create(company_id: string, actor_user_id: string, data: any) {
    const dateFields = [
      'start_date_at',
      'contract_end_at',
      'iqama_expiry_at',
      'passport_expiry_at',
      'medical_expiry_at',
      'date_of_birth',
      'license_expiry_at',
    ];
    for (const k of dateFields) {
      if (data[k] && isNaN(Date.parse(data[k]))) {
        throw new BadRequestException(`Invalid ${k}`);
      }
    }

    this.validateActiveStatus(data);

    const employee_code = data.employee_code || (await this.getUniqueEmployeeCode(company_id));

    const created = await this.prisma.employmentRecord.create({
      data: {
        company_id,
        created_by_user_id: actor_user_id,
        recruitment_candidate_id: data.recruitment_candidate_id ?? null,
        employee_no: data.employee_no ?? null,
        employee_code,
        full_name_ar: data.full_name_ar ?? null,
        full_name_en: data.full_name_en ?? null,
        nationality: data.nationality ?? null,
        phone: data.phone ?? null,
        date_of_birth: data.date_of_birth ? new Date(data.date_of_birth) : null,
        iqama_no: data.iqama_no ?? null,
        iqama_expiry_at: data.iqama_expiry_at ? new Date(data.iqama_expiry_at) : null,
        iqama_file_id: data.iqama_file_id ?? null,
        passport_no: data.passport_no ?? null,
        passport_expiry_at: data.passport_expiry_at ? new Date(data.passport_expiry_at) : null,
        passport_file_id: data.passport_file_id ?? null,
        contract_no: data.contract_no ?? null,
        contract_end_at: data.contract_end_at ? new Date(data.contract_end_at) : null,
        contract_file_id: data.contract_file_id ?? null,
        license_expiry_at: data.license_expiry_at ? new Date(data.license_expiry_at) : null,
        license_file_id: data.license_file_id ?? null,
        promissory_note_file_id: data.promissory_note_file_id ?? null,
        avatar_file_id: data.avatar_file_id ?? null,
        custody_status: data.custody_status ?? null,
        start_date_at: data.start_date_at ? new Date(data.start_date_at) : null,
        medical_expiry_at: data.medical_expiry_at ? new Date(data.medical_expiry_at) : null,
        status_code: data.status_code ?? 'EMPLOYMENT_STATUS_ACTIVE',
        salary_amount: data.salary_amount ?? null,
        salary_currency_code: data.salary_currency_code ?? 'SAR',
        cost_center_code: data.cost_center_code ?? null,
        assigned_platform: data.assigned_platform ?? null,
        platform_user_no: data.platform_user_no ?? null,
        job_type: data.job_type ?? null,
      },
    });

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'HR_EMPLOYMENT_CREATE',
      entity_type: 'EMPLOYMENT_RECORD',
      entity_id: created.id,
      new_values: created,
    });

    await this.analytics.track({
      company_id,
      actor_user_id,
      event_code: 'HR_EMPLOYMENT_CREATED',
      entity_type: 'EMPLOYMENT_RECORD',
      entity_id: created.id,
      payload: { status_code: created.status_code },
    });

    // Placeholder notification: expiry soon
    if (created.iqama_expiry_at) {
      const days = Math.ceil((created.iqama_expiry_at.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (days >= 0 && days <= 30) {
        await this.notifications.create({
          company_id,
          type_code: 'HR_EMPLOYMENT_IQAMA_EXPIRY_SOON',
          severity: 'WARNING',
          payload: { employment_id: created.id, days },
          created_by_user_id: actor_user_id,
        });
      }
    }

    return created;
  }

  async update(company_id: string, actor_user_id: string, id: string, data: any) {
    const existing = await this.prisma.employmentRecord.findFirst({
      where: { id, company_id, deleted_at: null },
    });
    if (!existing) throw new NotFoundException();

    // For validation, we merge existing with updates if checking for ACTIVE status
    if (data.status_code === 'EMPLOYMENT_STATUS_ACTIVE') {
      this.validateActiveStatus({ ...existing, ...data });
    }

    const updated = await this.prisma.employmentRecord.update({
      where: { id },
      data: {
        recruitment_candidate_id: data.recruitment_candidate_id ?? undefined,
        employee_no: data.employee_no ?? undefined,
        employee_code: data.employee_code ?? undefined,
        full_name_ar: data.full_name_ar ?? undefined,
        full_name_en: data.full_name_en ?? undefined,
        nationality: data.nationality ?? undefined,
        phone: data.phone ?? undefined,
        date_of_birth: data.date_of_birth ? new Date(data.date_of_birth) : undefined,
        iqama_no: data.iqama_no ?? undefined,
        iqama_expiry_at: data.iqama_expiry_at ? new Date(data.iqama_expiry_at) : undefined,
        iqama_file_id: data.iqama_file_id ?? undefined,
        passport_no: data.passport_no ?? undefined,
        passport_expiry_at: data.passport_expiry_at ? new Date(data.passport_expiry_at) : undefined,
        passport_file_id: data.passport_file_id ?? undefined,
        contract_no: data.contract_no ?? undefined,
        contract_end_at: data.contract_end_at ? new Date(data.contract_end_at) : undefined,
        contract_file_id: data.contract_file_id ?? undefined,
        license_expiry_at: data.license_expiry_at ? new Date(data.license_expiry_at) : undefined,
        license_file_id: data.license_file_id ?? undefined,
        promissory_note_file_id: data.promissory_note_file_id ?? undefined,
        avatar_file_id: data.avatar_file_id ?? undefined,
        custody_status: data.custody_status ?? undefined,
        start_date_at: data.start_date_at ? new Date(data.start_date_at) : undefined,
        medical_expiry_at: data.medical_expiry_at ? new Date(data.medical_expiry_at) : undefined,
        status_code: data.status_code ?? undefined,
        salary_amount: data.salary_amount ?? undefined,
        salary_currency_code: data.salary_currency_code ?? undefined,
        cost_center_code: data.cost_center_code ?? undefined,
        assigned_platform: data.assigned_platform ?? undefined,
        platform_user_no: data.platform_user_no ?? undefined,
        job_type: data.job_type ?? undefined,
      },
    });

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'HR_EMPLOYMENT_UPDATE',
      entity_type: 'EMPLOYMENT_RECORD',
      entity_id: updated.id,
      old_values: existing,
      new_values: updated,
    });

    if (existing.status_code !== updated.status_code) {
      await this.analytics.track({
        company_id,
        actor_user_id,
        event_code: 'HR_EMPLOYMENT_STATUS_CHANGED',
        entity_type: 'EMPLOYMENT_RECORD',
        entity_id: updated.id,
        payload: { from: existing.status_code, to: updated.status_code },
      });
    }

    return updated;
  }

  async remove(company_id: string, actor_user_id: string, id: string) {
    const existing = await this.prisma.employmentRecord.findFirst({
      where: { id, company_id, deleted_at: null },
    });
    if (!existing) throw new NotFoundException();

    const deleted = await this.prisma.employmentRecord.update({
      where: { id },
      data: { deleted_at: new Date() },
    });

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'HR_EMPLOYMENT_DELETE',
      entity_type: 'EMPLOYMENT_RECORD',
      entity_id: deleted.id,
      old_values: existing,
      new_values: { deleted_at: deleted.deleted_at },
    });

    await this.analytics.track({
      company_id,
      actor_user_id,
      event_code: 'HR_EMPLOYMENT_DELETED',
      entity_type: 'EMPLOYMENT_RECORD',
      entity_id: deleted.id,
    });

    return { ok: true };
  }
}


