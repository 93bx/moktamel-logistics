"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import { Modal } from "./Modal";
import { FileUpload } from "./FileUpload";
import { NationalitySearchDropdown } from "./NationalitySearchDropdown";
import { FileImage } from "lucide-react";

function getAgeFromDateOfBirth(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age >= 0 ? age : null;
}

interface EmploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
  employmentId?: string; // If provided, we are in Edit mode
  recruitmentCandidateId?: string | null; // When provided, prefill from Recruitment candidate
}

type FieldErrorKey =
  | "full_name_ar"
  | "full_name_en"
  | "nationality"
  | "employment_source"
  | "phone"
  | "passport_no"
  | "passport_expiry_at";

type Employment = {
  id?: string;
  recruitment_candidate_id: string | null;
  employment_source: string | null;
  employee_no: string | null;
  employee_code: string | null;
  full_name_ar: string | null;
  full_name_en: string | null;
  nationality: string | null;
  phone: string | null;
  date_of_birth: string | null;
  iqama_no: string | null;
  iqama_expiry_at: string | null;
  iqama_file_id: string | null;
  passport_no: string | null;
  passport_expiry_at: string | null;
  passport_file_id: string | null;
  contract_no: string | null;
  contract_end_at: string | null;
  contract_file_id: string | null;
  license_expiry_at: string | null;
  license_file_id: string | null;
  promissory_note_file_id: string | null;
  avatar_file_id: string | null;
  status_code: string;
  salary_amount: string | null;
  salary_currency_code: string | null;
  assigned_platform: string | null;
  platform_user_no: string | null;
  job_type: string | null;
  monthly_orders_target: number | null;
  monthly_target_amount: string | null;
  notes?: string | null;
  assets?: Array<{ id: string; asset: { type: string; name: string } }>;
  extra_documents?: Array<{ id: string; document_name: string; expiry_at: string | null; file_id: string | null }>;
};

const INITIAL_RECORD: Employment = {
  recruitment_candidate_id: null,
  employment_source: null,
  employee_no: null,
  employee_code: null,
  full_name_ar: null,
  full_name_en: null,
  nationality: null,
  phone: null,
  date_of_birth: null,
  iqama_no: null,
  iqama_expiry_at: null,
  iqama_file_id: null,
  passport_no: null,
  passport_expiry_at: null,
  passport_file_id: null,
  contract_no: null,
  contract_end_at: null,
  contract_file_id: null,
  license_expiry_at: null,
  license_file_id: null,
  promissory_note_file_id: null,
  avatar_file_id: null,
  status_code: "EMPLOYMENT_STATUS_UNDER_PROCEDURE",
  salary_amount: null,
  salary_currency_code: "SAR",
  assigned_platform: null,
  platform_user_no: null,
  job_type: null,
  monthly_orders_target: null,
  monthly_target_amount: null,
};

const INPUT_BASE = "mt-1 w-full rounded-md px-3 py-2 text-sm text-primary placeholder:text-primary/50";
const INPUT_ERROR = "border border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-900/20";
const INPUT_SUCCESS = "border border-green-500 bg-green-50 dark:border-green-600 dark:bg-green-900/20";
const INPUT_NEUTRAL = "border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900";

function phoneToNineDigits(phone: string | null | undefined): string {
  if (phone == null) return "";
  const digits = String(phone).replace(/\D/g, "").slice(-9);
  return digits.length === 9 ? digits : String(phone).replace(/\D/g, "").slice(0, 9);
}

