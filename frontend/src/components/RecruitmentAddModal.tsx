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

interface RecruitmentAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
}

type Candidate = {
  full_name_ar: string;
  full_name_en: string | null;
  nationality: string;
  passport_no: string;
  job_title_code: string | null;
  status_code: string;
  responsible_office: string;
  visa_deadline_at: string | null;
  visa_sent_at: string | null;
  expected_arrival_at: string | null;
  notes: string | null;
  passport_image_file_id: string | null;
  visa_image_file_id: string | null;
  flight_ticket_image_file_id: string | null;
  personal_picture_file_id: string | null;
};

export function RecruitmentAddModal({ isOpen, onClose, locale }: RecruitmentAddModalProps) {
  const router = useRouter();
  const t = useTranslations();
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [candidate, setCandidate] = useState<Candidate>({
    full_name_ar: "",
    full_name_en: "",
    nationality: "",
    passport_no: "",
    job_title_code: null,
    status_code: "UNDER_PROCEDURE",
    responsible_office: "",
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
      job_title_code: null,
      status_code: "UNDER_PROCEDURE",
      responsible_office: "",
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
    setError(null);
    setSaving(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const onSave = async (e?: React.MouseEvent<HTMLButtonElement>) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    setSaving(true);
    setError(null);

    // Validation
    if (!candidate.full_name_ar.trim()) {
      setError(t("common.fullNameArRequired"));
      setSaving(false);
      return;
    }
    if (!candidate.nationality.trim()) {
      setError(t("common.nationalityRequired"));
      setSaving(false);
      return;
    }
    if (!candidate.passport_no.trim()) {
      setError(t("common.passportNumberRequired"));
      setSaving(false);
      return;
    }
    if (!candidate.responsible_office.trim()) {
      setError(t("common.responsibleOfficeRequired"));
      setSaving(false);
      return;
    }
    if (!fileIds.passport) {
      setError(t("common.passportImageRequired"));
      setSaving(false);
      return;
    }

    try {
      const payload = {
        full_name_ar: candidate.full_name_ar,
        full_name_en: candidate.full_name_en || undefined,
        nationality: candidate.nationality,
        passport_no: candidate.passport_no,
        job_title_code: candidate.job_title_code || undefined,
        status_code: candidate.status_code || undefined,
        responsible_office: candidate.responsible_office,
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
      const data = (await res.json().catch(() => null)) as any;
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

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t("common.newCandidate")}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm text-primary">{t("common.fullNameAr")} *</label>
            <input
              value={candidate.full_name_ar}
              onChange={(e) => setCandidate({ ...candidate, full_name_ar: e.target.value })}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="text-sm text-primary">{t("common.fullNameEn")}</label>
            <input
              value={candidate.full_name_en ?? ""}
              onChange={(e) => setCandidate({ ...candidate, full_name_en: e.target.value || null })}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="text-sm text-primary">{t("common.nationality")} *</label>
            <input
              value={candidate.nationality}
              onChange={(e) => setCandidate({ ...candidate, nationality: e.target.value })}
              required
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="text-sm text-primary">{t("common.passportNo")} *</label>
            <input
              value={candidate.passport_no}
              onChange={(e) => setCandidate({ ...candidate, passport_no: e.target.value })}
              required
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="text-sm text-primary">{t("common.statusCode")}</label>
            <select
              value={candidate.status_code}
              onChange={(e) => setCandidate({ ...candidate, status_code: e.target.value })}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="UNDER_PROCEDURE">{t("common.statusUnderProcedure")}</option>
              <option value="ON_ARRIVAL">{t("common.statusOnArrival")}</option>
              <option value="ARRIVED">{t("common.statusArrived")}</option>
            </select>
          </div>
          <div>
            <label className="text-sm text-primary">{t("common.responsibleOffice")} *</label>
            <input
              value={candidate.responsible_office}
              onChange={(e) => setCandidate({ ...candidate, responsible_office: e.target.value })}
              required
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900"
            />
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
              <FileUpload
                variant="card"
                icon={<FileImage />}
                purpose_code="PASSPORT_IMAGE"
                label={t("common.passportImage")}
                required
                fileId={fileIds.passport}
                onFileIdChange={(id) => setFileIds((prev) => ({ ...prev, passport: id }))}
              />
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

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {error}
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

