/** Must match backend RECRUITMENT_IMPORT_COLUMN_KEYS */
export const RECRUITMENT_IMPORT_COLUMN_KEYS = [
  "full_name_ar",
  "full_name_en",
  "nationality",
  "passport_no",
  "passport_expiry_at",
  "status",
  "responsible_office",
  "responsible_office_number",
  "visa_deadline_at",
  "visa_sent_at",
  "expected_arrival_at",
  "notes",
  "passport_image_url",
  "visa_image_url",
  "flight_ticket_image_url",
  "personal_picture_url",
] as const;

export type RecruitmentImportColumnKey =
  (typeof RECRUITMENT_IMPORT_COLUMN_KEYS)[number];
