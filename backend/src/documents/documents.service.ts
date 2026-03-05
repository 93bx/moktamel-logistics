import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

const TAB_VALUES = [
  'near_expiry',
  'employees',
  'company',
  'fleet',
  'recruitment',
  'other',
] as const;
export type DocumentTab = (typeof TAB_VALUES)[number];

export type DocumentStatus = 'active' | 'near_expiry' | 'expired' | 'no_expiry';

export type DocumentSourceType =
  | 'employment'
  | 'company'
  | 'fleet'
  | 'recruitment'
  | 'other';

export interface DocumentListItem {
  id: string;
  doc_name: string;
  source_type: DocumentSourceType;
  source_label: string;
  expiry_date: string | null;
  status: DocumentStatus;
  entity_type: string;
  entity_id: string;
  document_id: string;
  file_id: string | null;
  file_url?: string | null;
  employment_record_id?: string;
  vehicle_id?: string;
  recruitment_candidate_id?: string;
}

export interface DocumentsStats {
  expiringWithin5: number;
  expiringWithin25: number;
  expired: number;
  active: number;
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

function classifyExpiry(expiry: Date | null): DocumentStatus | null {
  if (!expiry) return null;
  const now = new Date();
  const d5 = addDays(now, 5);
  const d25 = addDays(now, 25);
  const d30 = addDays(now, 30);
  if (expiry < now) return 'expired';
  if (expiry <= d5) return 'near_expiry';
  if (expiry <= d25) return 'near_expiry';
  if (expiry > d30) return 'active';
  return 'near_expiry';
}

function buildId(parts: string[]): string {
  return parts.join(':');
}

function parseId(id: string): {
  source_type: string;
  entity_id: string;
  document_id: string;
  extra?: string;
} {
  const parts = id.split(':');
  if (parts.length < 3) throw new NotFoundException('DOCUMENTS_001');
  return {
    source_type: parts[0],
    entity_id: parts[1],
    document_id: parts[2],
    extra: parts[3],
  };
}

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getUserPermissions(
    user_id: string,
    company_id: string,
  ): Promise<Set<string>> {
    const rows = await this.prisma.userRole.findMany({
      where: { company_id, user_id },
      select: {
        role: {
          select: {
            role_permissions: {
              select: { permission: { select: { key: true } } },
            },
          },
        },
      },
    });
    const perms = new Set<string>();
    for (const r of rows) {
      for (const rp of r.role.role_permissions) {
        perms.add(rp.permission.key);
      }
    }
    return perms;
  }

  async getStats(
    company_id: string,
    userPermissionKeys: Set<string>,
  ): Promise<DocumentsStats> {
    const now = new Date();
    const d5 = addDays(now, 5);
    const d25 = addDays(now, 25);
    const d30 = addDays(now, 30);

    let expiringWithin5 = 0;
    let expiringWithin25 = 0;
    let expired = 0;
    let active = 0;

    const countBand = (expiry: Date) => {
      if (expiry < now) expired++;
      else if (expiry <= d5) expiringWithin5++;
      else if (expiry <= d25) expiringWithin25++;
      else if (expiry > d30) active++;
    };

    if (userPermissionKeys.has('HR_EMPLOYMENT_READ')) {
      const records = await this.prisma.employmentRecord.findMany({
        where: { company_id, deleted_at: null },
        select: {
          passport_expiry_at: true,
          passport_file_id: true,
          iqama_expiry_at: true,
          iqama_file_id: true,
          contract_end_at: true,
          contract_file_id: true,
          license_expiry_at: true,
          license_file_id: true,
        },
      });
      for (const r of records) {
        if (r.passport_expiry_at) countBand(r.passport_expiry_at);
        if (r.iqama_expiry_at) countBand(r.iqama_expiry_at);
        if (r.contract_end_at) countBand(r.contract_end_at);
        if (r.license_expiry_at) countBand(r.license_expiry_at);
      }
      const extraDocs = await this.prisma.employmentDocument.findMany({
        where: { company_id, expiry_at: { not: null } },
        select: { expiry_at: true },
      });
      for (const d of extraDocs) {
        if (d.expiry_at) countBand(d.expiry_at);
      }
    }

    if (userPermissionKeys.has('FLEET_READ')) {
      const docs = await this.prisma.vehicleDocument.findMany({
        where: { company_id },
        select: { expiry_date: true },
      });
      for (const d of docs) {
        countBand(d.expiry_date);
      }
    }

    if (userPermissionKeys.has('HR_RECRUITMENT_READ')) {
      const links = await this.prisma.fileLink.findMany({
        where: {
          company_id,
          entity_type: 'RECRUITMENT_CANDIDATE',
          purpose_code: 'PASSPORT_IMAGE',
        },
        select: { entity_id: true },
      });
      const candidateIds = [...new Set(links.map((l) => l.entity_id))];
      if (candidateIds.length > 0) {
        const candidates = await this.prisma.recruitmentCandidate.findMany({
          where: {
            company_id,
            id: { in: candidateIds },
            deleted_at: null,
            passport_expiry_at: { not: null },
          },
          select: { passport_expiry_at: true },
        });
        for (const c of candidates) {
          if (c.passport_expiry_at) countBand(c.passport_expiry_at);
        }
      }
    }

    return { expiringWithin5, expiringWithin25, expired, active };
  }

