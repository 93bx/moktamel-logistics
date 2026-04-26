import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PayrollConfigService } from '../payroll-config/payroll-config.service';
import { PrismaService } from '../prisma/prisma.service';

/** Sequence length for employee code suffix (001, 002, …). Increase to 4+ for more than 999 employees per company. */
const EMPLOYEE_CODE_SEQ_DIGITS = 3;

const ALLOWED_STATUS_CODES_CREATE = [
  'EMPLOYMENT_STATUS_DRAFT',
  'EMPLOYMENT_STATUS_UNDER_PROCEDURE',
  'EMPLOYMENT_STATUS_ACTIVE',
] as const;
const ALLOWED_STATUS_CODES_UPDATE = [
  'EMPLOYMENT_STATUS_DRAFT',
  'EMPLOYMENT_STATUS_UNDER_PROCEDURE',
  'EMPLOYMENT_STATUS_ACTIVE',
  'EMPLOYMENT_STATUS_DEACTIVATED',
  'EMPLOYMENT_STATUS_DESERTED',
] as const;

@Injectable()
export class HrEmploymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly payrollConfig: PayrollConfigService,
  ) {}

  async list(
    company_id: string,
    input: {
      q?: string;
      status_code?: string;
      platform?: string;
      has_assets?: string;
      page: number;
      page_size: number;
    },
  ) {
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
          status_code: true,
          salary_amount: true,
          salary_currency_code: true,
          target_type: true,
          target_deduction_type: true,
          monthly_orders_target: true,
          monthly_target_amount: true,
          day_work_hours: true,
          work_days: true,
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
    const [
      totalEmployees,
      employeesOnDuty,
      employeesOnboarding,
      employeesDeserted,
      employeesDeactivated,
    ] = await this.prisma.$transaction([
      // Total employees
      this.prisma.employmentRecord.count({
        where: {
          company_id,
          deleted_at: null,
        },
      }),
      // Employees on duty (active employees)
      this.prisma.employmentRecord.count({
        where: {
          company_id,
          deleted_at: null,
          status_code: 'EMPLOYMENT_STATUS_ACTIVE',
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
      // Employees deserted
      this.prisma.employmentRecord.count({
        where: {
          company_id,
          deleted_at: null,
          status_code: 'EMPLOYMENT_STATUS_DESERTED',
        },
      }),
      // Employees deactivated
      this.prisma.employmentRecord.count({
        where: {
          company_id,
          deleted_at: null,
          status_code: 'EMPLOYMENT_STATUS_DEACTIVATED',
        },
      }),
    ]);

    return {
      totalEmployees,
      employeesOnDuty,
      employeesOnboarding,
      employeesDeserted,
      employeesDeactivated,
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
        extra_documents: {
          orderBy: { sort_order: 'asc' },
        },
      },
    });
    if (!row) throw new NotFoundException();

    const { gte: monthStartRiyadh, lte: monthEndRiyadh } =
      this.getAsiaRiyadhCurrentMonthUtcBounds();

    const [auditRows, deductionChangeCandidates] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { company_id, entity_type: 'EMPLOYMENT_RECORD', entity_id: id },
        orderBy: { created_at: 'desc' },
        take: 500,
        select: {
          id: true,
          action: true,
          created_at: true,
          actor_user_id: true,
          actor_role: true,
        },
      }),
      this.prisma.auditLog.findMany({
        where: {
          company_id,
          entity_type: 'EMPLOYMENT_RECORD',
          entity_id: id,
          action: 'HR_EMPLOYMENT_UPDATE',
          created_at: { gte: monthStartRiyadh, lte: monthEndRiyadh },
        },
        select: { old_values: true, new_values: true },
      }),
    ]);

    const deduction_method_changed_this_month = deductionChangeCandidates.some(
      (log) => {
        const oldV = log.old_values as Record<string, unknown> | null;
        const newV = log.new_values as Record<string, unknown> | null;
        if (!oldV || !newV) return false;
        const a = oldV['target_deduction_type'];
        const b = newV['target_deduction_type'];
        const str = (v: unknown) =>
          v === null || v === undefined
            ? ''
            : typeof v === 'string' ||
                typeof v === 'number' ||
                typeof v === 'boolean' ||
                typeof v === 'bigint'
              ? String(v)
              : '';
        return str(a) !== str(b);
      },
    );

    const actorIds = [
      ...new Set(
        auditRows
          .map((l) => l.actor_user_id)
          .filter((x): x is string => typeof x === 'string' && x.length > 0),
      ),
    ];
    const users =
      actorIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: actorIds } },
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          })
        : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    const audit_logs = auditRows.map((log) => {
      const u = log.actor_user_id ? userById.get(log.actor_user_id) : undefined;
      return {
        id: log.id,
        action: log.action,
        created_at: log.created_at,
        actor_user_id: log.actor_user_id,
        actor_role: log.actor_role,
        actor_display:
          [u?.first_name, u?.last_name].filter(Boolean).join(' ').trim() ||
          u?.email ||
          null,
      };
    });

    return { ...row, audit_logs, deduction_method_changed_this_month };
  }

  /** Calendar month bounds in Asia/Riyadh, expressed as UTC `Date` for DB filtering. */
  private getAsiaRiyadhCurrentMonthUtcBounds(): { gte: Date; lte: Date } {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Riyadh',
      year: 'numeric',
      month: 'numeric',
    });
    const parts = fmt.formatToParts(now);
    const year = Number(parts.find((p) => p.type === 'year')?.value);
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    const pad = (n: number) => String(n).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    const gte = new Date(`${year}-${pad(month)}-01T00:00:00+03:00`);
    const lte = new Date(
      `${year}-${pad(month)}-${pad(lastDay)}T23:59:59.999+03:00`,
    );
    return { gte, lte };
  }

  /** Prefix from company name: 2 words → first letters; else first 2 chars. Uppercase A–Z only (fallback X). */
  private getCompanyCodePrefix(companyName: string): string {
    const trimmed = (companyName ?? '').trim().replace(/\s+/g, ' ');
    const words = trimmed ? trimmed.split(' ') : [];
    let a: string;
    let b: string;
    if (words.length >= 2) {
      a = words[0].charAt(0).toUpperCase();
      b = words[1].charAt(0).toUpperCase();
    } else {
      const s = trimmed.toUpperCase();
      a = s.charAt(0) || 'X';
      b = s.charAt(1) || 'X';
    }
    const safe = (c: string) => (/^[A-Z]$/.test(c) ? c : 'X');
    return safe(a) + safe(b);
  }

  /** Next per-company sequence value, formatted with EMPLOYEE_CODE_SEQ_DIGITS (e.g. "001"). */
  private async getNextEmployeeCodeSequence(
    company_id: string,
  ): Promise<string> {
    const counter = await this.prisma.usageCounter.upsert({
      where: {
        company_id_counter_code: {
          company_id,
          counter_code: 'EMPLOYEE_CODE_SEQ',
        },
      },
      update: { value: { increment: 1 } },
      create: { company_id, counter_code: 'EMPLOYEE_CODE_SEQ', value: 1 },
      select: { value: true },
    });
    return String(counter.value).padStart(EMPLOYEE_CODE_SEQ_DIGITS, '0');
  }

  /** Three random chars: A–Z (excl. I/O) and 1–9, uppercase. */
  private generateThreeRandomChars(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const nums = '123456789';
    const r = (set: string) =>
      set.charAt(Math.floor(Math.random() * set.length));
    return `${r(chars)}${r(nums)}${r(chars)}`;
  }

  /** Generate employee code: prefix + 3 random + 3 sequential digits (per company). */
  private async generateEmployeeCode(company_id: string): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { id: company_id },
      select: { name: true },
    });
    if (!company) throw new NotFoundException('Company not found');
    const prefix = this.getCompanyCodePrefix(company.name);
    const suffix = await this.getNextEmployeeCodeSequence(company_id);
    const random3 = this.generateThreeRandomChars();
    return prefix + random3 + suffix;
  }

  private async getUniqueEmployeeCode(company_id: string): Promise<string> {
    return this.generateEmployeeCode(company_id);
  }

  private async validateActiveStatus(company_id: string, data: any) {
    const now = new Date();

    // Step 1 (all except Avatar & Employee Code)
    if (!(data.full_name_ar?.trim?.() ?? ''))
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_FULL_NAME_AR');
    if (!(data.full_name_en?.trim?.() ?? ''))
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_FULL_NAME_EN');
    if (!(data.nationality?.trim?.() ?? ''))
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_NATIONALITY');
    const phone = (data.phone ?? '').toString().replace(/\D/g, '');
    if (phone.length !== 9)
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_PHONE_9_DIGITS');
    if (!data.date_of_birth)
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_DATE_OF_BIRTH');
    const hasSource =
      data.recruitment_candidate_id ||
      (data.employment_source && data.employment_source !== '');
    if (!hasSource)
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_SOURCE');

    // Step 2: Passport, Iqama, Contract
    if (!(data.passport_no?.trim?.() ?? ''))
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_PASSPORT_NO');
    if (!data.passport_expiry_at)
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_PASSPORT_EXPIRY');
    if (new Date(data.passport_expiry_at) <= now)
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_PASSPORT_EXPIRED');
    if (!data.passport_file_id)
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_PASSPORT_FILE');

    if (!(data.iqama_no?.trim?.() ?? ''))
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_IQAMA_NO');
    if (!data.iqama_expiry_at)
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_IQAMA_EXPIRY');
    if (new Date(data.iqama_expiry_at) <= now)
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_IQAMA_EXPIRED');
    if (!data.iqama_file_id)
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_IQAMA_FILE');

    if (!(data.contract_no?.trim?.() ?? ''))
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_CONTRACT_NO');
    if (!data.contract_end_at)
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_CONTRACT_END');
    if (new Date(data.contract_end_at) <= now)
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_CONTRACT_EXPIRED');
    if (!data.contract_file_id)
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_CONTRACT_FILE');

    // Step 3 (all except notes)
    if (!(data.assigned_platform?.trim?.() ?? ''))
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_PLATFORM');
    if (!(data.platform_user_no?.trim?.() ?? ''))
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_PLATFORM_USER_NO');
    if (data.salary_amount == null || Number(data.salary_amount) < 0)
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_SALARY');

    const config = await this.payrollConfig.getConfig(
      company_id,
      now.getFullYear(),
      now.getMonth() + 1,
    );
    const minSalary = config.minimum_salary ?? 0;
    if (Number(data.salary_amount) < minSalary) {
      throw new BadRequestException({
        error_code: 'HR_EMPLOYMENT_ACTIVE_SALARY_MIN',
        min: minSalary,
      });
    }

    // Validate target type and target value
    if (!data.target_type) {
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_TARGET_TYPE');
    }

    if (data.target_type === 'TARGET_TYPE_ORDERS') {
      if (data.monthly_orders_target == null) {
        throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_ORDERS_TARGET');
      }
    } else if (data.target_type === 'TARGET_TYPE_REVENUE') {
      if (data.monthly_target_amount == null) {
        throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_REVENUE_TARGET');
      }
    }

    // Validate target deduction type
    if (!data.target_deduction_type) {
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_DEDUCTION_TYPE');
    }

    // Validate consistency: revenue target → must use revenue tiers
    if (
      data.target_type === 'TARGET_TYPE_REVENUE' &&
      data.target_deduction_type !== 'DEDUCTION_REVENUE_TIERS'
    ) {
      throw new BadRequestException(
        'HR_EMPLOYMENT_REVENUE_REQUIRES_REVENUE_TIERS',
      );
    }

    // Validate consistency: orders target → cannot use revenue tiers
    if (
      data.target_type === 'TARGET_TYPE_ORDERS' &&
      data.target_deduction_type === 'DEDUCTION_REVENUE_TIERS'
    ) {
      throw new BadRequestException(
        'HR_EMPLOYMENT_ORDERS_CANNOT_USE_REVENUE_TIERS',
      );
    }

    if (!data.license_expiry_at)
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_LICENSE_EXPIRY');
    if (new Date(data.license_expiry_at) <= now)
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_LICENSE_EXPIRED');
    if (!data.license_file_id)
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_LICENSE_FILE');
    if (!data.promissory_note_file_id)
      throw new BadRequestException('HR_EMPLOYMENT_ACTIVE_PROMISSORY_NOTE');
  }

  async create(company_id: string, actor_user_id: string | null, data: any) {
    const dateFields = [
      'contract_end_at',
      'iqama_expiry_at',
      'passport_expiry_at',
      'date_of_birth',
      'license_expiry_at',
    ];
    for (const k of dateFields) {
      if (data[k] && isNaN(Date.parse(data[k]))) {
        throw new BadRequestException(`Invalid ${k}`);
      }
    }

    let statusCode: string;
    if (data.status_code != null) {
      if (!ALLOWED_STATUS_CODES_CREATE.includes(data.status_code)) {
        throw new BadRequestException(
          'Invalid status code. Allowed: Draft, In Progress, Active.',
        );
      }
      statusCode = data.status_code;
      if (statusCode === 'EMPLOYMENT_STATUS_ACTIVE') {
        await this.validateActiveStatus(company_id, data);
      }
    } else {
      try {
        await this.validateActiveStatus(company_id, data);
        statusCode = 'EMPLOYMENT_STATUS_ACTIVE';
      } catch {
        statusCode = 'EMPLOYMENT_STATUS_UNDER_PROCEDURE';
      }
    }

    const employee_code =
      data.employee_code || (await this.getUniqueEmployeeCode(company_id));
    const jobType = data.job_type ?? 'REPRESENTATIVE';

    const created = await this.prisma.employmentRecord.create({
      data: {
        company_id,
        created_by_user_id: actor_user_id ?? null,
        recruitment_candidate_id: data.recruitment_candidate_id ?? null,
        employee_no: data.employee_no ?? null,
        employee_code,
        full_name_ar: data.full_name_ar ?? null,
        full_name_en: data.full_name_en ?? null,
        nationality: data.nationality ?? null,
        phone: data.phone ?? null,
        date_of_birth: data.date_of_birth ? new Date(data.date_of_birth) : null,
        iqama_no: data.iqama_no ?? null,
        iqama_expiry_at: data.iqama_expiry_at
          ? new Date(data.iqama_expiry_at)
          : null,
        iqama_file_id: data.iqama_file_id ?? null,
        passport_no: data.passport_no ?? null,
        passport_expiry_at: data.passport_expiry_at
          ? new Date(data.passport_expiry_at)
          : null,
        passport_file_id: data.passport_file_id ?? null,
        contract_no: data.contract_no ?? null,
        contract_end_at: data.contract_end_at
          ? new Date(data.contract_end_at)
          : null,
        contract_file_id: data.contract_file_id ?? null,
        license_expiry_at: data.license_expiry_at
          ? new Date(data.license_expiry_at)
          : null,
        license_file_id: data.license_file_id ?? null,
        promissory_note_file_id: data.promissory_note_file_id ?? null,
        avatar_file_id: data.avatar_file_id ?? null,
        status_code: statusCode,
        employment_source: data.employment_source ?? null,
        salary_amount: data.salary_amount ?? null,
        salary_currency_code: data.salary_currency_code ?? 'SAR',
        assigned_platform: data.assigned_platform ?? null,
        platform_user_no: data.platform_user_no ?? null,
        job_type: jobType,
        target_type: data.target_type ?? null,
        target_deduction_type: data.target_deduction_type ?? null,
        monthly_orders_target: data.monthly_orders_target ?? null,
        monthly_target_amount: data.monthly_target_amount ?? null,
        day_work_hours: data.day_work_hours ?? 8,
        work_days:
          Array.isArray(data.work_days) && data.work_days.length > 0
            ? data.work_days
            : [
                'SATURDAY',
                'SUNDAY',
                'MONDAY',
                'TUESDAY',
                'WEDNESDAY',
                'THURSDAY',
              ],
      },
    });

    const extraDocs = Array.isArray(data.extra_documents)
      ? data.extra_documents.slice(0, 2)
      : [];
    for (let i = 0; i < extraDocs.length; i++) {
      const doc = extraDocs[i];
      await this.prisma.employmentDocument.create({
        data: {
          company_id,
          employment_record_id: created.id,
          document_name: doc.document_name || 'Document',
          expiry_at: doc.expiry_at ? new Date(doc.expiry_at) : null,
          file_id: doc.file_id ?? null,
          sort_order: i,
          created_by_user_id: actor_user_id ?? null,
        },
      });
    }

    await this.audit.log({
      company_id,
      actor_user_id: actor_user_id ?? null,
      action: 'HR_EMPLOYMENT_CREATE',
      entity_type: 'EMPLOYMENT_RECORD',
      entity_id: created.id,
      new_values: created,
    });

    // Placeholder notification: expiry soon
    if (created.iqama_expiry_at) {
      const days = Math.ceil(
        (created.iqama_expiry_at.getTime() - Date.now()) /
          (1000 * 60 * 60 * 24),
      );
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

  async update(
    company_id: string,
    actor_user_id: string,
    id: string,
    data: any,
  ) {
    const existing = await this.prisma.employmentRecord.findFirst({
      where: { id, company_id, deleted_at: null },
    });
    if (!existing) throw new NotFoundException();

    const merged = { ...existing, ...data };
    let resolvedStatus: string | undefined;
    if (data.status_code != null) {
      if (!ALLOWED_STATUS_CODES_UPDATE.includes(data.status_code)) {
        throw new BadRequestException(
          'Invalid status code. Allowed: Draft, In Progress, Active, Deactivated, Deserted.',
        );
      }
      resolvedStatus = data.status_code;
      if (
        resolvedStatus === 'EMPLOYMENT_STATUS_DRAFT' &&
        existing.status_code === 'EMPLOYMENT_STATUS_ACTIVE'
      ) {
        throw new BadRequestException('HR_EMPLOYMENT_005');
      }
      if (
        resolvedStatus === 'EMPLOYMENT_STATUS_DESERTED' &&
        existing.status_code === 'EMPLOYMENT_STATUS_ACTIVE'
      ) {
        throw new BadRequestException('HR_EMPLOYMENT_004');
      }
      if (
        resolvedStatus === 'EMPLOYMENT_STATUS_DEACTIVATED' &&
        existing.status_code !== 'EMPLOYMENT_STATUS_ACTIVE'
      ) {
        throw new BadRequestException(
          'HR_EMPLOYMENT_002: Only active employees can be deactivated.',
        );
      }
      if (
        existing.status_code === 'EMPLOYMENT_STATUS_ACTIVE' &&
        resolvedStatus !== 'EMPLOYMENT_STATUS_DEACTIVATED'
      ) {
        throw new BadRequestException(
          'HR_EMPLOYMENT_003: Active employees can only be deactivated.',
        );
      }
      if (resolvedStatus === 'EMPLOYMENT_STATUS_ACTIVE') {
        await this.validateActiveStatus(company_id, merged);
      }
    } else {
      try {
        await this.validateActiveStatus(company_id, merged);
        resolvedStatus = 'EMPLOYMENT_STATUS_ACTIVE';
      } catch {
        resolvedStatus = 'EMPLOYMENT_STATUS_UNDER_PROCEDURE';
      }
    }

    const updatePayload: any = {
      recruitment_candidate_id: data.recruitment_candidate_id ?? undefined,
      employee_no: data.employee_no ?? undefined,
      employee_code: data.employee_code ?? undefined,
      full_name_ar: data.full_name_ar ?? undefined,
      full_name_en: data.full_name_en ?? undefined,
      nationality: data.nationality ?? undefined,
      phone: data.phone ?? undefined,
      date_of_birth: data.date_of_birth
        ? new Date(data.date_of_birth)
        : undefined,
      iqama_no: data.iqama_no ?? undefined,
      iqama_expiry_at: data.iqama_expiry_at
        ? new Date(data.iqama_expiry_at)
        : undefined,
      iqama_file_id: data.iqama_file_id ?? undefined,
      passport_no: data.passport_no ?? undefined,
      passport_expiry_at: data.passport_expiry_at
        ? new Date(data.passport_expiry_at)
        : undefined,
      passport_file_id: data.passport_file_id ?? undefined,
      contract_no: data.contract_no ?? undefined,
      contract_end_at: data.contract_end_at
        ? new Date(data.contract_end_at)
        : undefined,
      contract_file_id: data.contract_file_id ?? undefined,
      license_expiry_at: data.license_expiry_at
        ? new Date(data.license_expiry_at)
        : undefined,
      license_file_id: data.license_file_id ?? undefined,
      promissory_note_file_id: data.promissory_note_file_id ?? undefined,
      avatar_file_id: data.avatar_file_id ?? undefined,
      status_code: resolvedStatus,
      employment_source: data.employment_source ?? undefined,
      salary_amount: data.salary_amount ?? undefined,
      salary_currency_code: data.salary_currency_code ?? undefined,
      assigned_platform: data.assigned_platform ?? undefined,
      platform_user_no: data.platform_user_no ?? undefined,
      job_type: data.job_type ?? undefined,
      target_type: data.target_type ?? undefined,
      target_deduction_type: data.target_deduction_type ?? undefined,
      monthly_orders_target: data.monthly_orders_target ?? undefined,
      monthly_target_amount: data.monthly_target_amount ?? undefined,
      day_work_hours: data.day_work_hours ?? undefined,
      work_days: data.work_days ?? undefined,
    };
    Object.keys(updatePayload).forEach((k) => {
      if (updatePayload[k] === undefined) delete updatePayload[k];
    });

    const updated = await this.prisma.employmentRecord.update({
      where: { id },
      data: updatePayload,
    });

    if (Array.isArray(data.extra_documents)) {
      await this.prisma.employmentDocument.deleteMany({
        where: { employment_record_id: id, company_id },
      });
      const extraDocs = data.extra_documents.slice(0, 2);
      for (let i = 0; i < extraDocs.length; i++) {
        const doc = extraDocs[i];
        await this.prisma.employmentDocument.create({
          data: {
            company_id,
            employment_record_id: id,
            document_name: doc.document_name || 'Document',
            expiry_at: doc.expiry_at ? new Date(doc.expiry_at) : null,
            file_id: doc.file_id ?? null,
            sort_order: i,
            created_by_user_id: actor_user_id,
          },
        });
      }
    }

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'HR_EMPLOYMENT_UPDATE',
      entity_type: 'EMPLOYMENT_RECORD',
      entity_id: updated.id,
      old_values: existing,
      new_values: updated,
    });

    return updated;
  }

  async remove(company_id: string, actor_user_id: string, id: string) {
    const existing = await this.prisma.employmentRecord.findFirst({
      where: { id, company_id, deleted_at: null },
    });
    if (!existing) throw new NotFoundException();
    if (existing.status_code === 'EMPLOYMENT_STATUS_ACTIVE') {
      throw new ForbiddenException(
        'HR_EMPLOYMENT_001: Cannot delete an active employee. Deactivate first.',
      );
    }

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

    return { ok: true };
  }
}
