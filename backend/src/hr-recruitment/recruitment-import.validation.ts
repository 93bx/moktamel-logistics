import { z } from 'zod';
import { RECRUITMENT_IMPORT_MAX_ROWS } from './recruitment-import.constants';
import { RECRUITMENT_STATUS } from './recruitment.constants';

export const HR_RECRUITMENT_IMPORT_ERROR = {
  FILE_TOO_LARGE: 'HR_RECRUITMENT_IMPORT_001',
  INVALID_FILE_TYPE: 'HR_RECRUITMENT_IMPORT_002',
  WORKBOOK_EMPTY: 'HR_RECRUITMENT_IMPORT_003',
  HEADER_ROW_INVALID: 'HR_RECRUITMENT_IMPORT_004',
  TOO_MANY_ROWS: 'HR_RECRUITMENT_IMPORT_005',
  ROW_PARSE: 'HR_RECRUITMENT_IMPORT_006',
  REQUIRED_FIELD: 'HR_RECRUITMENT_IMPORT_007',
  FIELD_MIN_LENGTH: 'HR_RECRUITMENT_IMPORT_008',
  INVALID_DATE: 'HR_RECRUITMENT_IMPORT_009',
  INVALID_STATUS: 'HR_RECRUITMENT_IMPORT_010',
  INVALID_UUID: 'HR_RECRUITMENT_IMPORT_011',
  FILE_NOT_FOUND: 'HR_RECRUITMENT_IMPORT_012',
  FILE_WRONG_COMPANY: 'HR_RECRUITMENT_IMPORT_013',
  DUPLICATE_PASSPORT_IN_FILE: 'HR_RECRUITMENT_IMPORT_014',
  DUPLICATE_PASSPORT_IN_DB: 'HR_RECRUITMENT_IMPORT_015',
  OFFICE_NUMBER_MAX: 'HR_RECRUITMENT_IMPORT_016',
  NOTES_MAX: 'HR_RECRUITMENT_IMPORT_017',
  DRAFT_EMPTY: 'HR_RECRUITMENT_IMPORT_018',
  IMAGE_URL_INVALID: 'HR_RECRUITMENT_IMPORT_019',
  IMAGE_URL_HTTPS_REQUIRED: 'HR_RECRUITMENT_IMPORT_020',
  IMAGE_URL_BLOCKED: 'HR_RECRUITMENT_IMPORT_021',
  IMAGE_DOWNLOAD_FAILED: 'HR_RECRUITMENT_IMPORT_022',
  IMAGE_NOT_IMAGE: 'HR_RECRUITMENT_IMPORT_023',
  IMAGE_TOO_LARGE: 'HR_RECRUITMENT_IMPORT_024',
} as const;

export type ImportErrorCode =
  (typeof HR_RECRUITMENT_IMPORT_ERROR)[keyof typeof HR_RECRUITMENT_IMPORT_ERROR];

export type CellError = {
  code: ImportErrorCode;
  field: string;
  meta?: Record<string, unknown>;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOnlyToIsoUtc(
  raw: string | null | undefined,
): { ok: true; iso: string } | { ok: false } {
  if (raw == null || String(raw).trim() === '') {
    return { ok: false };
  }
  const s = String(raw).trim();
  if (!DATE_RE.test(s)) return { ok: false };
  const [y, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
  if (
    isNaN(dt.getTime()) ||
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== m - 1 ||
    dt.getUTCDate() !== d
  ) {
    return { ok: false };
  }
  return { ok: true, iso: dt.toISOString() };
}

export function extractUuidFromString(input: string): string | null {
  const m = input.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
  );
  return m ? m[0].toLowerCase() : null;
}

export const ImportCommitRowSchema = z.object({
  row_index: z.number().int().min(0),
  full_name_ar: z.string(),
  full_name_en: z.string(),
  nationality: z.string(),
  passport_no: z.string(),
  passport_expiry_at: z.string().datetime(),
  status_code: z.enum([RECRUITMENT_STATUS.DRAFT, RECRUITMENT_STATUS.UNDER_PROCEDURE]),
  responsible_office: z.string(),
  responsible_office_number: z.string().max(10).nullable().optional(),
  visa_deadline_at: z.string().datetime().nullable().optional(),
  visa_sent_at: z.string().datetime().nullable().optional(),
  expected_arrival_at: z.string().datetime().nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  passport_image_file_id: z.string().uuid(),
  visa_image_file_id: z.string().uuid().nullable().optional(),
  flight_ticket_image_file_id: z.string().uuid().nullable().optional(),
  personal_picture_file_id: z.string().uuid().nullable().optional(),
});

export const ImportCommitBodySchema = z.object({
  rows: z.array(ImportCommitRowSchema).max(RECRUITMENT_IMPORT_MAX_ROWS),
});