  private statusFromExpiry(expiry: Date | null): DocumentStatus {
    if (!expiry) return 'no_expiry';
    const s = classifyExpiry(expiry);
    return s ?? 'no_expiry';
  }

  private applyQFilter<T extends { doc_name: string; source_label: string }>(
    items: T[],
    q?: string,
  ): T[] {
    if (!q || !q.trim()) return items;
    const lower = q.toLowerCase();
    return items.filter(
      (i) =>
        i.doc_name.toLowerCase().includes(lower) ||
        i.source_label.toLowerCase().includes(lower),
    );
  }

  async list(
    company_id: string,
    userPermissionKeys: Set<string>,
    input: { tab: string; page: number; page_size: number; q?: string },
  ): Promise<{
    items: DocumentListItem[];
    total: number;
    page: number;
    page_size: number;
  }> {
    const tab = TAB_VALUES.includes(input.tab as DocumentTab)
      ? (input.tab as DocumentTab)
      : 'near_expiry';
    const { page, page_size, q } = input;

    let allItems: DocumentListItem[] = [];

    if (tab === 'employees' && userPermissionKeys.has('HR_EMPLOYMENT_READ')) {
      const records = await this.prisma.employmentRecord.findMany({
        where: { company_id, deleted_at: null },
        select: {
          id: true,
          full_name_ar: true,
          full_name_en: true,
          passport_expiry_at: true,
          passport_file_id: true,
          iqama_expiry_at: true,
          iqama_file_id: true,
          contract_end_at: true,
          contract_file_id: true,
          license_expiry_at: true,
          license_file_id: true,
          promissory_note_file_id: true,
          extra_documents: {
            select: {
              id: true,
              document_name: true,
              expiry_at: true,
              file_id: true,
            },
          },
        },
      });
      const sourceLabel = (r: {
        full_name_ar: string | null;
        full_name_en: string | null;
      }) => r.full_name_en || r.full_name_ar || '-';
      for (const r of records) {
        const label = sourceLabel(r);
        if (r.passport_expiry_at != null || r.passport_file_id) {
          allItems.push({
            id: buildId(['employment', r.id, 'passport']),
            doc_name: 'Passport',
            source_type: 'employment',
            source_label: label,
            expiry_date: r.passport_expiry_at?.toISOString() ?? null,
            status: this.statusFromExpiry(r.passport_expiry_at),
            entity_type: 'EMPLOYMENT_RECORD',
            entity_id: r.id,
            document_id: 'passport',
            file_id: r.passport_file_id,
            employment_record_id: r.id,
          });
        }
        if (r.iqama_expiry_at != null || r.iqama_file_id) {
          allItems.push({
            id: buildId(['employment', r.id, 'iqama']),
            doc_name: 'Iqama',
            source_type: 'employment',
            source_label: label,
            expiry_date: r.iqama_expiry_at?.toISOString() ?? null,
            status: this.statusFromExpiry(r.iqama_expiry_at),
            entity_type: 'EMPLOYMENT_RECORD',
            entity_id: r.id,
            document_id: 'iqama',
            file_id: r.iqama_file_id,
            employment_record_id: r.id,
          });
        }
        if (r.contract_end_at != null || r.contract_file_id) {
          allItems.push({
            id: buildId(['employment', r.id, 'contract']),
            doc_name: 'Contract',
            source_type: 'employment',
            source_label: label,
            expiry_date: r.contract_end_at?.toISOString() ?? null,
            status: this.statusFromExpiry(r.contract_end_at),
            entity_type: 'EMPLOYMENT_RECORD',
            entity_id: r.id,
            document_id: 'contract',
            file_id: r.contract_file_id,
            employment_record_id: r.id,
          });
        }
        if (r.license_expiry_at != null || r.license_file_id) {
          allItems.push({
            id: buildId(['employment', r.id, 'license']),
            doc_name: 'License',
            source_type: 'employment',
            source_label: label,
            expiry_date: r.license_expiry_at?.toISOString() ?? null,
            status: this.statusFromExpiry(r.license_expiry_at),
            entity_type: 'EMPLOYMENT_RECORD',
            entity_id: r.id,
            document_id: 'license',
            file_id: r.license_file_id,
            employment_record_id: r.id,
          });
        }
        if (r.promissory_note_file_id) {
          allItems.push({
            id: buildId(['employment', r.id, 'promissory']),
            doc_name: 'Promissory Note',
            source_type: 'employment',
            source_label: label,
            expiry_date: null,
            status: 'no_expiry',
            entity_type: 'EMPLOYMENT_RECORD',
            entity_id: r.id,
            document_id: 'promissory',
            file_id: r.promissory_note_file_id,
            employment_record_id: r.id,
          });
        }
        for (const ed of r.extra_documents) {
          allItems.push({
            id: buildId(['employment', r.id, 'extra', ed.id]),
            doc_name: ed.document_name,
            source_type: 'employment',
            source_label: label,
            expiry_date: ed.expiry_at?.toISOString() ?? null,
            status: this.statusFromExpiry(ed.expiry_at),
            entity_type: 'EMPLOYMENT_DOCUMENT',
            entity_id: r.id,
            document_id: ed.id,
            file_id: ed.file_id,
            employment_record_id: r.id,
          });
        }
      }
    }

    if (tab === 'fleet' && userPermissionKeys.has('FLEET_READ')) {
      const docs = await this.prisma.vehicleDocument.findMany({
        where: { company_id },
        include: { vehicle: { select: { license_plate: true } } },
      });
      const typeNames: Record<string, string> = {
        REGISTRATION: 'Registration',
        INSURANCE: 'Insurance',
        CHECKUP: 'Checkup',
        OPERATING_CARD: 'Operating Card',
      };
      for (const d of docs) {
        allItems.push({
          id: buildId(['fleet', d.vehicle_id, d.id]),
          doc_name: typeNames[d.type_code] ?? d.type_code,
          source_type: 'fleet',
          source_label: d.vehicle.license_plate,
          expiry_date: d.expiry_date.toISOString(),
          status: this.statusFromExpiry(d.expiry_date),
          entity_type: 'VEHICLE_DOCUMENT',
          entity_id: d.vehicle_id,
          document_id: d.id,
          file_id: d.file_id,
          vehicle_id: d.vehicle_id,
        });
      }
    }

    if (
      tab === 'recruitment' &&
      userPermissionKeys.has('HR_RECRUITMENT_READ')
    ) {
      const links = await this.prisma.fileLink.findMany({
        where: { company_id, entity_type: 'RECRUITMENT_CANDIDATE' },
        select: {
          id: true,
          entity_id: true,
          purpose_code: true,
          file_id: true,
        },
      });
      const candidateIds = [...new Set(links.map((l) => l.entity_id))];
      const candidates =
        candidateIds.length > 0
          ? await this.prisma.recruitmentCandidate.findMany({
              where: { company_id, id: { in: candidateIds }, deleted_at: null },
              select: {
                id: true,
                full_name_ar: true,
                full_name_en: true,
                passport_expiry_at: true,
                visa_deadline_at: true,
              },
            })
          : [];
      const candidateMap = new Map(candidates.map((c) => [c.id, c]));
      const purposeNames: Record<string, string> = {
        PASSPORT_IMAGE: 'Passport',
        VISA_IMAGE: 'Visa',
        FLIGHT_TICKET_IMAGE: 'Flight Ticket',
        PERSONAL_PICTURE: 'Personal Picture',
      };
      for (const link of links) {
        const c = candidateMap.get(link.entity_id);
        if (!c) continue;
        const label = c.full_name_en || c.full_name_ar || '-';
        let expiry: Date | null = null;
        if (link.purpose_code === 'PASSPORT_IMAGE')
          expiry = c.passport_expiry_at;
        else if (link.purpose_code === 'VISA_IMAGE')
          expiry = c.visa_deadline_at ?? null;
        allItems.push({
          id: buildId(['recruitment', link.entity_id, link.id]),
          doc_name: purposeNames[link.purpose_code] ?? link.purpose_code,
          source_type: 'recruitment',
          source_label: label,
          expiry_date: expiry?.toISOString() ?? null,
          status: this.statusFromExpiry(expiry),
          entity_type: 'RECRUITMENT_CANDIDATE',
          entity_id: link.entity_id,
          document_id: link.id,
          file_id: link.file_id,
          recruitment_candidate_id: link.entity_id,
        });
      }
    }

    if (tab === 'company') {
      if (userPermissionKeys.has('PAYROLL_VIEW')) {
        const payrollDocs = await this.prisma.payrollDocument.findMany({
          where: { company_id },
          select: {
            id: true,
            document_type: true,
            month: true,
            file_url: true,
          },
        });
        for (const p of payrollDocs) {
          const name = `${p.document_type} ${p.month.toISOString().slice(0, 7)}`;
          allItems.push({
            id: buildId(['company', 'payroll', p.id]),
            doc_name: name,
            source_type: 'company',
            source_label: 'Salaries & Payroll',
            expiry_date: null,
            status: 'no_expiry',
            entity_type: 'PAYROLL_DOCUMENT',
            entity_id: p.id,
            document_id: p.id,
            file_id: null,
            file_url: p.file_url,
          });
        }
      }
      if (userPermissionKeys.has('FIN_CASH_LOANS_READ')) {
        const expenses = await this.prisma.handoverExpense.findMany({
          where: { company_id, receipt_file_id: { not: null } },
          select: { id: true, statement: true, receipt_file_id: true },
        });
        for (const e of expenses) {
          if (!e.receipt_file_id) continue;
          allItems.push({
            id: buildId(['company', 'handover', e.id]),
            doc_name: e.statement,
            source_type: 'company',
            source_label: 'Cash & Loans',
            expiry_date: null,
            status: 'no_expiry',
            entity_type: 'HANDOVER_EXPENSE',
            entity_id: e.id,
            document_id: e.id,
            file_id: e.receipt_file_id,
          });
        }
      }
    }

    if (tab === 'other') {
      if (userPermissionKeys.has('HR_ASSETS_READ')) {
        const assignments = await this.prisma.assetAssignment.findMany({
          where: { company_id, asset_image_file_id: { not: null } },
          include: {
            asset: { select: { name: true } },
            employment_record: {
              select: { full_name_ar: true, full_name_en: true },
            },
          },
        });
        for (const a of assignments) {
          if (!a.asset_image_file_id) continue;
          const label =
            a.employment_record?.full_name_en ||
            a.employment_record?.full_name_ar ||
            a.asset.name;
          allItems.push({
            id: buildId(['other', 'asset', a.id]),
            doc_name: `Asset: ${a.asset.name}`,
            source_type: 'other',
            source_label: label,
            expiry_date: null,
            status: 'no_expiry',
            entity_type: 'ASSET_ASSIGNMENT',
            entity_id: a.id,
            document_id: a.id,
            file_id: a.asset_image_file_id,
          });
        }
      }
      if (userPermissionKeys.has('FIN_CASH_LOANS_READ')) {
        const txns = await this.prisma.cashTransaction.findMany({
          where: { company_id, attachment_file_id: { not: null } },
          include: {
            employment_record: {
              select: { full_name_ar: true, full_name_en: true },
            },
          },
        });
        for (const t of txns) {
          if (!t.attachment_file_id) continue;
          const label =
            t.employment_record?.full_name_en ||
            t.employment_record?.full_name_ar ||
            'Cash transaction';
          allItems.push({
            id: buildId(['other', 'cash', t.id]),
            doc_name: 'Cash receipt',
            source_type: 'other',
            source_label: label,
            expiry_date: null,
            status: 'no_expiry',
            entity_type: 'CASH_TRANSACTION',
            entity_id: t.id,
            document_id: t.id,
            file_id: t.attachment_file_id,
          });
        }
      }
      if (
        userPermissionKeys.has('FLEET_READ') ||
        userPermissionKeys.has('FLEET_MAINTENANCE')
      ) {
        const maintenances = await this.prisma.vehicleMaintenance.findMany({
          where: { company_id, invoice_file_id: { not: null } },
          include: { vehicle: { select: { license_plate: true } } },
        });
        for (const m of maintenances) {
          if (!m.invoice_file_id) continue;
          allItems.push({
            id: buildId(['other', 'maintenance', m.id]),
            doc_name: 'Maintenance invoice',
            source_type: 'other',
            source_label: m.vehicle.license_plate,
            expiry_date: null,
            status: 'no_expiry',
            entity_type: 'VEHICLE_MAINTENANCE',
            entity_id: m.id,
            document_id: m.id,
            file_id: m.invoice_file_id,
          });
        }
      }
      if (userPermissionKeys.has('FLEET_GAS')) {
        const gasRecords = await this.prisma.vehicleGasRecord.findMany({
          where: { company_id, invoice_file_id: { not: null } },
          include: { vehicle: { select: { license_plate: true } } },
        });
        for (const g of gasRecords) {
          if (!g.invoice_file_id) continue;
          allItems.push({
            id: buildId(['other', 'gas', g.id]),
            doc_name: 'Gas invoice',
            source_type: 'other',
            source_label: g.vehicle.license_plate,
            expiry_date: null,
            status: 'no_expiry',
            entity_type: 'VEHICLE_GAS_RECORD',
            entity_id: g.id,
            document_id: g.id,
            file_id: g.invoice_file_id,
          });
        }
      }
    }

    if (tab === 'near_expiry') {
      const now = new Date();
      const d30 = addDays(now, 30);
      const empItems = userPermissionKeys.has('HR_EMPLOYMENT_READ')
        ? await this.getNearExpiryEmployment(company_id)
        : [];
      const fleetItems = userPermissionKeys.has('FLEET_READ')
        ? await this.getNearExpiryFleet(company_id)
        : [];
      const recItems = userPermissionKeys.has('HR_RECRUITMENT_READ')
        ? await this.getNearExpiryRecruitment(company_id)
        : [];
      allItems = [...empItems, ...fleetItems, ...recItems].filter((i) => {
        if (!i.expiry_date) return false;
        const exp = new Date(i.expiry_date);
        return exp > now && exp <= d30;
      });
    }

    allItems = this.applyQFilter(allItems, q);

    if (tab === 'near_expiry') {
      allItems.sort((a, b) => {
        const da = a.expiry_date ? new Date(a.expiry_date).getTime() : 0;
        const db = b.expiry_date ? new Date(b.expiry_date).getTime() : 0;
        return da - db;
      });
    }

    const total = allItems.length;
    const start = (page - 1) * page_size;
    const items = allItems.slice(start, start + page_size);

    return { items, total, page, page_size };
  }

