import { RECRUITMENT_STATUS } from './recruitment.constants';
import {
  HR_RECRUITMENT_IMPORT_ERROR,
  parseDateOnlyToIsoUtc,
  type CellError,
} from './recruitment-import.validation';

export type NormalizedImportRow = {
  row_index: number;
  status_code:
    | typeof RECRUITMENT_STATUS.DRAFT
    | typeof RECRUITMENT_STATUS.UNDER_PROCEDURE;
  full_name_ar: string;
  full_name_en: string;
  nationality: string;
  passport_no: string;
  passport_expiry_at: string | null;
  responsible_office: string;
  responsible_office_number: string | null;
  visa_deadline_at: string | null;
  visa_sent_at: string | null;
  expected_arrival_at: string | null;
  notes: string | null;
  passport_image_file_id: string;
  visa_image_file_id: string | null;
  flight_ticket_image_file_id: string | null;
  personal_picture_file_id: string | null;
};

function hasDraftAnyField(r: NormalizedImportRow): boolean {
  const has = (v: unknown) => v != null && String(v).trim() !== '';
  return (
    has(r.full_name_ar) ||
    has(r.full_name_en) ||
    has(r.nationality) ||
    has(r.passport_no) ||
    has(r.responsible_office) ||
    has(r.responsible_office_number) ||
    has(r.notes) ||
    !!r.passport_expiry_at ||
    !!r.visa_deadline_at ||
    !!r.visa_sent_at ||
    !!r.expected_arrival_at ||
    !!r.passport_image_file_id ||
    !!r.visa_image_file_id ||
    !!r.flight_ticket_image_file_id ||
    !!r.personal_picture_file_id
  );
}

/**
 * Strict validation for a normalized row (after URL resolution to file UUIDs).
 * Returns cell-level errors; empty array means row is importable.
 */
export function validateNormalizedImportRow(
  r: NormalizedImportRow,
): CellError[] {
  const errors: CellError[] = [];
  const field = (name: string) => name;

  if (
    r.status_code !== RECRUITMENT_STATUS.DRAFT &&
    r.status_code !== RECRUITMENT_STATUS.UNDER_PROCEDURE
  ) {
    errors.push({
      code: HR_RECRUITMENT_IMPORT_ERROR.INVALID_STATUS,
      field: field('status'),
      meta: { value: r.status_code },
    });
    return errors;
  }

  if (!r.passport_image_file_id) {
    errors.push({
      code: HR_RECRUITMENT_IMPORT_ERROR.REQUIRED_FIELD,
      field: field('passport_image_url'),
    });
  }

  if (r.status_code === RECRUITMENT_STATUS.DRAFT) {
    if (!hasDraftAnyField(r)) {
      errors.push({
        code: HR_RECRUITMENT_IMPORT_ERROR.DRAFT_EMPTY,
        field: field('full_name_ar'),
      });
    }
    if (
      r.responsible_office_number != null &&
      r.responsible_office_number.length > 10
    ) {
      errors.push({
        code: HR_RECRUITMENT_IMPORT_ERROR.OFFICE_NUMBER_MAX,
        field: field('responsible_office_number'),
      });
    }
    if (r.notes != null && r.notes.length > 5000) {
      errors.push({
        code: HR_RECRUITMENT_IMPORT_ERROR.NOTES_MAX,
        field: field('notes'),
      });
    }
    const optDates: Array<[string, string | null]> = [
      ['visa_deadline_at', r.visa_deadline_at],
      ['visa_sent_at', r.visa_sent_at],
      ['expected_arrival_at', r.expected_arrival_at],
    ];
    for (const [fn, v] of optDates) {
      if (v != null && v !== '' && Number.isNaN(Date.parse(v))) {
        errors.push({
          code: HR_RECRUITMENT_IMPORT_ERROR.INVALID_DATE,
          field: field(fn),
        });
      }
    }
    if (r.passport_expiry_at != null && r.passport_expiry_at !== '') {
      if (Number.isNaN(Date.parse(r.passport_expiry_at))) {
        errors.push({
          code: HR_RECRUITMENT_IMPORT_ERROR.INVALID_DATE,
          field: field('passport_expiry_at'),
        });
      }
    }
    return errors;
  }

  // UNDER_PROCEDURE — full rules (mirror bulk create)
  if (!r.full_name_ar || r.full_name_ar.trim().length < 2) {
    errors.push({
      code: HR_RECRUITMENT_IMPORT_ERROR.REQUIRED_FIELD,
      field: field('full_name_ar'),
    });
  }
  if (!r.full_name_en || r.full_name_en.trim().length < 2) {
    errors.push({
      code: HR_RECRUITMENT_IMPORT_ERROR.REQUIRED_FIELD,
      field: field('full_name_en'),
    });
  }
  if (!r.nationality || r.nationality.trim().length < 2) {
    errors.push({
      code: HR_RECRUITMENT_IMPORT_ERROR.REQUIRED_FIELD,
      field: field('nationality'),
    });
  }
  if (!r.passport_no || r.passport_no.trim().length < 3) {
    errors.push({
      code: HR_RECRUITMENT_IMPORT_ERROR.REQUIRED_FIELD,
      field: field('passport_no'),
    });
  }
  if (!r.responsible_office || r.responsible_office.trim().length < 1) {
    errors.push({
      code: HR_RECRUITMENT_IMPORT_ERROR.REQUIRED_FIELD,
      field: field('responsible_office'),
    });
  }
  if (!r.passport_expiry_at) {
    errors.push({
      code: HR_RECRUITMENT_IMPORT_ERROR.REQUIRED_FIELD,
      field: field('passport_expiry_at'),
    });
  } else if (Number.isNaN(Date.parse(r.passport_expiry_at))) {
    errors.push({
      code: HR_RECRUITMENT_IMPORT_ERROR.INVALID_DATE,
      field: field('passport_expiry_at'),
    });
  }
  if (
    r.responsible_office_number != null &&
    r.responsible_office_number.length > 10
  ) {
    errors.push({
      code: HR_RECRUITMENT_IMPORT_ERROR.OFFICE_NUMBER_MAX,
      field: field('responsible_office_number'),
    });
  }
  if (r.notes != null && r.notes.length > 5000) {
    errors.push({
      code: HR_RECRUITMENT_IMPORT_ERROR.NOTES_MAX,
      field: field('notes'),
    });
  }
  const optDates: Array<[string, string | null]> = [
    ['visa_deadline_at', r.visa_deadline_at],
    ['visa_sent_at', r.visa_sent_at],
    ['expected_arrival_at', r.expected_arrival_at],
  ];
  for (const [fn, v] of optDates) {
    if (v != null && v !== '' && Number.isNaN(Date.parse(v))) {
      errors.push({
        code: HR_RECRUITMENT_IMPORT_ERROR.INVALID_DATE,
        field: field(fn),
      });
    }
  }

  return errors;
}

/** Parse optional date cell to ISO end-of-day UTC string or null */
export function optionalDateCell(
  raw: string | null | undefined,
): { ok: true; iso: string | null } | { ok: false } {
  if (raw == null || String(raw).trim() === '') return { ok: true, iso: null };
  const p = parseDateOnlyToIsoUtc(raw);
  if (!p.ok) return { ok: false };
  return { ok: true, iso: p.iso };
}
