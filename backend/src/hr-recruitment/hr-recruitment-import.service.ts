import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FilesService } from '../files/files.service';
import { HrRecruitmentService } from './hr-recruitment.service';
import { RECRUITMENT_STATUS } from './recruitment.constants';
import {
  RECRUITMENT_EXPORT_COLUMN_KEYS,
  RECRUITMENT_IMPORT_CHUNK_SIZE,
  RECRUITMENT_IMPORT_COLUMN_KEYS,
  RECRUITMENT_IMPORT_MAX_ROWS,
  type RecruitmentImportColumnKey,
} from './recruitment-import.constants';
import {
  HR_RECRUITMENT_IMPORT_ERROR,
  parseDateOnlyToIsoUtc,
  type CellError,
} from './recruitment-import.validation';
import {
  validateNormalizedImportRow,
  optionalDateCell,
  type NormalizedImportRow,
} from './recruitment-import.row-validator';
import {
  buildExportWorkbook,
  buildTemplateWorkbook,
  cellToString,
  parseImportWorksheet,
} from './recruitment-import.excel';
import {
  formatExportStatusValue,
  getExportColumnHeaders,
} from './recruitment-export.i18n';
import { getTemplateInstructions } from './recruitment-import.i18n';
import { fetchHttpsImageToBuffer } from './recruitment-import-url-fetch';
import { z } from 'zod';

const MAX_IMPORT_BYTES = 1 * 1024 * 1024;

function fillImportCells(
  values: Record<string, string>,
): Record<RecruitmentImportColumnKey, string> {
  const out = {} as Record<RecruitmentImportColumnKey, string>;
  for (const k of RECRUITMENT_IMPORT_COLUMN_KEYS) {
    out[k] = values[k] ?? '';
  }
  return out;
}

const ValidateRowsJsonSchema = z.object({
  rows: z
    .array(
      z.object({
        row_index: z.number().int().min(0),
        cells: z.record(z.string(), z.string()),
      }),
    )
    .min(1)
    .max(RECRUITMENT_IMPORT_MAX_ROWS),
});

const ImportCommitRowSchema = z.object({
  row_index: z.number().int().min(0),
  status_code: z.enum([
    RECRUITMENT_STATUS.DRAFT,
    RECRUITMENT_STATUS.UNDER_PROCEDURE,
  ]),
  full_name_ar: z.string().optional().default(''),
  full_name_en: z.string().optional().default(''),
  nationality: z.string().optional().default(''),
  passport_no: z.string().optional().default(''),
  passport_expiry_at: z.string().nullable().optional(),
  responsible_office: z.string().optional().default(''),
  responsible_office_number: z.string().nullable().optional(),
  visa_deadline_at: z.string().nullable().optional(),
  visa_sent_at: z.string().nullable().optional(),
  expected_arrival_at: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  passport_image_file_id: z.string().uuid(),
  visa_image_file_id: z.string().uuid().nullable().optional(),
  flight_ticket_image_file_id: z.string().uuid().nullable().optional(),
  personal_picture_file_id: z.string().uuid().nullable().optional(),
});

const ImportCommitBodySchema = z.object({
  rows: z.array(ImportCommitRowSchema).min(1).max(RECRUITMENT_IMPORT_MAX_ROWS),
});

export type ImportPreviewRow = {
  row_index: number;
  sheet_row_number: number;
  cells: Record<RecruitmentImportColumnKey, string>;
  resolved: {
    passport_image_file_id: string | null;
    visa_image_file_id: string | null;
    flight_ticket_image_file_id: string | null;
    personal_picture_file_id: string | null;
  };
  errors: CellError[];
  normalized: NormalizedImportRow | null;
};

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    s.trim(),
  );
}

function parseStatusCode(raw: string): {
  value:
    | typeof RECRUITMENT_STATUS.DRAFT
    | typeof RECRUITMENT_STATUS.UNDER_PROCEDURE;
} | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, '_');
  if (s === '' || s === 'UNDER_PROCEDURE') {
    return { value: RECRUITMENT_STATUS.UNDER_PROCEDURE };
  }
  if (s === 'DRAFT') {
    return { value: RECRUITMENT_STATUS.DRAFT };
  }
  return null;
}