  private async getNearExpiryEmployment(
    company_id: string,
  ): Promise<DocumentListItem[]> {
    const records = await this.prisma.employmentRecord.findMany({
      where: { company_id, deleted_at: null },
      select: {
        id: true,
        full_name_ar: true,
        full_name_en: true,
        passport_expiry_at: true,
        passport_file_id: true,
        iqama_expiry_at: true,
        iqama_file_id: true,
        contract_end_at: true,
        contract_file_id: true,
        license_expiry_at: true,
        license_file_id: true,
        extra_documents: {
          select: {
            id: true,
            document_name: true,
            expiry_at: true,
            file_id: true,
          },
        },
      },
    });
    const items: DocumentListItem[] = [];
    const label = (r: {
      full_name_ar: string | null;
      full_name_en: string | null;
    }) => r.full_name_en || r.full_name_ar || '-';
    for (const r of records) {
      const sl = label(r);
      const fields: {
        key: string;
        name: string;
        expiry: Date | null;
        file_id: string | null;
      }[] = [
        {
          key: 'passport',
          name: 'Passport',
          expiry: r.passport_expiry_at,
          file_id: r.passport_file_id,
        },
        {
          key: 'iqama',
          name: 'Iqama',
          expiry: r.iqama_expiry_at,
          file_id: r.iqama_file_id,
        },
        {
          key: 'contract',
          name: 'Contract',
          expiry: r.contract_end_at,
          file_id: r.contract_file_id,
        },
        {
          key: 'license',
          name: 'License',
          expiry: r.license_expiry_at,
          file_id: r.license_file_id,
        },
      ];
      for (const f of fields) {
        if (f.expiry) {
          items.push({
            id: buildId(['employment', r.id, f.key]),
            doc_name: f.name,
            source_type: 'employment',
            source_label: sl,
            expiry_date: f.expiry.toISOString(),
            status: this.statusFromExpiry(f.expiry),
            entity_type: 'EMPLOYMENT_RECORD',
            entity_id: r.id,
            document_id: f.key,
            file_id: f.file_id,
            employment_record_id: r.id,
          });
        }
      }
      for (const ed of r.extra_documents) {
        if (ed.expiry_at) {
          items.push({
            id: buildId(['employment', r.id, 'extra', ed.id]),
            doc_name: ed.document_name,
            source_type: 'employment',
            source_label: sl,
            expiry_date: ed.expiry_at.toISOString(),
            status: this.statusFromExpiry(ed.expiry_at),
            entity_type: 'EMPLOYMENT_DOCUMENT',
            entity_id: r.id,
            document_id: ed.id,
            file_id: ed.file_id,
            employment_record_id: r.id,
          });
        }
      }
    }
    return items;
  }

