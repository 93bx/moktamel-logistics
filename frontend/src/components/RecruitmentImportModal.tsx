"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  Download,
  Loader2,
  ListTree,
  Upload,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { FileUpload } from "@/components/FileUpload";
import { NationalitySearchDropdown } from "@/components/NationalitySearchDropdown";
import { resolveNationalityToStoredName } from "@/data/countries";
import {
  RECRUITMENT_IMPORT_COLUMN_KEYS,
  type RecruitmentImportColumnKey,
} from "@/lib/recruitmentImportColumns";
import {
  importImageThumbnailSrc,
  isImportDateColumn,
  statusSelectModel,
  toDateInputValue,
} from "@/lib/recruitmentImportPreview";

type CellError = { code: string; field: string; meta?: Record<string, unknown> };

type PreviewRow = {
  row_index: number;
  sheet_row_number: number;
  cells: Record<string, string>;
  resolved: {
    passport_image_file_id: string | null;
    visa_image_file_id: string | null;
    flight_ticket_image_file_id: string | null;
    personal_picture_file_id: string | null;
  };
  errors: CellError[];
  normalized: Record<string, unknown> | null;
};

type ValidateResponse = {
  rows: PreviewRow[];
  summary: { valid: number; invalid: number; total: number };
};

type CommitResponse = {
  created: number;
  skipped: number;
  chunk_size: number;
  results: Array<{ row_index: number; ok: boolean; candidate_id?: string }>;
};

type Step = "instructions" | "preview" | "confirm" | "result";

const IMPORT_IMAGE_URL_META: Record<
  string,
  {
    resolvedField: keyof PreviewRow["resolved"];
    purpose: string;
    commonLabelKey: "passportImage" | "visaImage" | "flightTicketImage" | "personalPicture";
    required: boolean;
  }
> = {
  passport_image_url: {
    resolvedField: "passport_image_file_id",
    purpose: "PASSPORT_IMAGE",
    commonLabelKey: "passportImage",
    required: true,
  },
  visa_image_url: {
    resolvedField: "visa_image_file_id",
    purpose: "VISA_IMAGE",
    commonLabelKey: "visaImage",
    required: false,
  },
  flight_ticket_image_url: {
    resolvedField: "flight_ticket_image_file_id",
    purpose: "FLIGHT_TICKET_IMAGE",
    commonLabelKey: "flightTicketImage",
    required: false,
  },
  personal_picture_url: {
    resolvedField: "personal_picture_file_id",
    purpose: "PERSONAL_PICTURE",
    commonLabelKey: "personalPicture",
    required: false,
  },
};

function rowHasFieldError(errors: CellError[], field: string): boolean {
  return errors.some((e) => e.field === field);
}

