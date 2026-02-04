"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import { FileImage, FileText, Plane, User } from "lucide-react";
import { FileUpload } from "./FileUpload";
import { Modal } from "./Modal";
import { NationalitySearchDropdown } from "./NationalitySearchDropdown";

interface RecruitmentAddModalProps {
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

type Candidate = {
  full_name_ar: string;
  full_name_en: string;
  nationality: string;
  passport_no: string;
  passport_expiry_at: string | null;
  job_title_code: string | null;
  status_code: string;
  responsible_office: string;
  responsible_office_number: string;
  visa_deadline_at: string | null;
  visa_sent_at: string | null;
  expected_arrival_at: string | null;
  notes: string | null;
  passport_image_file_id: string | null;
  visa_image_file_id: string | null;
  flight_ticket_image_file_id: string | null;
  personal_picture_file_id: string | null;
};

const INPUT_BASE = "mt-1 w-full rounded-md px-3 py-2 text-sm text-primary placeholder:text-primary/50";
const INPUT_ERROR = "border border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-900/20";
const INPUT_SUCCESS = "border border-green-500 bg-green-50 dark:border-green-600 dark:bg-green-900/20";
const INPUT_NEUTRAL = "border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900";
const FILE_CARD_ERROR = "border-2 border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-900/20";
const FILE_CARD_SUCCESS = "border-2 border-green-500 bg-green-50 dark:border-green-600 dark:bg-green-900/20";

export function RecruitmentAddModal({ isOpen, onClose, locale }: RecruitmentAddModalProps) {
  const router = useRouter();
  const t = useTranslations();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldErrorKey, string>>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const [candidate, setCandidate] = useState<Candidate>({
    full_name_ar: "",
    full_name_en: "",
    nationality: "",
    passport_no: "",
    passport_expiry_at: null,
    job_title_code: null,
    status_code: "UNDER_PROCEDURE",
    responsible_office: "",
    responsible_office_number: "",
    visa_deadline_at: null,
    visa_sent_at: null,
    expected_arrival_at: null,
    notes: null,
    passport_image_file_id: null,
    visa_image_file_id: null,
    flight_ticket_image_file_id: null,
    personal_picture_file_id: null,
  });

  const [fileIds, setFileIds] = useState<{
    passport: string | null;
    visa: string | null;
    flightTicket: string | null;
    personalPicture: string | null;
  }>({
    passport: null,
    visa: null,
    flightTicket: null,
    personalPicture: null,
  });

  const resetForm = () => {
    setCandidate({
      full_name_ar: "",
      full_name_en: "",
      nationality: "",
      passport_no: "",
      passport_expiry_at: null,
      job_title_code: null,
      status_code: "UNDER_PROCEDURE",
      responsible_office: "",
      responsible_office_number: "",
      visa_deadline_at: null,
      visa_sent_at: null,
      expected_arrival_at: null,
      notes: null,
      passport_image_file_id: null,
      visa_image_file_id: null,
      flight_ticket_image_file_id: null,
      personal_picture_file_id: null,
    });
    setFileIds({
      passport: null,
      visa: null,
      flightTicket: null,
      personalPicture: null,
    });
    setFieldErrors({});
    setSubmitError(null);
    setValidationAttempted(false);
    setSaving(false);
  };

  const getFieldState = (field: FieldErrorKey): "error" | "success" | "neutral" => {
    if (fieldErrors[field]) return "error";
    if (validationAttempted) {
      if (field === "responsible_office_number" && !(candidate.responsible_office_number?.trim() ?? "")) return "neutral";
      return "success";
    }
    return "neutral";
  };

  const getInputClassName = (field: FieldErrorKey): string => {
    const state = getFieldState(field);
    const border =
      state === "error" ? INPUT_ERROR : state === "success" ? INPUT_SUCCESS : INPUT_NEUTRAL;
    return `${INPUT_BASE} ${border}`;
  };

  const getFileUploadCardClassName = (field: FieldErrorKey): string | undefined => {
    const state = getFieldState(field);
    if (state === "error") return FILE_CARD_ERROR;
    if (state === "success") return FILE_CARD_SUCCESS;
    return undefined;
  };

  const clearFieldError = (field: FieldErrorKey) => {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const handleClose = () => {
    setShowLeaveConfirm(false);
    resetForm();
    onClose();
  };

  /** At least one field has a value (for draft save and dirty check) */
  const hasAtLeastOneField = () => {
    return (
      !!candidate.full_name_ar?.trim() ||
      !!candidate.full_name_en?.trim() ||
      !!candidate.nationality?.trim() ||
      !!candidate.passport_no?.trim() ||
      !!candidate.passport_expiry_at ||
      !!candidate.responsible_office?.trim() ||
      !!candidate.responsible_office_number?.trim() ||
      !!candidate.visa_deadline_at ||
      !!candidate.visa_sent_at ||
      !!candidate.expected_arrival_at ||
      !!candidate.notes?.trim() ||
      !!fileIds.passport ||
      !!fileIds.visa ||
      !!fileIds.flightTicket ||
      !!fileIds.personalPicture
    );
  };

  const handleRequestClose = () => {
    if (hasAtLeastOneField()) {
      setShowLeaveConfirm(true);
    } else {
      handleClose();
    }
  };

  const onSaveAsDraft = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();
    if (!hasAtLeastOneField()) {
      setSubmitError(t("common.atLeastOneFieldRequired") ?? "At least one field is required to save as draft");
      return;
    }
    setSaving(true);
    setSubmitError(null);
    try {
      const payload = {
        status_code: "DRAFT",
        full_name_ar: candidate.full_name_ar?.trim() ?? "",
        full_name_en: candidate.full_name_en?.trim() ?? "",
        nationality: candidate.nationality?.trim() ?? "",
        passport_no: candidate.passport_no?.trim() ?? "",
        passport_expiry_at: candidate.passport_expiry_at || undefined,
        job_title_code: candidate.job_title_code || undefined,
        responsible_office: candidate.responsible_office?.trim() ?? "",
        responsible_office_number: candidate.responsible_office_number?.trim() || undefined,
        visa_deadline_at: candidate.visa_deadline_at || undefined,
        visa_sent_at: candidate.visa_sent_at || undefined,
        expected_arrival_at: candidate.expected_arrival_at || undefined,
        notes: candidate.notes?.trim() || undefined,
        passport_image_file_id: fileIds.passport || undefined,
        visa_image_file_id: fileIds.visa || undefined,
        flight_ticket_image_file_id: fileIds.flightTicket || undefined,
        personal_picture_file_id: fileIds.personalPicture || undefined,
      };
      const res = await fetch(`/api/recruitment/candidates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as { message?: string };
      if (!res.ok) {
        setSubmitError(data?.message ?? "Save failed");
        setSaving(false);
        return;
      }
      handleClose();
      router.refresh();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  };

  const validate = (): Partial<Record<FieldErrorKey, string>> => {
    const err: Partial<Record<FieldErrorKey, string>> = {};
    if (!candidate.full_name_ar.trim()) err.full_name_ar = t("common.fullNameArRequired");
    if (!candidate.full_name_en?.trim()) err.full_name_en = t("common.fullNameEnRequired");
    if (!candidate.nationality.trim()) err.nationality = t("common.nationalityRequired");
    if (!candidate.passport_no.trim()) err.passport_no = t("common.passportNumberRequired");
    if (!candidate.passport_expiry_at) err.passport_expiry_at = t("common.passportExpiryDateRequired");
    if ((candidate.responsible_office_number?.length ?? 0) > 10)
      err.responsible_office_number = t("common.responsibleOfficeNumberMaxDigits");
    if (!candidate.responsible_office.trim()) err.responsible_office = t("common.responsibleOfficeRequired");
    if (!fileIds.passport) err.passport_image_file_id = t("common.passportImageRequired");
    return err;
  };

  const onSave = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();

    setSaving(true);
    setSubmitError(null);
    const errors = validate();
    setFieldErrors(errors);
    setValidationAttempted(true);

    if (Object.keys(errors).length > 0) {
      setSaving(false);
      return;
    }

    try {
      const payload = {
        full_name_ar: candidate.full_name_ar.trim(),
        full_name_en: candidate.full_name_en.trim(),
        nationality: candidate.nationality.trim(),
        passport_no: candidate.passport_no.trim(),
        passport_expiry_at: candidate.passport_expiry_at || undefined,
        job_title_code: candidate.job_title_code || undefined,
        responsible_office: candidate.responsible_office.trim(),
        responsible_office_number: candidate.responsible_office_number.trim() || undefined,
        visa_deadline_at: candidate.visa_deadline_at || undefined,
        visa_sent_at: candidate.visa_sent_at || undefined,
        expected_arrival_at: candidate.expected_arrival_at || undefined,
        notes: candidate.notes || undefined,
        passport_image_file_id: fileIds.passport || undefined,
        visa_image_file_id: fileIds.visa || undefined,
        flight_ticket_image_file_id: fileIds.flightTicket || undefined,
        personal_picture_file_id: fileIds.personalPicture || undefined,
      };

      const res = await fetch(`/api/recruitment/candidates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => null)) as { message?: string };
      if (!res.ok) {
        setSubmitError(data?.message ?? "Save failed");
        setSaving(false);
        return;
      }
      handleClose();
      router.refresh();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleRequestClose} title={t("common.newCandidate")}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm text-primary">{t("common.fullNameAr")} *</label>
            <input
              value={candidate.full_name_ar}
              onChange={(e) => {
                setCandidate({ ...candidate, full_name_ar: e.target.value });
                clearFieldError("full_name_ar");
              }}
              required
              className={getInputClassName("full_name_ar")}
            />
            {fieldErrors.full_name_ar && (
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{fieldErrors.full_name_ar}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-primary">{t("common.fullNameEn")} *</label>
            <input
              value={candidate.full_name_en}
              onChange={(e) => {
                setCandidate({ ...candidate, full_name_en: e.target.value });
                clearFieldError("full_name_en");
              }}
              required
              className={getInputClassName("full_name_en")}
            />
            {fieldErrors.full_name_en && (
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{fieldErrors.full_name_en}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-primary">{t("common.nationality")} *</label>
            <NationalitySearchDropdown
              value={candidate.nationality}
              onChange={(v) => {
                setCandidate({ ...candidate, nationality: v });
                clearFieldError("nationality");
              }}
              locale={locale as "ar" | "en"}
              required
              inputClassName={getInputClassName("nationality")}
            />
            {fieldErrors.nationality && (
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{fieldErrors.nationality}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-primary">{t("common.passportNo")} *</label>
            <input
              value={candidate.passport_no}
              onChange={(e) => {
                setCandidate({ ...candidate, passport_no: e.target.value });
                clearFieldError("passport_no");
              }}
              required
              className={getInputClassName("passport_no")}
            />
            {fieldErrors.passport_no && (
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{fieldErrors.passport_no}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-primary">{t("common.passportExpiryDate")} *</label>
            <div className="mt-1">
              <DatePicker
                value={candidate.passport_expiry_at ? dayjs(candidate.passport_expiry_at) : null}
                onChange={(date: Dayjs | null) => {
                  setCandidate({
                    ...candidate,
                    passport_expiry_at: date ? date.toISOString() : null,
                  });
                  clearFieldError("passport_expiry_at");
                }}
                slotProps={{
                  textField: {
                    size: "small",
                    className: "w-full",
                    sx: (() => {
                      const state = getFieldState("passport_expiry_at");
                      return {
                        "& .MuiOutlinedInput-root": {
                          fontSize: "0.875rem",
                          color: "inherit",
                          backgroundColor: state === "error" ? "rgb(254 242 242)" : state === "success" ? "rgb(240 253 244)" : isDark ? "rgb(24 24 27)" : "white",
                          "& fieldset": {
                            borderColor:
                              state === "error"
                                ? "rgb(239 68 68)"
                                : state === "success"
                                  ? "rgb(34 197 94)"
                                  : isDark
                                    ? "rgb(63 63 70)"
                                    : "rgb(228 228 231)",
                          },
                          "&:hover fieldset": {
                            borderColor:
                              state === "error"
                                ? "rgb(239 68 68)"
                                : state === "success"
                                  ? "rgb(34 197 94)"
                                  : isDark
                                    ? "rgb(82 82 91)"
                                    : "rgb(161 161 170)",
                          },
                          "&.Mui-focused fieldset": {
                            borderColor:
                              state === "error"
                                ? "rgb(239 68 68)"
                                : state === "success"
                                  ? "rgb(34 197 94)"
                                  : isDark
                                    ? "rgb(82 82 91)"
                                    : "rgb(161 161 170)",
                          },
                          ...(isDark && (state === "error" || state === "success")
                            ? { backgroundColor: state === "error" ? "rgba(127, 29, 29, 0.2)" : "rgba(22, 101, 52, 0.2)" }
                            : {}),
                        },
                      };
                    })(),
                  },
                }}
              />
            </div>
            {fieldErrors.passport_expiry_at && (
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{fieldErrors.passport_expiry_at}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-primary">{t("common.responsibleOffice")} *</label>
            <input
              value={candidate.responsible_office}
              onChange={(e) => {
                setCandidate({ ...candidate, responsible_office: e.target.value });
                clearFieldError("responsible_office");
              }}
              required
              className={getInputClassName("responsible_office")}
            />
            {fieldErrors.responsible_office && (
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{fieldErrors.responsible_office}</p>
            )}
          </div>
          <div>
            <label className="text-sm text-primary">{t("common.responsibleOfficeNumber")}</label>
            <input
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={candidate.responsible_office_number}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 10);
                setCandidate({ ...candidate, responsible_office_number: v });
                clearFieldError("responsible_office_number");
              }}
              placeholder={t("common.responsibleOfficeNumberPlaceholder")}
              className={getInputClassName("responsible_office_number")}
            />
            {fieldErrors.responsible_office_number && (
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{fieldErrors.responsible_office_number}</p>
            )}
          </div>
          
          <div>
            <label className="text-sm text-primary">{t("common.visaSentDate")}</label>
            <div className="mt-1">
              <DatePicker
                value={candidate.visa_sent_at ? dayjs(candidate.visa_sent_at) : null}
                onChange={(date: Dayjs | null) => {
                  setCandidate({
                    ...candidate,
                    visa_sent_at: date ? date.toISOString() : null,
                  });
                }}
                slotProps={{
                  textField: {
                    size: "small",
                    className: "w-full",
                    sx: {
                      "& .MuiOutlinedInput-root": {
                        fontSize: "0.875rem",
                        color: "inherit",
                        backgroundColor: isDark ? "rgb(24 24 27)" : "white",
                        "& fieldset": {
                          borderColor: isDark ? "rgb(63 63 70)" : "rgb(228 228 231)",
                        },
                        "&:hover fieldset": {
                          borderColor: isDark ? "rgb(82 82 91)" : "rgb(161 161 170)",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: isDark ? "rgb(82 82 91)" : "rgb(161 161 170)",
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-primary">{t("common.visaDeadline")}</label>
            <div className="mt-1">
              <DatePicker
                value={candidate.visa_deadline_at ? dayjs(candidate.visa_deadline_at) : null}
                onChange={(date: Dayjs | null) => {
                  setCandidate({
                    ...candidate,
                    visa_deadline_at: date ? date.toISOString() : null,
                  });
                }}
                slotProps={{
                  textField: {
                    size: "small",
                    className: "w-full",
                    sx: {
                      "& .MuiOutlinedInput-root": {
                        fontSize: "0.875rem",
                        color: "inherit",
                        backgroundColor: isDark ? "rgb(24 24 27)" : "white",
                        "& fieldset": {
                          borderColor: isDark ? "rgb(63 63 70)" : "rgb(228 228 231)",
                        },
                        "&:hover fieldset": {
                          borderColor: isDark ? "rgb(82 82 91)" : "rgb(161 161 170)",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: isDark ? "rgb(82 82 91)" : "rgb(161 161 170)",
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>

          
          <div>
            <label className="text-sm text-primary">{t("common.expectedArrival")}</label>
            <div className="mt-1">
              <DatePicker
                value={candidate.expected_arrival_at ? dayjs(candidate.expected_arrival_at) : null}
                onChange={(date: Dayjs | null) => {
                  setCandidate({
                    ...candidate,
                    expected_arrival_at: date ? date.toISOString() : null,
                  });
                }}
                slotProps={{
                  textField: {
                    size: "small",
                    className: "w-full",
                    sx: {
                      "& .MuiOutlinedInput-root": {
                        fontSize: "0.875rem",
                        color: "inherit",
                        backgroundColor: isDark ? "rgb(24 24 27)" : "white",
                        "& fieldset": {
                          borderColor: isDark ? "rgb(63 63 70)" : "rgb(228 228 231)",
                        },
                        "&:hover fieldset": {
                          borderColor: isDark ? "rgb(82 82 91)" : "rgb(161 161 170)",
                        },
                        "&.Mui-focused fieldset": {
                          borderColor: isDark ? "rgb(82 82 91)" : "rgb(161 161 170)",
                        },
                      },
                    },
                  },
                }}
              />
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm text-primary">{t("common.notes")}</label>
            <textarea
              value={candidate.notes ?? ""}
              onChange={(e) => setCandidate({ ...candidate, notes: e.target.value || null })}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900"
              rows={4}
            />
          </div>
          <div className="sm:col-span-2">
            <div className="grid grid-cols-4 gap-4">
              <div>
                <FileUpload
                  variant="card"
                  icon={<FileImage />}
                  purpose_code="PASSPORT_IMAGE"
                  label={t("common.passportImage")}
                  required
                  fileId={fileIds.passport}
                  onFileIdChange={(id) => {
                    setFileIds((prev) => ({ ...prev, passport: id }));
                    clearFieldError("passport_image_file_id");
                  }}
                  wrapperClassName={getFileUploadCardClassName("passport_image_file_id")}
                />
                {fieldErrors.passport_image_file_id && (
                  <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{fieldErrors.passport_image_file_id}</p>
                )}
              </div>
              <FileUpload
                variant="card"
                icon={<FileText />}
                purpose_code="VISA_IMAGE"
                label={t("common.visaImage")}
                fileId={fileIds.visa}
                onFileIdChange={(id) => setFileIds((prev) => ({ ...prev, visa: id }))}
              />
              <FileUpload
                variant="card"
                icon={<Plane />}
                purpose_code="FLIGHT_TICKET_IMAGE"
                label={t("common.flightTicketImage")}
                fileId={fileIds.flightTicket}
                onFileIdChange={(id) => setFileIds((prev) => ({ ...prev, flightTicket: id }))}
              />
              <FileUpload
                variant="card"
                icon={<User />}
                purpose_code="PERSONAL_PICTURE"
                label={t("common.personalPicture")}
                fileId={fileIds.personalPicture}
                onFileIdChange={(id) => setFileIds((prev) => ({ ...prev, personalPicture: id }))}
              />
            </div>
          </div>
        </div>

        {showLeaveConfirm && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              aria-hidden
              onClick={() => setShowLeaveConfirm(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="unsaved-changes-title"
              className="relative z-10 w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-800 mx-4"
            >
              <h3 id="unsaved-changes-title" className="text-base font-semibold text-primary mb-2">
                {t("common.unsavedChangesDraft")}
              </h3>
              <div className="flex flex-wrap gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => void onSaveAsDraft()}
                  disabled={saving}
                  className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
                >
                  {saving ? t("common.saving") || "Saving..." : t("common.saveAsDraft")}
                </button>
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={saving}
                  className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-primary hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                >
                  {t("common.discard")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLeaveConfirm(false)}
                  disabled={saving}
                  className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-primary hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          </div>
        )}

        {submitError && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
            {submitError}
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-primary hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onSaveAsDraft}
            disabled={saving}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-primary hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            {t("common.saveAsDraft")}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {saving ? t("common.saving") || "Saving..." : t("common.save")}
          </button>
        </div>
      </div>
      </LocalizationProvider>
    </Modal>
  );
}

