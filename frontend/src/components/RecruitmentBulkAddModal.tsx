"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import Popover from "@mui/material/Popover";
import { Calendar, FileImage, FileText, Plane, Trash2, User } from "lucide-react";
import { FileUpload } from "./FileUpload";
import { Modal } from "./Modal";
import { NationalitySearchDropdown } from "./NationalitySearchDropdown";

interface RecruitmentBulkAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
}

type FieldErrorKey =
  | "full_name_ar"
  | "full_name_en"
  | "nationality"
  | "passport_no"
  | "passport_expiry_at"
  | "responsible_office"
  | "responsible_office_number"
  | "passport_image_file_id";

export type BulkCandidateRow = {
  full_name_ar: string;
  full_name_en: string;
  nationality: string;
  passport_no: string;
  passport_expiry_at: string | null;
  responsible_office: string;
  responsible_office_number: string;
  visa_deadline_at: string | null;
  visa_sent_at: string | null;
  expected_arrival_at: string | null;
  passport_image_file_id: string | null;
  visa_image_file_id: string | null;
  flight_ticket_image_file_id: string | null;
  personal_picture_file_id: string | null;
};

function createBlankRow(): BulkCandidateRow {
  return {
    full_name_ar: "",
    full_name_en: "",
    nationality: "",
    passport_no: "",
    passport_expiry_at: null,
    responsible_office: "",
    responsible_office_number: "",
    visa_deadline_at: null,
    visa_sent_at: null,
    expected_arrival_at: null,
    passport_image_file_id: null,
    visa_image_file_id: null,
    flight_ticket_image_file_id: null,
    personal_picture_file_id: null,
  };
}

const INITIAL_ROW_COUNT = 12;

const INPUT_BASE =
  "w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900";
const INPUT_ERROR = "border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-900/20";
const INPUT_NEUTRAL = "border-zinc-200 dark:border-zinc-700";