export function RecruitmentImportModal({
  isOpen,
  onClose,
  locale,
}: {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
}) {
  const t = useTranslations();
  const tCommon = useTranslations("common");
  const tImportErrors = useTranslations("recruitment.import.errors");
  const tImportCols = useTranslations("recruitment.import.columns");
  const tColumnRules = useTranslations("recruitment.import.columnRules");
  const [step, setStep] = useState<Step>("instructions");
  const [loading, setLoading] = useState(false);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [summary, setSummary] = useState({ valid: 0, invalid: 0, total: 0 });
  const [commitResult, setCommitResult] = useState<CommitResponse | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [notesModal, setNotesModal] = useState<{ rowIndex: number; draft: string } | null>(null);

  const uiLocale = locale === "ar" ? "ar" : "en";

  const reset = useCallback(() => {
    setStep("instructions");
    setPreviewRows([]);
    setSummary({ valid: 0, invalid: 0, total: 0 });
    setCommitResult(null);
    setFileError(null);
    setLoading(false);
    setNotesModal(null);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const translateError = useCallback(
    (code: string) => tImportErrors(code as never),
    [tImportErrors],
  );

  const columnLabel = useCallback(
    (k: RecruitmentImportColumnKey) => tImportCols(k as never),
    [tImportCols],
  );

  const revalidateRows = useCallback(
    async (rowsPayload: Array<{ row_index: number; cells: Record<string, string> }>) => {
      const res = await fetch("/api/recruitment/candidates/import/validate-rows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows: rowsPayload }),
      });
      const data = (await res.json()) as ValidateResponse & { message?: string };
      if (!res.ok) {
        throw new Error(data?.message ?? "Validation failed");
      }
      setPreviewRows(data.rows);
      setSummary(data.summary);
    },
    [],
  );

  const IMPORT_XLSX_MAX_BYTES = 1024 * 1024;

  const onPickFile = async (file: File) => {
    setFileError(null);
    if (file.size > IMPORT_XLSX_MAX_BYTES) {
      setFileError(t("recruitment.import.fileTooLargeImport"));
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/recruitment/candidates/import/validate", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as ValidateResponse & { message?: string };
      if (!res.ok) {
        setFileError(data?.message ?? t("recruitment.import.validateFailed"));
        return;
      }
      setPreviewRows(data.rows);
      setSummary(data.summary);
      setStep("preview");
    } catch {
      setFileError(t("recruitment.import.validateFailed"));
    } finally {
      setLoading(false);
    }
  };

  const updateCell = async (rowIndex: number, key: RecruitmentImportColumnKey, value: string) => {
    const next = previewRows.map((r) =>
      r.row_index === rowIndex
        ? { ...r, cells: { ...r.cells, [key]: value } }
        : r,
    );
    setPreviewRows(next);
    const payload = next.map((r) => ({
      row_index: r.row_index,
      cells: r.cells,
    }));
    setLoading(true);
    try {
      await revalidateRows(payload);
    } catch {
      /* keep local state */
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const loc = locale === "ar" ? "ar" : "en";
    window.open(`/api/recruitment/candidates/import/template?locale=${loc}`, "_blank");
  };

  const validRowsForCommit = useMemo(
    () => previewRows.filter((r) => r.errors.length === 0 && r.normalized),
    [previewRows],
  );

  const runCommit = async () => {
    setLoading(true);
    try {
      const rows = validRowsForCommit.map((r) => {
        const n = r.normalized as Record<string, unknown>;
        return {
          row_index: r.row_index,
          status_code: n.status_code,
          full_name_ar: n.full_name_ar,
          full_name_en: n.full_name_en,
          nationality: n.nationality,
          passport_no: n.passport_no,
          passport_expiry_at: n.passport_expiry_at ?? null,
          responsible_office: n.responsible_office,
          responsible_office_number: n.responsible_office_number ?? null,
          visa_deadline_at: n.visa_deadline_at ?? null,
          visa_sent_at: n.visa_sent_at ?? null,
          expected_arrival_at: n.expected_arrival_at ?? null,
          notes: n.notes ?? null,
          passport_image_file_id: n.passport_image_file_id,
          visa_image_file_id: n.visa_image_file_id ?? null,
          flight_ticket_image_file_id: n.flight_ticket_image_file_id ?? null,
          personal_picture_file_id: n.personal_picture_file_id ?? null,
        };
      });

      const res = await fetch("/api/recruitment/candidates/import/commit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rows }),
      });
      const data = (await res.json()) as CommitResponse & { message?: string };
      if (!res.ok) {
        throw new Error(data?.message ?? "Commit failed");
      }
      setCommitResult(data);
      setStep("result");
    } catch {
      setFileError(t("recruitment.import.commitFailed"));
    } finally {
      setLoading(false);
    }
  };

  const title = useMemo(() => {
    if (step === "instructions") return t("recruitment.import.titleInstructions");
    if (step === "preview") return t("recruitment.import.titlePreview");
    if (step === "confirm") return t("recruitment.import.titleConfirm");
    return t("recruitment.import.titleResult");
  }, [step, t]);

  const modalShellClass = useMemo(
    () => (step === "instructions" ? "max-h-[95vh] max-w-[99vw]" : "min-h-[70vh] max-h-[92vh]"),
    [step],
  );

  const structureSteps = useMemo(
    () =>
      [
        {
          n: 1,
          title: t("recruitment.import.instructionsStep1Title"),
          body: t("recruitment.import.instructionsStep1Body"),
        },
        {
          n: 2,
          title: t("recruitment.import.instructionsStep2Title"),
          body: t("recruitment.import.instructionsStep2Body"),
        },
        {
          n: 3,
          title: t("recruitment.import.instructionsStep3Title"),
          body: t("recruitment.import.instructionsStep3Body"),
        },
      ] as const,
    [t],
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      maxWidth="8xl"
      contentClassName="p-0 flex flex-col"
      modalClassName={modalShellClass}
    >
      <div className="flex flex-col max-h-[calc(95vh-4rem)]">
        {step === "instructions" && (
          <div className="space-y-6 overflow-y-auto p-3">
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <ListTree className="h-4 w-4 text-primary/60" aria-hidden />
                <h3 className="text-xs font-bold uppercase tracking-wide text-primary/55">
                  {t("recruitment.import.instructionsStructureTitle")}
                </h3>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {structureSteps.map((s) => (
                  <div
                    key={s.n}
                    className="flex gap-3 rounded-lg border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-800/50"
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white"
                      aria-hidden
                    >
                      {s.n}
                    </span>
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-primary">{s.title}</p>
                      <p className="text-xs leading-relaxed text-primary/75">{s.body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wide text-primary/55">
                {t("recruitment.import.instructionsColumnRulesTitle")}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
                {RECRUITMENT_IMPORT_COLUMN_KEYS.map((k) => (
                  <div
                    key={k}
                    className="rounded-lg border border-zinc-200/90 bg-white p-3 text-start shadow-sm dark:border-zinc-700 dark:bg-zinc-800/50"
                  >
                    <p className="font-mono text-[11px] font-semibold text-primary/80">{columnLabel(k)}</p>
                    <p className="mt-1 text-xs leading-relaxed text-primary/80">{tColumnRules(k as never)}</p>
                  </div>
                ))}
              </div>
            </section>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={downloadTemplate}
                className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary shadow-sm transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                <Download className="h-4 w-4" aria-hidden />
                {t("recruitment.import.downloadTemplate")}
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90">
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" aria-hidden />}
                {t("recruitment.import.uploadFile")}
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  disabled={loading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onPickFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            {fileError && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                {fileError}
              </div>
            )}
          </div>
        )}

        {step === "preview" && (
          <div className="flex flex-col flex-1">
            <div
              className={`shrink-0 px-4 py-3 border-b text-sm ${summary.invalid === 0
                ? "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100"
                : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100"
                }`}
            >
              {summary.invalid === 0
                ? t("recruitment.import.previewAllValid", { count: summary.valid })
                : t("recruitment.import.previewMixed", {
                  valid: summary.valid,
                  invalid: summary.invalid,
                })}
            </div>
            <div className="flex-1 overflow-auto">
              <table className="min-w-full border-collapse text-xs">
                <thead className="sticky top-0 z-[1] bg-primary/90 text-white dark:bg-zinc-800">
                  <tr>
                    <th className="border border-zinc-600 px-1 py-1 text-start font-medium">#</th>
                    {RECRUITMENT_IMPORT_COLUMN_KEYS.map((k) => (
                      <th key={k} className="border border-zinc-600 px-1 py-1 text-start font-medium whitespace-wrap">
                        {columnLabel(k)}
                      </th>
                    ))}
                    <th className="border border-zinc-600 px-1 py-1 text-start font-medium min-w-[100px]">
                      {t("recruitment.import.errorsColumn")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, previewIdx) => {
                    const invalid = row.errors.length > 0;
                    return (
                      <tr
                        key={row.row_index}
                        className={
                          invalid
                            ? "bg-red-50/90 dark:bg-red-900/15"
                            : "bg-white dark:bg-zinc-800/40"
                        }
                      >
                        <td
                          className="border border-zinc-200 px-1 py-0.5 align-top dark:border-zinc-700"
                          title={t("recruitment.import.previewRowNumberHint", {
                            row: row.sheet_row_number,
                          })}
                        >
                          {previewIdx + 1}
                        </td>
                        {RECRUITMENT_IMPORT_COLUMN_KEYS.map((k) => {
                          const fe = rowHasFieldError(row.errors, k);
                          const val = row.cells[k] ?? "";
                          const baseTd = `border border-zinc-200 px-1 py-0.5 align-top dark:border-zinc-700 ${fe ? "bg-red-100/80 dark:bg-red-900/30" : ""
                            }`;

                          if (k === "nationality") {
                            return (
                              <td key={k} className={`${baseTd} min-w-[140px]`}>
                                <NationalitySearchDropdown
                                  value={resolveNationalityToStoredName(val)}
                                  onChange={(v) => void updateCell(row.row_index, "nationality", v)}
                                  locale={uiLocale}
                                  size="compact"
                                  inputClassName={
                                    fe
                                      ? "mt-0.5 w-full rounded border border-red-400 bg-red-50/50 px-2 py-1.5 text-xs text-primary dark:border-red-600 dark:bg-red-950/30"
                                      : "mt-0.5 w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-primary dark:border-zinc-700 dark:bg-zinc-900"
                                  }
                                />
                              </td>
                            );
                          }

                          if (k === "status") {
                            const sm = statusSelectModel(val);
                            return (
                              <td key={k} className={baseTd}>
                                <select
                                  value={sm}
                                  onChange={(e) => {
                                    const v = e.target.value as "DRAFT" | "UNDER_PROCEDURE";
                                    void updateCell(
                                      row.row_index,
                                      "status",
                                      v === "UNDER_PROCEDURE" ? "" : "DRAFT",
                                    );
                                  }}
                                  className="w-full min-w-[100px] rounded border border-zinc-200 bg-white px-1 py-1 text-primary dark:border-zinc-600 dark:bg-zinc-900"
                                >
                                  <option value="UNDER_PROCEDURE">{t("common.statusUnderProcedure")}</option>
                                  <option value="DRAFT">{t("common.statusDraft")}</option>
                                </select>
                              </td>
                            );
                          }

                          if (isImportDateColumn(k)) {
                            return (
                              <td key={k} className={baseTd}>
                                <input
                                  type="date"
                                  value={toDateInputValue(val)}
                                  onChange={(e) => {
                                    void updateCell(row.row_index, k, e.target.value);
                                  }}
                                  className="w-full min-w-[110px] rounded border border-zinc-200 bg-white px-1 py-0.5 text-primary dark:border-zinc-600 dark:bg-zinc-900"
                                />
                              </td>
                            );
                          }

                          if (k === "notes") {
                            const preview =
                              val.length > 48 ? `${val.slice(0, 48)}…` : val;
                            return (
                              <td key={k} className={`${baseTd} max-w-[140px]`}>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setNotesModal({ rowIndex: row.row_index, draft: val })
                                  }
                                  className="w-full text-start rounded border border-dashed border-zinc-300 bg-zinc-50/80 px-1.5 py-1 text-primary hover:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900/50 dark:hover:bg-zinc-800"
                                >
                                  {val
                                    ? preview
                                    : t("recruitment.import.notesPlaceholder")}
                                </button>
                              </td>
                            );
                          }

                          const imgMeta = IMPORT_IMAGE_URL_META[k];
                          if (imgMeta) {
                            const resolvedId = row.resolved[imgMeta.resolvedField];
                            const thumb = importImageThumbnailSrc(resolvedId, val);
                            const empty = !val.trim();

                            if (empty) {
                              return (
                                <td key={k} className={`${baseTd} min-w-[100px]`}>
                                  <FileUpload
                                    purpose_code={imgMeta.purpose}
                                    label={tCommon(imgMeta.commonLabelKey)}
                                    required={imgMeta.required}
                                    variant="button"
                                    accept="image/*"
                                    instanceId={`import-${row.row_index}-${k}`}
                                    fileId={resolvedId}
                                    onFileIdChange={(id) => {
                                      void updateCell(row.row_index, k, id ?? "");
                                    }}
                                  />
                                </td>
                              );
                            }

                            if (thumb) {
                              return (
                                <td key={k} className={`${baseTd} min-w-[72px]`}>
                                  <div className="flex flex-col items-start gap-0.5">
                                    <Image
                                      src={thumb}
                                      alt=""
                                      width={40}
                                      height={40}
                                      className="h-10 w-10 rounded border border-zinc-200 object-cover dark:border-zinc-600"
                                      unoptimized
                                    />
                                    <button
                                      type="button"
                                      onClick={() => void updateCell(row.row_index, k, "")}
                                      className="text-[10px] font-medium text-primary underline underline-offset-2"
                                    >
                                      {t("recruitment.import.replaceImageUrl")}
                                    </button>
                                  </div>
                                </td>
                              );
                            }

                            return (
                              <td key={k} className={baseTd}>
                                <input
                                  value={val}
                                  onChange={(e) => void updateCell(row.row_index, k, e.target.value)}
                                  className="w-full min-w-[72px] rounded border border-zinc-200 bg-white px-1 py-0.5 text-primary dark:border-zinc-600 dark:bg-zinc-900"
                                />
                              </td>
                            );
                          }

                          return (
                            <td key={k} className={baseTd}>
                              <input
                                value={val}
                                onChange={(e) => void updateCell(row.row_index, k, e.target.value)}
                                className="w-full min-w-[72px] rounded border border-zinc-200 bg-white px-1 py-0.5 text-primary dark:border-zinc-600 dark:bg-zinc-900"
                              />
                            </td>
                          );
                        })}
                        <td className="border border-zinc-200 px-1 py-0.5 align-top text-red-700 dark:border-zinc-700 dark:text-red-300">
                          {row.errors.length === 0
                            ? "—"
                            : row.errors.map((e, i) => (
                              <div key={i} className="leading-tight">
                                {translateError(e.code)}
                              </div>
                            ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="shrink-0 flex flex-wrap justify-end gap-2 border-t border-zinc-200 p-4 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setStep("instructions")}
                className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800"
              >
                {t("common.back")}
              </button>
              <button
                type="button"
                disabled={summary.valid === 0 || loading}
                onClick={() => setStep("confirm")}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t("recruitment.import.continueToConfirm")}
              </button>
            </div>
          </div>
        )}

        {step === "confirm" && (
          <div className="space-y-4 p-6">
            <p className="text-sm text-primary">
              {t("recruitment.import.confirmBody", {
                count: validRowsForCommit.length,
                skip: summary.invalid,
              })}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setStep("preview")}
                className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                {t("common.back")}
              </button>
              <button
                type="button"
                disabled={validRowsForCommit.length === 0 || loading}
                onClick={() => void runCommit()}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {t("recruitment.import.confirmImport")}
              </button>
            </div>
          </div>
        )}

        {step === "result" && commitResult && (
          <div className="space-y-4 p-6">
            <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-950 dark:border-green-800 dark:bg-green-900/20 dark:text-green-100">
              <p className="font-semibold">{t("recruitment.import.resultSummary")}</p>
              <ul className="mt-2 list-disc ps-5 space-y-1">
                <li>{t("recruitment.import.resultCreated", { count: commitResult.created })}</li>
                <li>{t("recruitment.import.resultSkipped", { count: commitResult.skipped })}</li>
                <li>{t("recruitment.import.resultChunk", { size: commitResult.chunk_size })}</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white"
            >
              {t("recruitment.import.done")}
            </button>
          </div>
        )}
      </div>

      {notesModal && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="import-notes-edit-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setNotesModal(null);
          }}
        >
          <div className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-4 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
            <h2 id="import-notes-edit-title" className="text-sm font-semibold text-primary">
              {t("recruitment.import.editNotesTitle")}
            </h2>
            <textarea
              value={notesModal.draft}
              onChange={(e) =>
                setNotesModal((m) => (m ? { ...m, draft: e.target.value } : m))
              }
              rows={8}
              className="mt-3 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-600 dark:bg-zinc-950"
            />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setNotesModal(null)}
                className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const { rowIndex, draft } = notesModal;
                  setNotesModal(null);
                  void updateCell(rowIndex, "notes", draft);
                }}
                className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white"
              >
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export async function downloadRecruitmentExport(searchParams: {
  q?: string;
  status_code?: string;
  sort?: string;
  /** Matches site locale so export headers and (for Arabic) status labels match the UI language. */
  locale?: "en" | "ar";
}): Promise<void> {
  const params = new URLSearchParams();
  if (searchParams.q) params.set("q", searchParams.q);
  if (searchParams.status_code) params.set("status_code", searchParams.status_code);
  if (searchParams.sort) params.set("sort", searchParams.sort);
  if (searchParams.locale) params.set("locale", searchParams.locale);
  const res = await fetch(`/api/recruitment/candidates/export?${params.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? "Export failed");
  }
  const blob = await res.blob();
  const dispo = res.headers.get("content-disposition");
  let name = "recruitment-export.xlsx";
  const m = dispo?.match(/filename="([^"]+)"/);
  if (m) name = m[1];
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
