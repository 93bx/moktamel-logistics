/** Max data rows per uploaded workbook (excluding header + instruction rows). */
export const RECRUITMENT_IMPORT_MAX_ROWS = 200;

/** Rows inserted per transaction chunk during commit. */
export const RECRUITMENT_IMPORT_CHUNK_SIZE = 25;

/** Machine keys row 1; localized instruction row 2; data starts row 3. */
export const RECRUITMENT_IMPORT_COLUMN_KEYS = [
  'full_name_ar',
  'full_name_en',
  'nationality',
  'passport_no',
  'passport_expiry_at',
  'status',
  'responsible_office',
  'responsible_office_number',
  'visa_deadline_at',
  'visa_sent_at',
  'expected_arrival_at',
  'notes',
  'passport_image_url',
  'visa_image_url',
  'flight_ticket_image_url',
  'personal_picture_url',
] as const;

export type RecruitmentImportColumnKey =
  (typeof RECRUITMENT_IMPORT_COLUMN_KEYS)[number];

/** Subset of columns written to recruitment Excel export (human-readable headers). */
export const RECRUITMENT_EXPORT_COLUMN_KEYS = [
  'full_name_ar',
  'full_name_en',
  'nationality',
  'passport_no',
  'passport_expiry_at',
  'status_code',
  'responsible_office',
  'responsible_office_number',
  'visa_deadline_at',
  'visa_sent_at',
  'expected_arrival_at',
  'notes',
] as const;

export type RecruitmentExportColumnKey =
  (typeof RECRUITMENT_EXPORT_COLUMN_KEYS)[number];