export function EmploymentModal({ isOpen, onClose, locale, employmentId, recruitmentCandidateId }: EmploymentModalProps) {
  const router = useRouter();
  const t = useTranslations();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldErrorKey, string>>>({});
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [record, setRecord] = useState<Employment>(INITIAL_RECORD);
  const [extraDocuments, setExtraDocuments] = useState<Array<{ id: string; document_name: string; expiry_at: string | null; file_id: string | null }>>([]);
  const [payrollConfig, setPayrollConfig] = useState<{ minimum_salary: number; calculation_method: string } | null>(null);

  const getFieldState = (field: FieldErrorKey): "error" | "success" | "neutral" => {
    if (fieldErrors[field]) return "error";
    if (validationAttempted) return "success";
    return "neutral";
  };

  const getInputClassName = (field: FieldErrorKey): string => {
    const state = getFieldState(field);
    const border =
      state === "error" ? INPUT_ERROR : state === "success" ? INPUT_SUCCESS : INPUT_NEUTRAL;
    return `${INPUT_BASE} ${border}`;
  };

  const clearFieldError = (field: FieldErrorKey) => {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const validateStep = (s: 1 | 2 | 3): Partial<Record<FieldErrorKey, string>> => {
    const err: Partial<Record<FieldErrorKey, string>> = {};
    if (s === 1) {
      if (!(record.full_name_ar?.trim() ?? "")) err.full_name_ar = t("common.fullNameArRequired");
      if (!(record.full_name_en?.trim() ?? "")) err.full_name_en = t("common.fullNameEnRequired");
      if (!(record.nationality?.trim() ?? "")) err.nationality = t("common.nationalityRequired");
      const phoneDigits = (record.phone ?? "").replace(/\D/g, "");
      if (phoneDigits.length !== 9) err.phone = t("employment.phoneMustBe9Digits");
      if (!record.recruitment_candidate_id && !(record.employment_source?.trim() ?? "")) {
        err.employment_source = t("employment.employmentSourceRequired");
      }
    }
    if (s === 2) {
      if (!(record.passport_no?.trim() ?? "")) err.passport_no = t("common.passportNumberRequired");
      if (!record.passport_expiry_at) err.passport_expiry_at = t("common.passportExpiryDateRequired");
    }
    return err;
  };

  useEffect(() => {
    if (!isOpen) return;
    setSaving(false);
    setError(null);
    setFieldErrors({});
    setValidationAttempted(false);
    setExtraDocuments([]);

    if (employmentId) {
      setLoading(true);
      fetch(`/api/employment/${employmentId}`)
        .then((res) => res.json())
        .then((data) => {
          const rec = { ...data, phone: phoneToNineDigits(data.phone) };
          setRecord(rec);
          setExtraDocuments(
            (data.extra_documents ?? []).map((d: { id: string; document_name: string; expiry_at: string | null; file_id: string | null }) => ({
              id: d.id,
              document_name: d.document_name,
              expiry_at: d.expiry_at ?? null,
              file_id: d.file_id ?? null,
            }))
          );
          setLoading(false);
        })
        .catch(() => {
          setError("Failed to load record");
          setLoading(false);
        });
      return;
    }

    if (recruitmentCandidateId) {
      setLoading(true);
      fetch(`/api/recruitment/${recruitmentCandidateId}`)
        .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
        .then(({ ok, data: candidate }) => {
          if (!ok || !candidate?.id) throw new Error("Failed to load candidate");
          const passportFile = candidate.files?.find((f: { purpose_code: string }) => f.purpose_code === "passport");
          setRecord({
            ...INITIAL_RECORD,
            recruitment_candidate_id: candidate.id,
            employment_source: "RECRUITMENT",
            full_name_ar: candidate.full_name_ar ?? null,
            full_name_en: candidate.full_name_en ?? null,
            nationality: candidate.nationality ?? null,
            passport_no: candidate.passport_no ?? null,
            passport_expiry_at: candidate.passport_expiry_at ?? null,
            passport_file_id: passportFile?.file_id ?? null,
            phone: phoneToNineDigits(candidate.phone),
            date_of_birth: candidate.date_of_birth ?? null,
          });
          setStep(1);
          setLoading(false);
        })
        .catch(() => {
          setError("Failed to load candidate");
          setLoading(false);
        });
      return;
    }

    setRecord(INITIAL_RECORD);
    setStep(1);
    setLoading(false);
  }, [isOpen, employmentId, recruitmentCandidateId]);

  useEffect(() => {
    if (!isOpen) return;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    fetch(`/api/payroll-config/config?year=${year}&month=${month}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.minimum_salary != null || data?.calculation_method)
          setPayrollConfig({
            minimum_salary: Number(data.minimum_salary ?? 0),
            calculation_method: data.calculation_method ?? "ORDERS_COUNT",
          });
      })
      .catch(() => { });
  }, [isOpen]);

  const handleClose = () => {
    setStep(1);
    setError(null);
    setFieldErrors({});
    setValidationAttempted(false);
    setSaving(false);
    setLoading(false);
    onClose();
  };

  const onSave = async (overrideStatus?: string) => {
    setError(null);
    const isDraft = overrideStatus === "EMPLOYMENT_STATUS_DRAFT";
    if (!isDraft) {
      const s1 = validateStep(1);
      const s2 = validateStep(2);
      const allErrors: Partial<Record<FieldErrorKey, string>> = { ...s1, ...s2 };
      setFieldErrors(allErrors);
      setValidationAttempted(true);
      if (Object.keys(allErrors).length > 0) {
        const firstStepWithError = s1 && Object.keys(s1).length > 0 ? 1 : 2;
        setStep(firstStepWithError);
        return;
      }
    }

    setSaving(true);

    const isEdit = !!employmentId;
    const url = isEdit ? `/api/employment/${employmentId}` : `/api/employment/new`;
    const method = isEdit ? "PATCH" : "POST";

    const payload = {
      recruitment_candidate_id: record.recruitment_candidate_id,
      employment_source: record.recruitment_candidate_id ? "RECRUITMENT" : (record.employment_source || null),
      employee_no: record.employee_no || null,
      employee_code: record.employee_code || null,
      full_name_ar: record.full_name_ar || null,
      full_name_en: record.full_name_en || null,
      nationality: record.nationality || null,
      phone: (record.phone ?? "").replace(/\D/g, "").slice(0, 9) || null,
      date_of_birth: record.date_of_birth || null,
      iqama_no: record.iqama_no || null,
      iqama_expiry_at: record.iqama_expiry_at || null,
      iqama_file_id: record.iqama_file_id || null,
      passport_no: record.passport_no || null,
      passport_expiry_at: record.passport_expiry_at || null,
      passport_file_id: record.passport_file_id || null,
      contract_no: record.contract_no || null,
      contract_end_at: record.contract_end_at || null,
      contract_file_id: record.contract_file_id || null,
      license_expiry_at: record.license_expiry_at || null,
      license_file_id: record.license_file_id || null,
      promissory_note_file_id: record.promissory_note_file_id || null,
      avatar_file_id: record.avatar_file_id || null,
      ...(overrideStatus !== undefined && { status_code: overrideStatus }),
      salary_amount: record.salary_amount ? Number(record.salary_amount) : null,
      salary_currency_code: record.salary_currency_code || "SAR",
      assigned_platform: record.assigned_platform || null,
      platform_user_no: record.platform_user_no || null,
      job_type: record.job_type || null,
      monthly_orders_target: record.monthly_orders_target ?? null,
      monthly_target_amount: record.monthly_target_amount ? Number(record.monthly_target_amount) : null,
      extra_documents: extraDocuments.slice(0, 2).map((d) => ({
        document_name: d.document_name,
        expiry_at: d.expiry_at || null,
        file_id: d.file_id || null,
      })),
      notes: record.notes || null,
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Save failed");
        setSaving(false);
        return;
      }

      handleClose();
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
      setSaving(false);
    }
  };

  const renderStep1 = () => {
    const age = getAgeFromDateOfBirth(record.date_of_birth);
    return (
      <div className="space-y-4">
        <div className="flex items-end gap-4">
          <div className="w-min">
            {record.avatar_file_id ? (
              <div className="relative inline-block">
                <div className="h-24 w-24 rounded-full overflow-hidden border-2 border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800">
                  <img
                    src={`/api/files/${record.avatar_file_id}/view`}
                    alt={t("common.avatar")}
                    className="h-full w-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setRecord({ ...record, avatar_file_id: null })}
                  className="absolute -top-1 -right-1 rounded-full bg-red-500 text-white p-1 hover:bg-red-600"
                  aria-label={t("common.remove")}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <FileUpload
                purpose_code="avatar"
                label={t("common.avatar")}
                fileId={record.avatar_file_id}
                onFileIdChange={(id) => setRecord({ ...record, avatar_file_id: id })}
                variant="card"
                icon={<FileImage className="h-8 w-8" />}
                wrapperClassName="flex flex-col items-center justify-center p-6 rounded-full border-2 border-dashed border-zinc-300 hover:border-zinc-400 dark:border-zinc-600 dark:hover:border-zinc-500 min-h-[96px] w-[96px]"
              />
            )}
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium text-primary">{t("common.employeeCode")}</label>
            <input
              value={record.employee_code ?? ""}
              onChange={(e) => setRecord({ ...record, employee_code: e.target.value })}
              placeholder="Auto-generated if empty"
              className={`${INPUT_BASE} ${INPUT_NEUTRAL}`}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-primary">{t("common.fullNameAr")} *</label>
            <input
              value={record.full_name_ar ?? ""}
              onChange={(e) => {
                setRecord({ ...record, full_name_ar: e.target.value });
                clearFieldError("full_name_ar");
              }}
              className={getInputClassName("full_name_ar")}
            />
            {fieldErrors.full_name_ar && (
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{fieldErrors.full_name_ar}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-primary">{t("common.fullNameEn")} *</label>
            <input
              value={record.full_name_en ?? ""}
              onChange={(e) => {
                setRecord({ ...record, full_name_en: e.target.value });
                clearFieldError("full_name_en");
              }}
              className={getInputClassName("full_name_en")}
            />
            {fieldErrors.full_name_en && (
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{fieldErrors.full_name_en}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-primary">{t("common.nationality")} *</label>
            <NationalitySearchDropdown
              value={record.nationality ?? ""}
              onChange={(v) => {
                setRecord({ ...record, nationality: v || null });
                clearFieldError("nationality");
              }}
              locale={locale as "ar" | "en"}
              inputClassName={getInputClassName("nationality")}
            />
            {fieldErrors.nationality && (
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{fieldErrors.nationality}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-primary">{t("common.phoneNumber")} *</label>
            <div className="flex items-center gap-1 mt-1 items-end">
              <span className="inline-flex rounded-md border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-primary/70 dark:border-zinc-700 dark:bg-zinc-800">+966</span>
              <input
                inputMode="numeric"
                maxLength={9}
                value={record.phone ?? ""}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 9);
                  setRecord({ ...record, phone: v });
                  clearFieldError("phone");
                }}
                placeholder="512345678"
                className={`flex-1 ${getInputClassName("phone")}`}
              />
            </div>
            {fieldErrors.phone && (
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{fieldErrors.phone}</p>
            )}
          </div>
          <div>
            <label className="text-sm font-medium text-primary">{t("common.dateOfBirth")}</label>
            <div className="flex items-center gap-2 mt-1">
              <DatePicker
                value={record.date_of_birth ? dayjs(record.date_of_birth) : null}
                onChange={(date: Dayjs | null) =>
                  setRecord({ ...record, date_of_birth: date ? date.toISOString() : null })
                }
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
                      },
                    },
                  },
                }}
              />
              {age != null && (
                <span className="text-sm text-primary/70 whitespace-nowrap">
                  ({t("common.age")}: {age})
                </span>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-primary">{t("employment.employmentSource")} *</label>
            {record.recruitment_candidate_id ? (
              <input
                readOnly
                value={t("employment.employmentSourceRecruitment")}
                className={`${INPUT_BASE} ${INPUT_NEUTRAL} bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed`}
              />
            ) : (
              <>
                <select
                  value={record.employment_source ?? ""}
                  onChange={(e) => {
                    setRecord({ ...record, employment_source: e.target.value || null });
                    clearFieldError("employment_source");
                  }}
                  className={getInputClassName("employment_source")}
                >
                  <option value="">{t("common.select")}</option>
                  <option value="AJEEER_CONTRACT">{t("employment.employmentSourceAjeer")}</option>
                  <option value="WITHIN_KINGDOM">{t("employment.employmentSourceWithinKingdom")}</option>
                </select>
                {fieldErrors.employment_source && (
                  <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{fieldErrors.employment_source}</p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderStep2 = () => {
    const passportFilled = !!(record.passport_no?.trim() || record.passport_expiry_at || record.passport_file_id);
    const iqamaFilled = !!(record.iqama_no?.trim() || record.iqama_expiry_at || record.iqama_file_id);
    const contractFilled = !!(record.contract_no?.trim() || record.contract_end_at || record.contract_file_id);
    const licenseFilled = !!(record.license_expiry_at || record.license_file_id);
    const promissoryFilled = !!record.promissory_note_file_id;
    return (
      <div className="space-y-10">
        <div className="flex gap-2">
          <div className="flex relative w-1/2 gap-2 border border-primary rounded-md p-2 dark:border-zinc-800">
            <div className={`rounded absolute top-[-21%] left-[-0.1%] px-2 py-1 ${passportFilled ? "bg-primary text-white" : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"}`}>
              <p className="text-medium">{t("common.passport")}</p>
            </div>

            <div className="w-full">
              <div>
                <label className="text-sm font-medium text-primary">{t("common.passportNumber")} *</label>
                <input
                  value={record.passport_no ?? ""}
                  onChange={(e) => {
                    setRecord({ ...record, passport_no: e.target.value });
                    clearFieldError("passport_no");
                  }}
                  className={getInputClassName("passport_no")}
                />
                {fieldErrors.passport_no && (
                  <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{fieldErrors.passport_no}</p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium text-primary">{t("common.passport")} {t("common.expiry") || "Expiry"} *</label>
                <div className="mt-1">
                  <DatePicker
                    value={record.passport_expiry_at ? dayjs(record.passport_expiry_at) : null}
                    onChange={(date: Dayjs | null) => {
                      setRecord({ ...record, passport_expiry_at: date ? date.toISOString() : null });
                      clearFieldError("passport_expiry_at");
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
                            "& fieldset": { borderColor: isDark ? "rgb(63 63 70)" : "rgb(228 228 231)" },
                          },
                        },
                      },
                    }}
                  />
                </div>
                {fieldErrors.passport_expiry_at && (
                  <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{fieldErrors.passport_expiry_at}</p>
                )}
              </div>
            </div>

            <div className="w-1/2">
              <FileUpload
                purpose_code="passport"
                label={t("common.passportImage")}
                fileId={record.passport_file_id}
                onFileIdChange={(id) => setRecord({ ...record, passport_file_id: id })}
              />
            </div>
          </div>

          <div className="flex relative w-1/2 gap-2 border border-primary rounded-md p-2 dark:border-zinc-800">
            <div className={`rounded absolute top-[-21%] left-[-0.1%] px-2 py-1 ${iqamaFilled ? "bg-primary text-white" : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"}`}>
              <p className="text-medium">{t("common.iqama")}</p>
            </div>

            <div className="w-full">
              <div>
                <label className="text-sm font-medium text-primary">{t("common.iqamaNumber")}</label>
                <input
                  value={record.iqama_no ?? ""}
                  onChange={(e) => setRecord({ ...record, iqama_no: e.target.value })}
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-primary">{t("common.iqamaExpiry")}</label>
                <div className="mt-1">
                  <DatePicker
                    value={record.iqama_expiry_at ? dayjs(record.iqama_expiry_at) : null}
                    onChange={(date: Dayjs | null) =>
                      setRecord({ ...record, iqama_expiry_at: date ? date.toISOString() : null })
                    }
                    slotProps={{
                      textField: {
                        size: "small",
                        className: "w-full",
                        sx: {
                          "& .MuiOutlinedInput-root": {
                            fontSize: "0.875rem",
                            color: "inherit",
                            backgroundColor: isDark ? "rgb(24 24 27)" : "white",
                            "& fieldset": { borderColor: isDark ? "rgb(63 63 70)" : "rgb(228 228 231)" },
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>

            </div>


            <div className="w-1/2">
              <FileUpload
                purpose_code="iqama"
                label={t("common.iqamaImage")}
                fileId={record.iqama_file_id}
                onFileIdChange={(id) => setRecord({ ...record, iqama_file_id: id })}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex relative w-2/4 gap-2 border border-primary rounded-md p-2 dark:border-zinc-800">
            <div className={`rounded absolute top-[-21%] left-[-0.1%] px-2 py-1 ${contractFilled ? "bg-primary text-white" : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"}`}>
              <p className="text-medium">{t("common.contract")}</p>
            </div>

            <div className="w-full">
              <div>
                <label className="text-sm font-medium text-primary">{t("common.contractNumber")}</label>
                <input
                  value={record.contract_no ?? ""}
                  onChange={(e) => setRecord({ ...record, contract_no: e.target.value })}
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-primary">{t("common.contractEnd")}</label>
                <div className="mt-1">
                  <DatePicker
                    value={record.contract_end_at ? dayjs(record.contract_end_at) : null}
                    onChange={(date: Dayjs | null) =>
                      setRecord({ ...record, contract_end_at: date ? date.toISOString() : null })
                    }
                    slotProps={{
                      textField: {
                        size: "small",
                        className: "w-full",
                        sx: {
                          "& .MuiOutlinedInput-root": {
                            fontSize: "0.875rem",
                            color: "inherit",
                            backgroundColor: isDark ? "rgb(24 24 27)" : "white",
                            "& fieldset": { borderColor: isDark ? "rgb(63 63 70)" : "rgb(228 228 231)" },
                          },
                        },
                      },
                    }}
                  />
                </div>
              </div>

            </div>


            <div className="w-1/2">
              <FileUpload
                purpose_code="contract"
                label={t("common.contractImage")}
                fileId={record.contract_file_id}
                onFileIdChange={(id) => setRecord({ ...record, contract_file_id: id })}
              />
            </div>
          </div>

          <div className="relative w-1/4 gap-2 border border-primary rounded-md p-2 dark:border-zinc-800">
            <div className={`rounded absolute top-[-21%] left-[-0.1%] px-2 py-1 ${licenseFilled ? "bg-primary text-white" : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"}`}>
              <p className="text-medium">{t("common.license")}</p>
            </div>

            <div>
              <label className="text-sm font-medium text-primary">{t("common.licenceExpiry")}</label>
              <div className="mt-1">
                <DatePicker
                  value={record.license_expiry_at ? dayjs(record.license_expiry_at) : null}
                  onChange={(date: Dayjs | null) =>
                    setRecord({ ...record, license_expiry_at: date ? date.toISOString() : null })
                  }
                  slotProps={{
                    textField: {
                      size: "small",
                      className: "w-full",
                      sx: {
                        "& .MuiOutlinedInput-root": {
                          fontSize: "0.875rem",
                          color: "inherit",
                          backgroundColor: isDark ? "rgb(24 24 27)" : "white",
                          "& fieldset": { borderColor: isDark ? "rgb(63 63 70)" : "rgb(228 228 231)" },
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>

            <div className="mt-2">
              <FileUpload
                purpose_code="license"
                label={t("common.licenseImage")}
                fileId={record.license_file_id}
                onFileIdChange={(id) => setRecord({ ...record, license_file_id: id })}
              />
            </div>
          </div>

          <div className="relative w-1/4 gap-2 border border-primary rounded-md p-2 dark:border-zinc-800">
            <div className={`rounded absolute top-[-21%] left-[-0.1%] px-2 py-1 ${promissoryFilled ? "bg-primary text-white" : "bg-zinc-200 text-zinc-500 dark:bg-zinc-700 dark:text-zinc-400"}`}>
              <p className="text-medium">{t("common.promissoryNote")}</p>
            </div>
            <div className="mt-2">
              <FileUpload
                purpose_code="promissory_note"
                label={t("common.promissoryNoteImage")}
                fileId={record.promissory_note_file_id}
                onFileIdChange={(id) => setRecord({ ...record, promissory_note_file_id: id })}
              />
            </div>
          </div>
        </div>

        {extraDocuments.length > 0 && (
          <div className="space-y-5">
            {extraDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex relative gap-2 border border-primary rounded-md p-3 dark:border-zinc-700"
              >
                <div className="rounded absolute top-[-28%] left-[-0.1%] px-2 py-1 bg-primary text-white">
                  <p className="text-medium">{doc.document_name.length > 0 ? doc.document_name :   t("common.customDocument")}</p>
                </div>
                <div className="flex-1 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <label className="text-sm font-medium text-primary">{t("employment.documentName")}</label>
                    <input
                      value={doc.document_name}
                      onChange={(e) =>
                        setExtraDocuments((prev) =>
                          prev.map((d) => (d.id === doc.id ? { ...d, document_name: e.target.value } : d))
                        )
                      }
                      className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-primary">{t("common.expiry") || "Expiry"}</label>
                    <div className="mt-1">
                      <DatePicker
                        value={doc.expiry_at ? dayjs(doc.expiry_at) : null}
                        onChange={(date: Dayjs | null) =>
                          setExtraDocuments((prev) =>
                            prev.map((d) => (d.id === doc.id ? { ...d, expiry_at: date ? date.toISOString() : null } : d))
                          )
                        }
                        slotProps={{
                          textField: {
                            size: "small",
                            className: "w-full",
                            sx: {
                              "& .MuiOutlinedInput-root": {
                                fontSize: "0.875rem",
                                color: "inherit",
                                backgroundColor: isDark ? "rgb(24 24 27)" : "white",
                                "& fieldset": { borderColor: isDark ? "rgb(63 63 70)" : "rgb(228 228 231)" },
                              },
                            },
                          },
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mt-1">
                      <FileUpload
                        purpose_code="extra_doc"
                        label={t("common.uploadFile")}
                        fileId={doc.file_id}
                        onFileIdChange={(id) =>
                          setExtraDocuments((prev) =>
                            prev.map((d) => (d.id === doc.id ? { ...d, file_id: id } : d))
                          )
                        }
                        instanceId={doc.id}
                      />
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExtraDocuments((prev) => prev.filter((d) => d.id !== doc.id))}
                  className="absolute top-2 right-2 rounded p-1 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                  aria-label={t("common.remove")}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

      </div>
    );
  };

  const getStatusLabel = (code: string) => {
    if (code === "EMPLOYMENT_STATUS_DRAFT") return t("common.statusDraft");
    if (code === "EMPLOYMENT_STATUS_UNDER_PROCEDURE") return t("common.statusInProgress");
    if (code === "EMPLOYMENT_STATUS_ACTIVE") return t("common.statusActive");
    if (code === "EMPLOYMENT_STATUS_DEACTIVATED") return t("common.deactivated");
    if (code === "EMPLOYMENT_STATUS_DESERTED") return t("common.deserted");
    return code;
  };

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-primary">{t("common.operatingPlatform")}</label>
          <select
            value={record.assigned_platform ?? ""}
            onChange={(e) => setRecord({ ...record, assigned_platform: e.target.value || null })}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">-</option>
            <option value="JAHEZ">Jahez</option>
            <option value="HUNGERSTATION">Hungerstation</option>
            <option value="NINJA">Ninja</option>
            <option value="KEETA">Keeta</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-primary">{t("common.platformUserNo")}</label>
          <input
            value={record.platform_user_no ?? ""}
            onChange={(e) => setRecord({ ...record, platform_user_no: e.target.value })}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-primary">{t("common.jobType")}</label>
          <select
            value={record.job_type ?? ""}
            onChange={(e) => setRecord({ ...record, job_type: e.target.value || null })}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">-</option>
            <option value="REPRESENTATIVE">{t("common.jobRepresentative")}</option>
            <option value="DRIVER">{t("common.jobDriver")}</option>
            <option value="ADMINISTRATOR">{t("common.jobAdministrator")}</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-primary">{t("common.salaryAmount")}</label>
          <input
            type="number"
            min={payrollConfig?.minimum_salary ?? 0}
            step="0.01"
            value={record.salary_amount ?? ""}
            onChange={(e) =>
              setRecord({ ...record, salary_amount: e.target.value ? String(e.target.value) : null })
            }
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
          />
          {payrollConfig && payrollConfig.minimum_salary > 0 && (
            <p className="mt-0.5 text-xs text-primary/60">
              Min: {payrollConfig.minimum_salary} SAR
            </p>
          )}
        </div>
        <div>
          <label className="text-sm font-medium text-primary">
            {payrollConfig?.calculation_method === "REVENUE"
              ? t("employment.revenueTarget")
              : t("employment.ordersTarget")}
          </label>
          {payrollConfig?.calculation_method === "REVENUE" ? (
            <input
              type="number"
              min="0"
              step="0.01"
              value={record.monthly_target_amount ?? ""}
              onChange={(e) =>
                setRecord({
                  ...record,
                  monthly_target_amount: e.target.value ? String(e.target.value) : null,
                })
              }
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
            />
          ) : (
            <input
              type="number"
              min="0"
              step="1"
              value={record.monthly_orders_target ?? ""}
              onChange={(e) =>
                setRecord({
                  ...record,
                  monthly_orders_target: e.target.value ? parseInt(e.target.value, 10) : null,
                })
              }
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
            />
          )}
        </div>
      </div>


      <div>
        <label className="text-sm font-medium text-primary">{t("common.notes")}</label>
        <textarea
          value={record.notes ?? ""}
          onChange={(e) => setRecord({ ...record, notes: e.target.value })}
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
          rows={3}
        />
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={employmentId ? t("common.editEmployment") : t("common.newEmployment")}
      maxWidth="4xl"
    >
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <div className="space-y-6">
          {/* Step Indicator */}
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex items-center gap-2 ${step === s ? "text-primary" : "text-zinc-400"}`}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${step === s ? "bg-primary text-white" : "bg-zinc-100 dark:bg-zinc-800"
                    }`}
                >
                  {s}
                </div>
                <span className="hidden text-sm font-medium sm:inline">
                  {s === 1 ? t("common.stepBasicInfo") : s === 2 ? t("common.stepDocuments") : t("common.stepOperatingData")}
                </span>
              </div>
            ))}
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-zinc-400">{t("common.loading")}</div>
          ) : (
            <>
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && renderStep3()}
            </>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="flex justify-between gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
            <button
              onClick={step === 1 ? handleClose : () => setStep(step - 1)}
              disabled={saving}
              className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-primary hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              {step === 1 ? t("common.cancel") : t("common.back")}
            </button>
            <div className="flex items-center gap-2">
              {step === 2 && extraDocuments.length < 2 && (
                <button
                  type="button"
                  onClick={() =>
                    setExtraDocuments((prev) => [
                      ...prev,
                      { id: `extra-${Date.now()}`, document_name: "", expiry_at: null, file_id: null },
                    ])
                  }
                  className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                >
                  {t("employment.addFile")}
                </button>
              )}
              {step === 3 && (
                <button
                  type="button"
                  onClick={() => onSave("EMPLOYMENT_STATUS_DRAFT")}
                  disabled={saving || loading}
                  className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-primary hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                >
                  {t("common.saveAsDraft")}
                </button>
              )}
              <button
                onClick={
                  step === 3
                    ? () => onSave()
                    : () => {
                      const errors = validateStep(step as 1 | 2);
                      setFieldErrors(errors);
                      setValidationAttempted(true);
                      if (Object.keys(errors).length > 0) return;
                      setStep(step + 1);
                    }
                }
                disabled={saving || loading}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
              >
                {step === 3 ? (saving ? t("common.saving") : t("common.save")) : t("common.next")}
              </button>
            </div>
          </div>
        </div>
      </LocalizationProvider>
    </Modal>
  );
}