  private async getNearExpiryFleet(
    company_id: string,
  ): Promise<DocumentListItem[]> {
    const docs = await this.prisma.vehicleDocument.findMany({
      where: { company_id },
      include: { vehicle: { select: { license_plate: true } } },
    });
    const typeNames: Record<string, string> = {
      REGISTRATION: 'Registration',
      INSURANCE: 'Insurance',
      CHECKUP: 'Checkup',
      OPERATING_CARD: 'Operating Card',
    };
    return docs.map((d) => ({
      id: buildId(['fleet', d.vehicle_id, d.id]),
      doc_name: typeNames[d.type_code] ?? d.type_code,
      source_type: 'fleet' as const,
      source_label: d.vehicle.license_plate,
      expiry_date: d.expiry_date.toISOString(),
      status: this.statusFromExpiry(d.expiry_date),
      entity_type: 'VEHICLE_DOCUMENT',
      entity_id: d.vehicle_id,
      document_id: d.id,
      file_id: d.file_id,
      vehicle_id: d.vehicle_id,
    }));
  }

  private async getNearExpiryRecruitment(
    company_id: string,
  ): Promise<DocumentListItem[]> {
    const links = await this.prisma.fileLink.findMany({
      where: { company_id, entity_type: 'RECRUITMENT_CANDIDATE' },
      select: { id: true, entity_id: true, purpose_code: true, file_id: true },
    });
    const candidateIds = [...new Set(links.map((l) => l.entity_id))];
    const candidates =
      candidateIds.length > 0
        ? await this.prisma.recruitmentCandidate.findMany({
            where: { company_id, id: { in: candidateIds }, deleted_at: null },
            select: {
              id: true,
              full_name_ar: true,
              full_name_en: true,
              passport_expiry_at: true,
              visa_deadline_at: true,
            },
          })
        : [];
    const candidateMap = new Map(candidates.map((c) => [c.id, c]));
    const purposeNames: Record<string, string> = {
      PASSPORT_IMAGE: 'Passport',
      VISA_IMAGE: 'Visa',
    };
    const items: DocumentListItem[] = [];
    for (const link of links) {
      const c = candidateMap.get(link.entity_id);
      if (!c) continue;
      let expiry: Date | null = null;
      if (link.purpose_code === 'PASSPORT_IMAGE') expiry = c.passport_expiry_at;
      else if (link.purpose_code === 'VISA_IMAGE')
        expiry = c.visa_deadline_at ?? null;
      if (!expiry) continue;
      items.push({
        id: buildId(['recruitment', link.entity_id, link.id]),
        doc_name: purposeNames[link.purpose_code] ?? link.purpose_code,
        source_type: 'recruitment',
        source_label: c.full_name_en || c.full_name_ar || '-',
        expiry_date: expiry.toISOString(),
        status: this.statusFromExpiry(expiry),
        entity_type: 'RECRUITMENT_CANDIDATE',
        entity_id: link.entity_id,
        document_id: link.id,
        file_id: link.file_id,
        recruitment_candidate_id: link.entity_id,
      });
    }
    return items;
  }