export function RecruitmentBulkAddModal({ isOpen, onClose, locale }: RecruitmentBulkAddModalProps) {
  const router = useRouter();
  const t = useTranslations();
  const [rows, setRows] = useState<BulkCandidateRow[]>(() =>
    Array.from({ length: INITIAL_ROW_COUNT }, createBlankRow)
  );
  const [rowErrors, setRowErrors] = useState<Record<number, Partial<Record<FieldErrorKey, string>>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successSummary, setSuccessSummary] = useState<string | null>(null);
  const [openDatePicker, setOpenDatePicker] = useState<{ rowIndex: number; field: keyof BulkCandidateRow } | null>(null);
  const [datePickerAnchorEl, setDatePickerAnchorEl] = useState<HTMLElement | null>(null);

  const formatDateButton = (iso: string | null): string => {
    if (!iso) return t("recruitment.selectDate");
    return dayjs(iso).format("YYYY-MM-DD");
  };

  const deleteRow = (index: number) => {
    setRows((prev) => prev.filter((_, i) => i !== index));
    setRowErrors((prev) => {
      const next: Record<number, Partial<Record<FieldErrorKey, string>>> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const i = Number(k);
        if (i < index) next[i] = v;
        if (i > index) next[i - 1] = v;
      });
      return next;
    });
    if (openDatePicker?.rowIndex === index) setOpenDatePicker(null);
    else if (openDatePicker && openDatePicker.rowIndex > index)
      setOpenDatePicker({ ...openDatePicker, rowIndex: openDatePicker.rowIndex - 1 });
  };

  const updateRow = (index: number, patch: Partial<BulkCandidateRow>) => {
    setRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
    setRowErrors((prev) => {
      const next = { ...prev };
      if (next[index]) {
        const keys = Object.keys(patch) as FieldErrorKey[];
        keys.forEach((k) => delete next[index][k]);
        if (Object.keys(next[index]).length === 0) delete next[index];
      }
      return next;
    });
  };

  const hasAtLeastOneField = (row: BulkCandidateRow): boolean => {
    return (
      !!row.full_name_ar?.trim() ||
      !!row.full_name_en?.trim() ||
      !!row.nationality?.trim() ||
      !!row.passport_no?.trim() ||
      !!row.passport_expiry_at ||
      !!row.responsible_office?.trim() ||
      !!row.responsible_office_number?.trim() ||
      !!row.visa_deadline_at ||
      !!row.visa_sent_at ||
      !!row.expected_arrival_at ||
      !!row.passport_image_file_id ||
      !!row.visa_image_file_id ||
      !!row.flight_ticket_image_file_id ||
      !!row.personal_picture_file_id
    );
  };

  const validateRow = (row: BulkCandidateRow): Partial<Record<FieldErrorKey, string>> => {
    const err: Partial<Record<FieldErrorKey, string>> = {};
    if (!row.full_name_ar.trim()) err.full_name_ar = t("common.fullNameArRequired");
    if (!row.full_name_en?.trim()) err.full_name_en = t("common.fullNameEnRequired");
    if (!row.nationality.trim()) err.nationality = t("common.nationalityRequired");
    if (!row.passport_no.trim()) err.passport_no = t("common.passportNumberRequired");
    if (!row.passport_expiry_at) err.passport_expiry_at = t("common.passportExpiryDateRequired");
    if ((row.responsible_office_number?.length ?? 0) > 10)
      err.responsible_office_number = t("common.responsibleOfficeNumberMaxDigits");
    if (!row.responsible_office.trim()) err.responsible_office = t("common.responsibleOfficeRequired");
    if (!row.passport_image_file_id) err.passport_image_file_id = t("common.passportImageRequired");
    return err;
  };

  const handleClose = () => {
    setRows(Array.from({ length: INITIAL_ROW_COUNT }, createBlankRow));
    setRowErrors({});
    setSubmitError(null);
    setSuccessSummary(null);
    onClose();
  };

  const handleSubmit = async () => {
    setSubmitError(null);
    const nonEmptyRows = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => hasAtLeastOneField(row));

    if (nonEmptyRows.length === 0) {
      setSubmitError(t("recruitment.addAtLeastOneCandidate"));
      return;
    }

    const passportSet = new Set<string>();
    const duplicateIndices: number[] = [];
    for (const { row, index } of nonEmptyRows) {
      const no = row.passport_no?.trim() ?? "";
      if (no && passportSet.has(no)) duplicateIndices.push(index);
      if (no) passportSet.add(no);
    }
    if (duplicateIndices.length > 0) {
      const errors: Record<number, Partial<Record<FieldErrorKey, string>>> = {};
      duplicateIndices.forEach((i) => {
        errors[i] = { ...(rowErrors[i] ?? {}), passport_no: t("recruitment.duplicatePassportNumber") };
      });
      setRowErrors((prev) => ({ ...prev, ...errors }));
      setSubmitError(t("recruitment.fixErrorsInTable"));
      return;
    }

    const errors: Record<number, Partial<Record<FieldErrorKey, string>>> = {};
    let hasError = false;
    nonEmptyRows.forEach(({ row, index }) => {
      const rowErr = validateRow(row);
      if (Object.keys(rowErr).length > 0) {
        errors[index] = rowErr;
        hasError = true;
      }
    });
    if (hasError) {
      setRowErrors((prev) => ({ ...prev, ...errors }));
      setSubmitError(t("recruitment.fixErrorsInTable"));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        candidates: nonEmptyRows.map(({ row }) => ({
          full_name_ar: row.full_name_ar.trim(),
          full_name_en: row.full_name_en.trim(),
          nationality: row.nationality.trim(),
          passport_no: row.passport_no.trim(),
          passport_expiry_at: row.passport_expiry_at ?? undefined,
          responsible_office: row.responsible_office.trim(),
          responsible_office_number: row.responsible_office_number?.trim() || undefined,
          visa_deadline_at: row.visa_deadline_at || undefined,
          visa_sent_at: row.visa_sent_at || undefined,
          expected_arrival_at: row.expected_arrival_at || undefined,
          passport_image_file_id: row.passport_image_file_id ?? undefined,
          visa_image_file_id: row.visa_image_file_id ?? undefined,
          flight_ticket_image_file_id: row.flight_ticket_image_file_id ?? undefined,
          personal_picture_file_id: row.personal_picture_file_id ?? undefined,
        })),
      };
      const res = await fetch("/api/recruitment/candidates/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as { created?: number; message?: string } | null;
      if (!res.ok) {
        setSubmitError(data?.message ?? "Request failed");
        setSaving(false);
        return;
      }
      const count = typeof data?.created === "number" ? data.created : nonEmptyRows.length;
      setSuccessSummary(t("recruitment.candidatesCreated", { count }));
      router.refresh();
      setTimeout(handleClose, 1500);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  };

  const addRow = () => setRows((prev) => [...prev, createBlankRow()]);

  const getInputClass = (rowIndex: number, field: FieldErrorKey) => {
    const err = rowErrors[rowIndex]?.[field];
    const base = err ? INPUT_ERROR : INPUT_NEUTRAL;
    return `${INPUT_BASE} ${base}`;
  };

  const dir = locale === "ar" ? "rtl" : "ltr";

  const headerActionsEl = (
    <>
      <button
        type="button"
        onClick={addRow}
        className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      >
        {t("recruitment.addRow")}
      </button>
      <button
        type="button"
        onClick={handleClose}
        disabled={saving}
        className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-primary hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
      >
        {t("common.cancel")}
      </button>
      <button
        type="button"
        onClick={() => void handleSubmit()}
        disabled={saving}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
      >
        {saving ? t("common.saving") ?? "Saving..." : t("common.save")}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={t("recruitment.newCandidatesMultiple")}
      maxWidth="8xl"
      headerActions={headerActionsEl}
      contentClassName="p-0 flex flex-col min-h-0"
      modalClassName="min-h-[75vh]"
    >
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <div className="flex flex-col flex-1 min-h-0" dir={dir}>
          {successSummary && (
            <div className="shrink-0 rounded-none border-b border-green-200 bg-green-50 px-4 py-2 text-sm text-green-900 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
              {successSummary}
            </div>
          )}
          {submitError && (
            <div className="shrink-0 rounded-none border-b border-red-200 bg-red-50 px-4 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
              {submitError}
            </div>
          )}
          <div className="flex-1 overflow-auto min-h-0">
            <table className="min-w-full border-collapse border-0 border-b border-zinc-200 dark:border-zinc-700">
                <thead className="sticky top-0 z-[1] bg-primary/80 text-white dark:bg-zinc-800/80">
                  <tr className="border-b border-zinc-200 dark:border-zinc-700">
                    <th className="border-r border-zinc-200 py-1.5 px-1 text-start text-xs font-medium dark:border-zinc-700 w-8">
                      {" "}
                    </th>
                    <th className="border-r border-zinc-200 py-1.5 px-1 text-start text-xs font-medium dark:border-zinc-700">
                      {t("common.fullNameAr")} *
                    </th>
                    <th className="border-r border-zinc-200 py-1.5 px-1 text-start text-xs font-medium dark:border-zinc-700">
                      {t("common.fullNameEn")} *
                    </th>
                    <th className="border-r border-zinc-200 py-1.5 px-1 text-start text-xs font-medium dark:border-zinc-700">
                      {t("common.nationality")} *
                    </th>
                    <th className="border-r border-zinc-200 py-1.5 px-1 text-start text-xs font-medium dark:border-zinc-700">
                      {t("common.passportNo")} *
                    </th>
                    <th className="border-r border-zinc-200 py-1.5 px-1 text-start text-xs font-medium dark:border-zinc-700">
                      {t("common.passportExpiryDate")} *
                    </th>
                    <th className="border-r border-zinc-200 py-1.5 px-1 text-start text-xs font-medium dark:border-zinc-700">
                      {t("common.responsibleOffice")} *
                    </th>
                    <th className="border-r border-zinc-200 py-1.5 px-1 text-start text-xs font-medium dark:border-zinc-700">
                      {t("common.responsibleOfficeNumber")}
                    </th>
                    <th className="border-r border-zinc-200 py-1.5 px-1 text-start text-xs font-medium dark:border-zinc-700">
                      {t("common.visaSentDate")}
                    </th>
                    <th className="border-r border-zinc-200 py-1.5 px-1 text-start text-xs font-medium dark:border-zinc-700">
                      {t("common.visaDeadline")}
                    </th>
                    <th className="border-r border-zinc-200 py-1.5 px-1 text-start text-xs font-medium dark:border-zinc-700">
                      {t("common.expectedArrival")}
                    </th>
                    <th className="border-r border-zinc-200 py-1.5 px-1 text-start text-xs font-medium dark:border-zinc-700">
                      {t("common.passportImage")} *
                    </th>
                    <th className="border-r border-zinc-200 py-1.5 px-1 text-start text-xs font-medium dark:border-zinc-700">
                      {t("common.visaImage")}
                    </th>
                    <th className="border-r border-zinc-200 py-1.5 px-1 text-start text-xs font-medium dark:border-zinc-700">
                      {t("common.flightTicketImage")}
                    </th>
                    <th className="border-zinc-200 py-1.5 px-1 text-start text-xs font-medium dark:border-zinc-700">
                      {t("common.personalPicture")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-700">
                  {rows.map((row, index) => (
                    <tr key={index} className="bg-white dark:bg-zinc-800/30">
                      <td className="border-r border-zinc-200 p-1 align-top dark:border-zinc-700 w-8">
                        <button
                          type="button"
                          onClick={() => deleteRow(index)}
                          className="rounded p-1 text-primary/70 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                          aria-label={t("common.delete") || "Delete row"}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                      <td className="border-r border-zinc-200 p-1 align-top dark:border-zinc-700">
                        <input
                          value={row.full_name_ar}
                          onChange={(e) => updateRow(index, { full_name_ar: e.target.value })}
                          className={getInputClass(index, "full_name_ar")}
                        />
                        {rowErrors[index]?.full_name_ar && (
                          <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                            {rowErrors[index].full_name_ar}
                          </p>
                        )}
                      </td>
                      <td className="border-r border-zinc-200 p-1 align-top dark:border-zinc-700">
                        <input
                          value={row.full_name_en}
                          onChange={(e) => updateRow(index, { full_name_en: e.target.value })}
                          className={getInputClass(index, "full_name_en")}
                        />
                        {rowErrors[index]?.full_name_en && (
                          <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                            {rowErrors[index].full_name_en}
                          </p>
                        )}
                      </td>
                      <td className="border-r border-zinc-200 p-1 align-top dark:border-zinc-700 min-w-[120px]">
                        <NationalitySearchDropdown
                          value={row.nationality}
                          onChange={(v) => updateRow(index, { nationality: v })}
                          locale={locale as "ar" | "en"}
                          size="compact"
                          inputClassName={getInputClass(index, "nationality")}
                        />
                        {rowErrors[index]?.nationality && (
                          <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                            {rowErrors[index].nationality}
                          </p>
                        )}
                      </td>
                      <td className="border-r border-zinc-200 p-1 align-top dark:border-zinc-700">
                        <input
                          value={row.passport_no}
                          onChange={(e) => updateRow(index, { passport_no: e.target.value })}
                          className={getInputClass(index, "passport_no")}
                        />
                        {rowErrors[index]?.passport_no && (
                          <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                            {rowErrors[index].passport_no}
                          </p>
                        )}
                      </td>
                      <td className="border-r border-zinc-200 p-1 align-top dark:border-zinc-700 min-w-[100px]">
                        <button
                          type="button"
                          onClick={(e) => {
                            setOpenDatePicker({ rowIndex: index, field: "passport_expiry_at" });
                            setDatePickerAnchorEl(e.currentTarget);
                          }}
                          className={`w-full flex items-center gap-1 rounded border px-2 py-1.5 text-xs text-left ${
                            rowErrors[index]?.passport_expiry_at
                              ? "border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-900/20"
                              : "border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                          }`}
                        >
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          {formatDateButton(row.passport_expiry_at)}
                        </button>
                        {rowErrors[index]?.passport_expiry_at && (
                          <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                            {rowErrors[index].passport_expiry_at}
                          </p>
                        )}
                      </td>
                      <td className="border-r border-zinc-200 p-1 align-top dark:border-zinc-700">
                        <input
                          value={row.responsible_office}
                          onChange={(e) => updateRow(index, { responsible_office: e.target.value })}
                          className={getInputClass(index, "responsible_office")}
                        />
                        {rowErrors[index]?.responsible_office && (
                          <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                            {rowErrors[index].responsible_office}
                          </p>
                        )}
                      </td>
                      <td className="border-r border-zinc-200 p-1 align-top dark:border-zinc-700">
                        <input
                          type="tel"
                          inputMode="numeric"
                          maxLength={10}
                          value={row.responsible_office_number}
                          onChange={(e) => {
                            const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                            updateRow(index, { responsible_office_number: v });
                          }}
                          placeholder={t("common.responsibleOfficeNumberPlaceholder")}
                          className={getInputClass(index, "responsible_office_number")}
                        />
                        {rowErrors[index]?.responsible_office_number && (
                          <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                            {rowErrors[index].responsible_office_number}
                          </p>
                        )}
                      </td>
                      <td className="border-r border-zinc-200 p-1 align-top dark:border-zinc-700 min-w-[100px]">
                        <button
                          type="button"
                          onClick={(e) => {
                            setOpenDatePicker({ rowIndex: index, field: "visa_sent_at" });
                            setDatePickerAnchorEl(e.currentTarget);
                          }}
                          className="w-full flex items-center gap-1 rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-left hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                        >
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          {formatDateButton(row.visa_sent_at)}
                        </button>
                      </td>
                      <td className="border-r border-zinc-200 p-1 align-top dark:border-zinc-700 min-w-[100px]">
                        <button
                          type="button"
                          onClick={(e) => {
                            setOpenDatePicker({ rowIndex: index, field: "visa_deadline_at" });
                            setDatePickerAnchorEl(e.currentTarget);
                          }}
                          className="w-full flex items-center gap-1 rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-left hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                        >
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          {formatDateButton(row.visa_deadline_at)}
                        </button>
                      </td>
                      <td className="border-r border-zinc-200 p-1 align-top dark:border-zinc-700 min-w-[100px]">
                        <button
                          type="button"
                          onClick={(e) => {
                            setOpenDatePicker({ rowIndex: index, field: "expected_arrival_at" });
                            setDatePickerAnchorEl(e.currentTarget);
                          }}
                          className="w-full flex items-center gap-1 rounded border border-zinc-200 bg-white px-2 py-1.5 text-xs text-left hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                        >
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          {formatDateButton(row.expected_arrival_at)}
                        </button>
                      </td>
                      <td className="border-r border-zinc-200 p-1 align-top dark:border-zinc-700 min-w-[52px]">
                        <FileUpload
                          variant="iconButton"
                          icon={<FileImage className="h-4 w-4" />}
                          purpose_code="PASSPORT_IMAGE"
                          label={t("common.passportImage")}
                          required
                          instanceId={`row-${index}-passport`}
                          fileId={row.passport_image_file_id}
                          onFileIdChange={(id) =>
                            updateRow(index, { passport_image_file_id: id })
                          }
                        />
                        {rowErrors[index]?.passport_image_file_id && (
                          <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">
                            {rowErrors[index].passport_image_file_id}
                          </p>
                        )}
                      </td>
                      <td className="border-r border-zinc-200 p-1 align-top dark:border-zinc-700 min-w-[52px]">
                        <FileUpload
                          variant="iconButton"
                          icon={<FileText className="h-4 w-4" />}
                          purpose_code="VISA_IMAGE"
                          label={t("common.visaImage")}
                          instanceId={`row-${index}-visa`}
                          fileId={row.visa_image_file_id}
                          onFileIdChange={(id) =>
                            updateRow(index, { visa_image_file_id: id })
                          }
                        />
                      </td>
                      <td className="border-r border-zinc-200 p-1 align-top dark:border-zinc-700 min-w-[52px]">
                        <FileUpload
                          variant="iconButton"
                          icon={<Plane className="h-4 w-4" />}
                          purpose_code="FLIGHT_TICKET_IMAGE"
                          label={t("common.flightTicketImage")}
                          instanceId={`row-${index}-flight`}
                          fileId={row.flight_ticket_image_file_id}
                          onFileIdChange={(id) =>
                            updateRow(index, { flight_ticket_image_file_id: id })
                          }
                        />
                      </td>
                      <td className="border-zinc-200 p-1 align-top dark:border-zinc-700 min-w-[52px]">
                        <FileUpload
                          variant="iconButton"
                          icon={<User className="h-4 w-4" />}
                          purpose_code="PERSONAL_PICTURE"
                          label={t("common.personalPicture")}
                          instanceId={`row-${index}-picture`}
                          fileId={row.personal_picture_file_id}
                          onFileIdChange={(id) =>
                            updateRow(index, { personal_picture_file_id: id })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
          </div>

          <Popover
            open={!!openDatePicker && !!datePickerAnchorEl}
            anchorEl={datePickerAnchorEl}
            onClose={() => {
              setOpenDatePicker(null);
              setDatePickerAnchorEl(null);
            }}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
          >
            {openDatePicker && openDatePicker.rowIndex >= 0 && openDatePicker.rowIndex < rows.length && (
              <div className="p-2">
                <DateCalendar
                  value={
                    rows[openDatePicker.rowIndex]?.[openDatePicker.field]
                      ? dayjs(rows[openDatePicker.rowIndex][openDatePicker.field] as string)
                      : null
                  }
                  onChange={(date: Dayjs | null) => {
                    if (openDatePicker) {
                      updateRow(openDatePicker.rowIndex, {
                        [openDatePicker.field]: date ? date.toISOString() : null,
                      });
                      setOpenDatePicker(null);
                      setDatePickerAnchorEl(null);
                    }
                  }}
                />
              </div>
            )}
          </Popover>
        </div>
      </LocalizationProvider>
    </Modal>
  );
}