function formatDateOnly(d: Date | null | undefined): string {
  if (!d) return '';
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class HrRecruitmentImportService {
  private readonly logger = new Logger(HrRecruitmentImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly recruitment: HrRecruitmentService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly files: FilesService,
  ) {}

  private fileViewUrl(fileId: string): string {
    const base = this.config.get<string>('FRONTEND_PUBLIC_URL') ?? '';
    const path = `/api/files/${fileId}/view`;
    if (!base) return path;
    return `${base.replace(/\/$/, '')}${path}`;
  }

  async generateTemplateBuffer(locale: 'en' | 'ar'): Promise<Buffer> {
    const instructions = getTemplateInstructions(locale);
    const wb = buildTemplateWorkbook(locale, instructions);
    const buf = await wb.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  async exportFilteredBuffer(
    company_id: string,
    actor_user_id: string,
    query: {
      q?: string;
      status_code?: string;
      sort?:
        | 'under_procedure'
        | 'drafts'
        | 'arriving_soon'
        | 'older_than_45_days';
      locale?: 'en' | 'ar';
    },
  ): Promise<{ filename: string; buffer: Buffer }> {
    const rawRows = (await this.recruitment.listForExport(company_id, {
      q: query.q,
      status_code: query.status_code,
      sort: query.sort,
    })) as Array<{
      id: string;
      full_name_ar: string;
      full_name_en: string | null;
      nationality: string;
      passport_no: string;
      passport_expiry_at: Date | null;
      job_title_code: string | null;
      status_code: string;
      department_id: string | null;
      responsible_office: string;
      responsible_office_number: string | null;
      visa_deadline_at: Date | null;
      visa_sent_at: Date | null;
      expected_arrival_at: Date | null;
      notes: string | null;
      avatar_file_id: string | null;
    }>;

    const loc = query.locale === 'ar' ? 'ar' : 'en';

    const exportRows = rawRows.map((r) => {
      const row: Record<string, unknown> = {
        full_name_ar: r.full_name_ar,
        full_name_en: r.full_name_en ?? '',
        nationality: r.nationality,
        passport_no: r.passport_no,
        passport_expiry_at: formatDateOnly(r.passport_expiry_at),
        status_code: formatExportStatusValue(r.status_code, loc),
        responsible_office: r.responsible_office,
        responsible_office_number: r.responsible_office_number ?? '',
        visa_deadline_at: formatDateOnly(r.visa_deadline_at),
        visa_sent_at: formatDateOnly(r.visa_sent_at),
        expected_arrival_at: formatDateOnly(r.expected_arrival_at),
        notes: r.notes ?? '',
      };
      return row;
    });

    const headers = getExportColumnHeaders(loc);
    const wb = await buildExportWorkbook(
      exportRows,
      [...RECRUITMENT_EXPORT_COLUMN_KEYS],
      headers,
      { rtl: loc === 'ar' },
    );
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());

    await this.audit.log({
      company_id,
      actor_user_id,
      actor_role: null,
      action: 'HR_RECRUITMENT_EXPORT',
      entity_type: 'RECRUITMENT_CANDIDATE',
      entity_id: company_id,
      new_values: {
        row_count: rawRows.length,
        filters: query,
      },
    });

    const ts = new Date().toISOString().slice(0, 10);
    return {
      filename: `recruitment-export-${ts}.xlsx`,
      buffer,
    };
  }

  private async verifyFileId(
    company_id: string,
    file_id: string,
  ): Promise<boolean> {
    const f = await this.prisma.fileObject.findFirst({
      where: { id: file_id, company_id, deleted_at: null },
      select: { id: true },
    });
    return !!f;
  }

  private mapImportImageError(
    message: string,
  ): (typeof HR_RECRUITMENT_IMPORT_ERROR)[keyof typeof HR_RECRUITMENT_IMPORT_ERROR] {
    const m: Record<
      string,
      (typeof HR_RECRUITMENT_IMPORT_ERROR)[keyof typeof HR_RECRUITMENT_IMPORT_ERROR]
    > = {
      INVALID_URL: HR_RECRUITMENT_IMPORT_ERROR.IMAGE_URL_INVALID,
      HTTPS_REQUIRED: HR_RECRUITMENT_IMPORT_ERROR.IMAGE_URL_HTTPS_REQUIRED,
      SSRF_BLOCKED: HR_RECRUITMENT_IMPORT_ERROR.IMAGE_URL_BLOCKED,
      DOWNLOAD_FAILED: HR_RECRUITMENT_IMPORT_ERROR.IMAGE_DOWNLOAD_FAILED,
      NOT_IMAGE: HR_RECRUITMENT_IMPORT_ERROR.IMAGE_NOT_IMAGE,
      IMAGE_TOO_LARGE: HR_RECRUITMENT_IMPORT_ERROR.IMAGE_TOO_LARGE,
    };
    return m[message] ?? HR_RECRUITMENT_IMPORT_ERROR.IMAGE_DOWNLOAD_FAILED;
  }

  private async resolveFileField(
    company_id: string,
    actor_user_id: string,
    raw: string,
    field: RecruitmentImportColumnKey,
    required: boolean,
  ): Promise<
    { ok: true; file_id: string | null } | { ok: false; err: CellError }
  > {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (required) {
        return {
          ok: false,
          err: {
            code: HR_RECRUITMENT_IMPORT_ERROR.REQUIRED_FIELD,
            field,
          },
        };
      }
      return { ok: true, file_id: null };
    }

    if (trimmed.toLowerCase().startsWith('http://')) {
      return {
        ok: false,
        err: {
          code: HR_RECRUITMENT_IMPORT_ERROR.IMAGE_URL_HTTPS_REQUIRED,
          field,
        },
      };
    }

    if (trimmed.startsWith('https://')) {
      try {
        const maxBytes = Number(
          this.config.get<string>('FILES_MAX_BYTES') ?? 10 * 1024 * 1024,
        );
        const { buffer, mime, ext } = await fetchHttpsImageToBuffer(
          trimmed,
          maxBytes,
        );
        const name = `import-${field}-${Date.now()}.${ext}`;
        const fileId = await this.files.uploadBuffer({
          company_id,
          actor_user_id,
          buffer,
          original_name: name,
          mime_type: mime,
        });
        return { ok: true, file_id: fileId };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'DOWNLOAD_FAILED';
        return {
          ok: false,
          err: {
            code: this.mapImportImageError(msg),
            field,
          },
        };
      }
    }

    if (isUuid(trimmed)) {
      const ok = await this.verifyFileId(company_id, trimmed);
      if (!ok) {
        return {
          ok: false,
          err: {
            code: HR_RECRUITMENT_IMPORT_ERROR.FILE_NOT_FOUND,
            field,
            meta: { value: trimmed },
          },
        };
      }
      return { ok: true, file_id: trimmed };
    }

    return {
      ok: false,
      err: {
        code: HR_RECRUITMENT_IMPORT_ERROR.IMAGE_URL_INVALID,
        field,
      },
    };
  }

  private async computePreviewRows(
    company_id: string,
    actor_user_id: string,
    rowInputs: Array<{
      row_index: number;
      sheet_row_number: number;
      cells: Record<RecruitmentImportColumnKey, string>;
    }>,
    options?: { audit: boolean },
  ): Promise<{
    rows: ImportPreviewRow[];
    summary: { valid: number; invalid: number; total: number };
  }> {
    const previewRows: ImportPreviewRow[] = [];
    const passportsInFile = new Map<string, number[]>();

    for (let i = 0; i < rowInputs.length; i++) {
      const {
        row_index: rowIndex,
        sheet_row_number: sheetRowNumber,
        cells,
      } = rowInputs[i];

      const errors: CellError[] = [];
      const st = parseStatusCode(cells.status ?? '');
      if (!st) {
        errors.push({
          code: HR_RECRUITMENT_IMPORT_ERROR.INVALID_STATUS,
          field: 'status',
        });
      }
      const status_code = st?.value ?? RECRUITMENT_STATUS.UNDER_PROCEDURE;

      const passportRaw = (cells.passport_no ?? '').trim();
      if (passportRaw) {
        const arr = passportsInFile.get(passportRaw) ?? [];
        arr.push(i);
        passportsInFile.set(passportRaw, arr);
      }

      const passportExpiryRaw = cells.passport_expiry_at ?? '';
      let passport_expiry_at: string | null = null;
      if (passportExpiryRaw.trim() !== '') {
        const p = parseDateOnlyToIsoUtc(passportExpiryRaw);
        if (!p.ok) {
          errors.push({
            code: HR_RECRUITMENT_IMPORT_ERROR.INVALID_DATE,
            field: 'passport_expiry_at',
          });
        } else {
          passport_expiry_at = p.iso;
        }
      }

      const vd = optionalDateCell(cells.visa_deadline_at);
      const vs = optionalDateCell(cells.visa_sent_at);
      const ea = optionalDateCell(cells.expected_arrival_at);
      if (!vd.ok)
        errors.push({
          code: HR_RECRUITMENT_IMPORT_ERROR.INVALID_DATE,
          field: 'visa_deadline_at',
        });
      if (!vs.ok)
        errors.push({
          code: HR_RECRUITMENT_IMPORT_ERROR.INVALID_DATE,
          field: 'visa_sent_at',
        });
      if (!ea.ok)
        errors.push({
          code: HR_RECRUITMENT_IMPORT_ERROR.INVALID_DATE,
          field: 'expected_arrival_at',
        });

      const resolved = {
        passport_image_file_id: null as string | null,
        visa_image_file_id: null as string | null,
        flight_ticket_image_file_id: null as string | null,
        personal_picture_file_id: null as string | null,
      };

      const passportUrl = cells.passport_image_url ?? '';
      const rPass = await this.resolveFileField(
        company_id,
        actor_user_id,
        passportUrl,
        'passport_image_url',
        true,
      );
      if (!rPass.ok) {
        errors.push(rPass.err);
      } else {
        resolved.passport_image_file_id = rPass.file_id;
      }

      for (const [col, key] of [
        ['visa_image_url', 'visa_image_file_id'],
        ['flight_ticket_image_url', 'flight_ticket_image_file_id'],
        ['personal_picture_url', 'personal_picture_file_id'],
      ] as const) {
        const raw = cells[col as RecruitmentImportColumnKey] ?? '';
        const res = await this.resolveFileField(
          company_id,
          actor_user_id,
          raw,
          col as RecruitmentImportColumnKey,
          false,
        );
        if (!res.ok) errors.push(res.err);
        else resolved[key] = res.file_id;
      }

      const normalized: NormalizedImportRow = {
        row_index: rowIndex,
        status_code,
        full_name_ar: (cells.full_name_ar ?? '').trim(),
        full_name_en: (cells.full_name_en ?? '').trim(),
        nationality: (cells.nationality ?? '').trim(),
        passport_no: passportRaw,
        passport_expiry_at,
        responsible_office: (cells.responsible_office ?? '').trim(),
        responsible_office_number:
          (cells.responsible_office_number ?? '').trim() || null,
        visa_deadline_at: vd.ok ? vd.iso : null,
        visa_sent_at: vs.ok ? vs.iso : null,
        expected_arrival_at: ea.ok ? ea.iso : null,
        notes: (cells.notes ?? '').trim() || null,
        passport_image_file_id: resolved.passport_image_file_id ?? '',
        visa_image_file_id: resolved.visa_image_file_id,
        flight_ticket_image_file_id: resolved.flight_ticket_image_file_id,
        personal_picture_file_id: resolved.personal_picture_file_id,
      };

      const rowFieldErrors = validateNormalizedImportRow(normalized);
      errors.push(...rowFieldErrors);

      previewRows.push({
        row_index: rowIndex,
        sheet_row_number: sheetRowNumber,
        cells,
        resolved: {
          passport_image_file_id: resolved.passport_image_file_id,
          visa_image_file_id: resolved.visa_image_file_id,
          flight_ticket_image_file_id: resolved.flight_ticket_image_file_id,
          personal_picture_file_id: resolved.personal_picture_file_id,
        },
        errors,
        normalized: errors.length === 0 ? normalized : null,
      });
    }

    for (const [pass, indices] of passportsInFile) {
      if (indices.length > 1) {
        for (const idx of indices) {
          const row = previewRows[idx];
          if (!row) continue;
          row.errors.push({
            code: HR_RECRUITMENT_IMPORT_ERROR.DUPLICATE_PASSPORT_IN_FILE,
            field: 'passport_no',
            meta: { passport_no: pass },
          });
          row.normalized = null;
        }
      }
    }

    const passportList = previewRows
      .map((r) => r.normalized?.passport_no?.trim())
      .filter((p): p is string => !!p);

    if (passportList.length > 0) {
      const existing = await this.prisma.recruitmentCandidate.findMany({
        where: {
          company_id,
          deleted_at: null,
          passport_no: { in: [...new Set(passportList)] },
        },
        select: {
          id: true,
          passport_no: true,
          full_name_ar: true,
          full_name_en: true,
          nationality: true,
          status_code: true,
          responsible_office: true,
          expected_arrival_at: true,
        },
      });
      const byPass = new Map(existing.map((e) => [e.passport_no, e]));
      for (const row of previewRows) {
        const p = row.normalized?.passport_no?.trim();
        if (!p) continue;
        const ex = byPass.get(p);
        if (ex) {
          row.errors.push({
            code: HR_RECRUITMENT_IMPORT_ERROR.DUPLICATE_PASSPORT_IN_DB,
            field: 'passport_no',
            meta: { existing: ex },
          });
          row.normalized = null;
        }
      }
    }

    let valid = 0;
    let invalid = 0;
    for (const r of previewRows) {
      if (r.errors.length === 0 && r.normalized) valid++;
      else invalid++;
    }

    if (options?.audit !== false) {
      await this.audit.log({
        company_id,
        actor_user_id,
        actor_role: null,
        action: 'HR_RECRUITMENT_IMPORT_VALIDATE',
        entity_type: 'RECRUITMENT_CANDIDATE',
        entity_id: company_id,
        new_values: { total: previewRows.length, valid, invalid },
      });
    }

    return {
      rows: previewRows,
      summary: { valid, invalid, total: previewRows.length },
    };
  }

  async validateImportFile(
    company_id: string,
    actor_user_id: string,
    buffer: Buffer,
  ): Promise<{
    rows: ImportPreviewRow[];
    summary: { valid: number; invalid: number; total: number };
  }> {
    if (buffer.length > MAX_IMPORT_BYTES) {
      throw new BadRequestException({
        code: HR_RECRUITMENT_IMPORT_ERROR.FILE_TOO_LARGE,
        message: 'File too large',
      });
    }

    let parsed: Awaited<ReturnType<typeof parseImportWorksheet>>;
    try {
      parsed = await parseImportWorksheet(buffer);
    } catch (e) {
      this.logger.warn(`Import parse failed: ${e}`);
      throw new BadRequestException({
        code: HR_RECRUITMENT_IMPORT_ERROR.WORKBOOK_EMPTY,
        message: 'Invalid or empty workbook',
      });
    }

    if (parsed.dataRows.length > RECRUITMENT_IMPORT_MAX_ROWS) {
      throw new BadRequestException({
        code: HR_RECRUITMENT_IMPORT_ERROR.TOO_MANY_ROWS,
        message: `Maximum ${RECRUITMENT_IMPORT_MAX_ROWS} data rows`,
      });
    }

    const rowInputs = parsed.dataRows.map((dr, i) => ({
      row_index: i,
      sheet_row_number: dr.sheetRowNumber,
      cells: fillImportCells(dr.values),
    }));

    return this.computePreviewRows(company_id, actor_user_id, rowInputs, {
      audit: true,
    });
  }

  async validateImportRowsJson(
    company_id: string,
    actor_user_id: string,
    body: unknown,
  ): Promise<{
    rows: ImportPreviewRow[];
    summary: { valid: number; invalid: number; total: number };
  }> {
    const parsed = ValidateRowsJsonSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Invalid validate-rows body');
    }

    const rowInputs = parsed.data.rows.map((r) => ({
      row_index: r.row_index,
      sheet_row_number: r.row_index + 3,
      cells: fillImportCells(r.cells),
    }));

    return this.computePreviewRows(company_id, actor_user_id, rowInputs, {
      audit: false,
    });
  }

  async commitImport(
    company_id: string,
    actor_user_id: string,
    body: unknown,
  ): Promise<{
    created: number;
    skipped: number;
    chunk_size: number;
    results: Array<{
      row_index: number;
      ok: boolean;
      candidate_id?: string;
    }>;
  }> {
    const parsed = ImportCommitBodySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException('Invalid commit body');
    }

    const { rows } = parsed.data;
    const results: Array<{
      row_index: number;
      ok: boolean;
      candidate_id?: string;
    }> = [];

    const queue: NormalizedImportRow[] = [];
    const passportInBatch = new Set<string>();

    for (const r of rows) {
      const n: NormalizedImportRow = {
        row_index: r.row_index,
        status_code: r.status_code,
        full_name_ar: r.full_name_ar ?? '',
        full_name_en: r.full_name_en ?? '',
        nationality: r.nationality ?? '',
        passport_no: r.passport_no ?? '',
        passport_expiry_at: r.passport_expiry_at ?? null,
        responsible_office: r.responsible_office ?? '',
        responsible_office_number: r.responsible_office_number ?? null,
        visa_deadline_at: r.visa_deadline_at ?? null,
        visa_sent_at: r.visa_sent_at ?? null,
        expected_arrival_at: r.expected_arrival_at ?? null,
        notes: r.notes ?? null,
        passport_image_file_id: r.passport_image_file_id,
        visa_image_file_id: r.visa_image_file_id ?? null,
        flight_ticket_image_file_id: r.flight_ticket_image_file_id ?? null,
        personal_picture_file_id: r.personal_picture_file_id ?? null,
      };

      if (!(await this.verifyFileId(company_id, n.passport_image_file_id))) {
        results.push({ row_index: r.row_index, ok: false });
        continue;
      }

      const errs = validateNormalizedImportRow(n);
      if (errs.length > 0) {
        results.push({ row_index: r.row_index, ok: false });
        continue;
      }

      const pn = n.passport_no.trim();
      if (pn) {
        if (passportInBatch.has(pn)) {
          results.push({ row_index: r.row_index, ok: false });
          continue;
        }
        passportInBatch.add(pn);
        const dup = await this.prisma.recruitmentCandidate.findFirst({
          where: {
            company_id,
            deleted_at: null,
            passport_no: pn,
          },
          select: { id: true },
        });
        if (dup) {
          results.push({ row_index: r.row_index, ok: false });
          continue;
        }
      }

      queue.push(n);
    }

    let created = 0;
    const chunk = RECRUITMENT_IMPORT_CHUNK_SIZE;

    for (let i = 0; i < queue.length; i += chunk) {
      const slice = queue.slice(i, i + chunk);
      for (const n of slice) {
        try {
          if (n.status_code === RECRUITMENT_STATUS.DRAFT) {
            const createdRow = await this.recruitment.create(
              company_id,
              actor_user_id,
              {
                status_code: 'DRAFT',
                full_name_ar: n.full_name_ar,
                full_name_en: n.full_name_en,
                nationality: n.nationality,
                passport_no: n.passport_no,
                passport_expiry_at: n.passport_expiry_at ?? undefined,
                responsible_office: n.responsible_office,
                responsible_office_number:
                  n.responsible_office_number ?? undefined,
                visa_deadline_at: n.visa_deadline_at ?? undefined,
                visa_sent_at: n.visa_sent_at ?? undefined,
                expected_arrival_at: n.expected_arrival_at ?? undefined,
                notes: n.notes ?? undefined,
                passport_image_file_id: n.passport_image_file_id,
                visa_image_file_id: n.visa_image_file_id ?? undefined,
                flight_ticket_image_file_id:
                  n.flight_ticket_image_file_id ?? undefined,
                personal_picture_file_id:
                  n.personal_picture_file_id ?? undefined,
              },
            );
            created++;
            results.push({
              row_index: n.row_index,
              ok: true,
              candidate_id: createdRow.id,
            });
          } else {
            const createdRow = await this.recruitment.createImportFull(
              company_id,
              actor_user_id,
              {
                full_name_ar: n.full_name_ar,
                full_name_en: n.full_name_en,
                nationality: n.nationality,
                passport_no: n.passport_no,
                passport_expiry_at: n.passport_expiry_at!,
                responsible_office: n.responsible_office,
                responsible_office_number: n.responsible_office_number,
                visa_deadline_at: n.visa_deadline_at,
                visa_sent_at: n.visa_sent_at,
                expected_arrival_at: n.expected_arrival_at,
                notes: n.notes,
                passport_image_file_id: n.passport_image_file_id,
                visa_image_file_id: n.visa_image_file_id,
                flight_ticket_image_file_id: n.flight_ticket_image_file_id,
                personal_picture_file_id: n.personal_picture_file_id,
              },
            );
            created++;
            results.push({
              row_index: n.row_index,
              ok: true,
              candidate_id: createdRow.id,
            });
          }
        } catch (err) {
          this.logger.error(`Import row failed: ${err}`);
          results.push({ row_index: n.row_index, ok: false });
        }
      }
    }

    const skipped = rows.length - created;

    await this.audit.log({
      company_id,
      actor_user_id,
      actor_role: null,
      action: 'HR_RECRUITMENT_IMPORT_COMMIT',
      entity_type: 'RECRUITMENT_CANDIDATE',
      entity_id: company_id,
      new_values: {
        requested: rows.length,
        created,
        skipped,
      },
    });

    return {
      created,
      skipped,
      chunk_size: RECRUITMENT_IMPORT_CHUNK_SIZE,
      results,
    };
  }
}