  async deleteDocument(
    company_id: string,
    user_id: string,
    userPermissionKeys: Set<string>,
    compositeId: string,
  ): Promise<void> {
    const { source_type, entity_id, document_id, extra } = parseId(compositeId);

    const requirePerm = (perm: string) => {
      if (!userPermissionKeys.has(perm))
        throw new ForbiddenException('DOCUMENTS_002');
    };

    if (source_type === 'employment') {
      requirePerm('HR_EMPLOYMENT_UPDATE');
      const record = await this.prisma.employmentRecord.findFirst({
        where: { id: entity_id, company_id },
        select: {
          id: true,
          passport_file_id: true,
          iqama_file_id: true,
          contract_file_id: true,
          license_file_id: true,
          promissory_note_file_id: true,
          extra_documents: { select: { id: true, file_id: true } },
        },
      });
      if (!record) throw new NotFoundException('DOCUMENTS_001');

      if (document_id === 'extra' && extra) {
        const ed = record.extra_documents.find((d) => d.id === extra);
        if (!ed) throw new NotFoundException('DOCUMENTS_001');
        const fileId = ed.file_id;
        await this.prisma.employmentDocument.update({
          where: { id: extra },
          data: { file_id: null },
        });
        if (fileId) {
          await this.prisma.fileObject.updateMany({
            where: { id: fileId, company_id },
            data: { deleted_at: new Date() },
          });
        }
        await this.audit.log({
          company_id,
          actor_user_id: user_id,
          action: 'DOCUMENTS_FILE_SOFT_DELETED',
          entity_type: 'EMPLOYMENT_DOCUMENT',
          entity_id: extra,
          old_values: { file_id: fileId },
        });
        return;
      }

      const fieldMap: Record<
        string,
        | 'passport_file_id'
        | 'iqama_file_id'
        | 'contract_file_id'
        | 'license_file_id'
        | 'promissory_note_file_id'
      > = {
        passport: 'passport_file_id',
        iqama: 'iqama_file_id',
        contract: 'contract_file_id',
        license: 'license_file_id',
        promissory: 'promissory_note_file_id',
      };
      const field = fieldMap[document_id];
      if (!field) throw new NotFoundException('DOCUMENTS_001');
      const fileId = record[field];
      if (fileId) {
        await this.prisma.fileObject.updateMany({
          where: { id: fileId, company_id },
          data: { deleted_at: new Date() },
        });
      }
      await this.prisma.employmentRecord.update({
        where: { id: entity_id },
        data: { [field]: null },
      });
      await this.audit.log({
        company_id,
        actor_user_id: user_id,
        action: 'DOCUMENTS_FILE_SOFT_DELETED',
        entity_type: 'EMPLOYMENT_RECORD',
        entity_id,
        old_values: { [field]: fileId },
      });
      return;
    }

    if (source_type === 'fleet') {
      requirePerm('FLEET_UPDATE');
      const vdoc = await this.prisma.vehicleDocument.findFirst({
        where: { id: document_id, vehicle_id: entity_id, company_id },
      });
      if (!vdoc) throw new NotFoundException('DOCUMENTS_001');
      if (vdoc.file_id) {
        await this.prisma.fileObject.updateMany({
          where: { id: vdoc.file_id, company_id },
          data: { deleted_at: new Date() },
        });
      }
      await this.prisma.vehicleDocument.update({
        where: { id: document_id },
        data: { file_id: null },
      });
      await this.audit.log({
        company_id,
        actor_user_id: user_id,
        action: 'DOCUMENTS_FILE_SOFT_DELETED',
        entity_type: 'VEHICLE_DOCUMENT',
        entity_id: document_id,
        old_values: { file_id: vdoc.file_id },
      });
      return;
    }

    if (source_type === 'recruitment') {
      requirePerm('HR_RECRUITMENT_UPDATE');
      const link = await this.prisma.fileLink.findFirst({
        where: {
          id: document_id,
          entity_id,
          entity_type: 'RECRUITMENT_CANDIDATE',
          company_id,
        },
      });
      if (!link) throw new NotFoundException('DOCUMENTS_001');
      await this.prisma.fileObject.updateMany({
        where: { id: link.file_id, company_id },
        data: { deleted_at: new Date() },
      });
      await this.prisma.fileLink.delete({ where: { id: document_id } });
      await this.audit.log({
        company_id,
        actor_user_id: user_id,
        action: 'DOCUMENTS_FILE_SOFT_DELETED',
        entity_type: 'FILE_LINK',
        entity_id: document_id,
        old_values: { file_id: link.file_id },
      });
      return;
    }

    if (source_type === 'company') {
      if (entity_id === 'payroll') {
        requirePerm('PAYROLL_EDIT');
        const pd = await this.prisma.payrollDocument.findFirst({
          where: { id: document_id, company_id },
        });
        if (!pd) throw new NotFoundException('DOCUMENTS_001');
        await this.prisma.payrollDocument.update({
          where: { id: document_id },
          data: { file_url: '' },
        });
        await this.audit.log({
          company_id,
          actor_user_id: user_id,
          action: 'DOCUMENTS_FILE_SOFT_DELETED',
          entity_type: 'PAYROLL_DOCUMENT',
          entity_id: document_id,
          old_values: { file_url: pd.file_url },
        });
        return;
      }
      if (entity_id === 'handover') {
        requirePerm('FIN_CASH_LOANS_MANAGE');
        const exp = await this.prisma.handoverExpense.findFirst({
          where: { id: document_id, company_id },
        });
        if (!exp || !exp.receipt_file_id)
          throw new NotFoundException('DOCUMENTS_001');
        const fid = exp.receipt_file_id;
        await this.prisma.fileObject.updateMany({
          where: { id: fid, company_id },
          data: { deleted_at: new Date() },
        });
        await this.prisma.handoverExpense.update({
          where: { id: document_id },
          data: { receipt_file_id: null },
        });
        await this.audit.log({
          company_id,
          actor_user_id: user_id,
          action: 'DOCUMENTS_FILE_SOFT_DELETED',
          entity_type: 'HANDOVER_EXPENSE',
          entity_id: document_id,
          old_values: { receipt_file_id: fid },
        });
        return;
      }
    }

    if (source_type === 'other') {
      if (entity_id === 'asset') {
        requirePerm('HR_ASSETS_UPDATE');
        const a = await this.prisma.assetAssignment.findFirst({
          where: { id: document_id, company_id },
        });
        if (!a || !a.asset_image_file_id)
          throw new NotFoundException('DOCUMENTS_001');
        const fid = a.asset_image_file_id;
        await this.prisma.fileObject.updateMany({
          where: { id: fid, company_id },
          data: { deleted_at: new Date() },
        });
        await this.prisma.assetAssignment.update({
          where: { id: document_id },
          data: { asset_image_file_id: null },
        });
        await this.audit.log({
          company_id,
          actor_user_id: user_id,
          action: 'DOCUMENTS_FILE_SOFT_DELETED',
          entity_type: 'ASSET_ASSIGNMENT',
          entity_id: document_id,
          old_values: { asset_image_file_id: fid },
        });
        return;
      }
      if (entity_id === 'cash') {
        requirePerm('FIN_CASH_LOANS_MANAGE');
        const t = await this.prisma.cashTransaction.findFirst({
          where: { id: document_id, company_id },
        });
        if (!t || !t.attachment_file_id)
          throw new NotFoundException('DOCUMENTS_001');
        const fid = t.attachment_file_id;
        await this.prisma.fileObject.updateMany({
          where: { id: fid, company_id },
          data: { deleted_at: new Date() },
        });
        await this.prisma.cashTransaction.update({
          where: { id: document_id },
          data: { attachment_file_id: null },
        });
        await this.audit.log({
          company_id,
          actor_user_id: user_id,
          action: 'DOCUMENTS_FILE_SOFT_DELETED',
          entity_type: 'CASH_TRANSACTION',
          entity_id: document_id,
          old_values: { attachment_file_id: fid },
        });
        return;
      }
      if (entity_id === 'maintenance') {
        requirePerm('FLEET_MAINTENANCE');
        const m = await this.prisma.vehicleMaintenance.findFirst({
          where: { id: document_id, company_id },
        });
        if (!m || !m.invoice_file_id)
          throw new NotFoundException('DOCUMENTS_001');
        const fid = m.invoice_file_id;
        await this.prisma.fileObject.updateMany({
          where: { id: fid, company_id },
          data: { deleted_at: new Date() },
        });
        await this.prisma.vehicleMaintenance.update({
          where: { id: document_id },
          data: { invoice_file_id: null },
        });
        await this.audit.log({
          company_id,
          actor_user_id: user_id,
          action: 'DOCUMENTS_FILE_SOFT_DELETED',
          entity_type: 'VEHICLE_MAINTENANCE',
          entity_id: document_id,
          old_values: { invoice_file_id: fid },
        });
        return;
      }
      if (entity_id === 'gas') {
        requirePerm('FLEET_GAS');
        const g = await this.prisma.vehicleGasRecord.findFirst({
          where: { id: document_id, company_id },
        });
        if (!g || !g.invoice_file_id)
          throw new NotFoundException('DOCUMENTS_001');
        const fid = g.invoice_file_id;
        await this.prisma.fileObject.updateMany({
          where: { id: fid, company_id },
          data: { deleted_at: new Date() },
        });
        await this.prisma.vehicleGasRecord.update({
          where: { id: document_id },
          data: { invoice_file_id: null },
        });
        await this.audit.log({
          company_id,
          actor_user_id: user_id,
          action: 'DOCUMENTS_FILE_SOFT_DELETED',
          entity_type: 'VEHICLE_GAS_RECORD',
          entity_id: document_id,
          old_values: { invoice_file_id: fid },
        });
        return;
      }
    }

    throw new NotFoundException('DOCUMENTS_001');
  }
}
