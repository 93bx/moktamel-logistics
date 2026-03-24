import type { RecruitmentImportColumnKey } from "@/lib/recruitmentImportColumns";

const RECRUITMENT_IMPORT_DATE_KEYS: readonly RecruitmentImportColumnKey[] = [
  "passport_expiry_at",
  "visa_deadline_at",
  "visa_sent_at",
  "expected_arrival_at",
];

export function isImportDateColumn(k: RecruitmentImportColumnKey): boolean {
  return (RECRUITMENT_IMPORT_DATE_KEYS as readonly string[]).includes(k);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidLike(s: string): boolean {
  return UUID_RE.test(s.trim());
}

/** Value for `<input type="date" />` (YYYY-MM-DD). */
export function toDateInputValue(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  const m = t.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : "";
}

export function statusSelectModel(raw: string): "DRAFT" | "UNDER_PROCEDURE" {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "_");
  if (s === "DRAFT") return "DRAFT";
  return "UNDER_PROCEDURE";
}

/**
 * Thumbnail URL for import preview: resolved file id, UUID cell, or HTTPS URL.
 */
export function importImageThumbnailSrc(
  resolvedFileId: string | null | undefined,
  cell: string,
): string | null {
  if (resolvedFileId) return `/api/files/${resolvedFileId}/view`;
  const t = cell.trim();
  if (!t) return null;
  if (isUuidLike(t)) return `/api/files/${t}/view`;
  if (/^https:\/\//i.test(t)) return t;
  return null;
}
