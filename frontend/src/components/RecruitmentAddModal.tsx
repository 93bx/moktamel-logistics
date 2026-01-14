"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import { FileImage, FileText, Plane, User, X } from "lucide-react";
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

type FileUploadState = {
  file: File | null;
  fileId: string | null;
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

  // File upload state - store File objects temporarily
  const [files, setFiles] = useState<{
    passport: FileUploadState;
    visa: FileUploadState;
    flightTicket: FileUploadState;
    personalPicture: FileUploadState;
  }>({
    passport: { file: null, fileId: null },
    visa: { file: null, fileId: null },
    flightTicket: { file: null, fileId: null },
    personalPicture: { file: null, fileId: null },
  });

  const fileInputRefs = {
    passport: useRef<HTMLInputElement>(null),
    visa: useRef<HTMLInputElement>(null),
    flightTicket: useRef<HTMLInputElement>(null),
    personalPicture: useRef<HTMLInputElement>(null),
  };

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
    setFiles({
      passport: { file: null, fileId: null },
      visa: { file: null, fileId: null },
      flightTicket: { file: null, fileId: null },
      personalPicture: { file: null, fileId: null },
    });
    // Reset file inputs
    Object.values(fileInputRefs).forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
    setError(null);
    setSaving(false);
  };

  const handleFileSelect = (type: keyof typeof files, file: File | null) => {
    setFiles((prev) => ({
      ...prev,
      [type]: { file, fileId: null },
    }));
  };

  const handleFileRemove = (type: keyof typeof files) => {
    setFiles((prev) => ({
      ...prev,
      [type]: { file: null, fileId: null },
    }));
    if (fileInputRefs[type].current) {
      fileInputRefs[type].current!.value = "";
    }
  };

  const uploadFile = async (file: File): Promise<string> => {
    // Step 1: Get upload URL from backend
    const uploadUrlRes = await fetch("/api/files/upload-url", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        original_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      }),
    });

    if (!uploadUrlRes.ok) {
      const data = await uploadUrlRes.json().catch(() => null);
      throw new Error(data?.message ?? "Failed to get upload URL");
    }

    const { file_id, upload_url } = await uploadUrlRes.json();

    // Step 2: Upload file directly to MinIO
    const uploadRes = await fetch(upload_url, {
      method: "PUT",
      headers: {
        "Content-Type": file.type,
      },
      body: file,
    });

    if (!uploadRes.ok) {
      throw new Error("Failed to upload file to storage");
    }

    return file_id;
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
    if (!files.passport.file) {
      setError(t("common.passportImageRequired"));
      setSaving(false);
      return;
    }

    try {
      // Upload files first
      const fileIds: {
        passport_image_file_id?: string;
        visa_image_file_id?: string;
        flight_ticket_image_file_id?: string;
        personal_picture_file_id?: string;
      } = {};

      if (files.passport.file) {
        fileIds.passport_image_file_id = await uploadFile(files.passport.file);
      }
      if (files.visa.file) {
        fileIds.visa_image_file_id = await uploadFile(files.visa.file);
      }
      if (files.flightTicket.file) {
        fileIds.flight_ticket_image_file_id = await uploadFile(files.flightTicket.file);
      }
      if (files.personalPicture.file) {
        fileIds.personal_picture_file_id = await uploadFile(files.personalPicture.file);
      }

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
        ...fileIds,
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
              {/* Passport Image Card */}
              <div className="relative">
                <input
                  ref={fileInputRefs.passport}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect("passport", e.target.files?.[0] || null)}
                  className="hidden"
                  id="file-passport"
                />
                <label
                  htmlFor="file-passport"
                  className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-zinc-300 rounded-md cursor-pointer hover:border-zinc-400 dark:border-zinc-600 dark:hover:border-zinc-500 transition-colors"
                >
                  <FileImage className="w-8 h-8 text-zinc-500 mb-2" />
                  <span className="text-xs text-center text-primary">{t("common.passportImage")} *</span>
                  {files.passport.file && (
                    <span className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 truncate w-full text-center">
                      {files.passport.file.name}
                    </span>
                  )}
                </label>
                {files.passport.file && (
                  <button
                    type="button"
                    onClick={() => handleFileRemove("passport")}
                    className="absolute -top-2 -right-2 rounded-full bg-red-500 text-white p-1 hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Visa Image Card */}
              <div className="relative">
                <input
                  ref={fileInputRefs.visa}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect("visa", e.target.files?.[0] || null)}
                  className="hidden"
                  id="file-visa"
                />
                <label
                  htmlFor="file-visa"
                  className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-zinc-300 rounded-md cursor-pointer hover:border-zinc-400 dark:border-zinc-600 dark:hover:border-zinc-500 transition-colors"
                >
                  <FileText className="w-8 h-8 text-zinc-500 mb-2" />
                  <span className="text-xs text-center text-primary">{t("common.visaImage")}</span>
                  {files.visa.file && (
                    <span className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 truncate w-full text-center">
                      {files.visa.file.name}
                    </span>
                  )}
                </label>
                {files.visa.file && (
                  <button
                    type="button"
                    onClick={() => handleFileRemove("visa")}
                    className="absolute -top-2 -right-2 rounded-full bg-red-500 text-white p-1 hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Flight Ticket Image Card */}
              <div className="relative">
                <input
                  ref={fileInputRefs.flightTicket}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect("flightTicket", e.target.files?.[0] || null)}
                  className="hidden"
                  id="file-flight-ticket"
                />
                <label
                  htmlFor="file-flight-ticket"
                  className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-zinc-300 rounded-md cursor-pointer hover:border-zinc-400 dark:border-zinc-600 dark:hover:border-zinc-500 transition-colors"
                >
                  <Plane className="w-8 h-8 text-zinc-500 mb-2" />
                  <span className="text-xs text-center text-primary">{t("common.flightTicketImage")}</span>
                  {files.flightTicket.file && (
                    <span className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 truncate w-full text-center">
                      {files.flightTicket.file.name}
                    </span>
                  )}
                </label>
                {files.flightTicket.file && (
                  <button
                    type="button"
                    onClick={() => handleFileRemove("flightTicket")}
                    className="absolute -top-2 -right-2 rounded-full bg-red-500 text-white p-1 hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Personal Picture Card */}
              <div className="relative">
                <input
                  ref={fileInputRefs.personalPicture}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect("personalPicture", e.target.files?.[0] || null)}
                  className="hidden"
                  id="file-personal-picture"
                />
                <label
                  htmlFor="file-personal-picture"
                  className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-zinc-300 rounded-md cursor-pointer hover:border-zinc-400 dark:border-zinc-600 dark:hover:border-zinc-500 transition-colors"
                >
                  <User className="w-8 h-8 text-zinc-500 mb-2" />
                  <span className="text-xs text-center text-primary">{t("common.personalPicture")}</span>
                  {files.personalPicture.file && (
                    <span className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 truncate w-full text-center">
                      {files.personalPicture.file.name}
                    </span>
                  )}
                </label>
                {files.personalPicture.file && (
                  <button
                    type="button"
                    onClick={() => handleFileRemove("personalPicture")}
                    className="absolute -top-2 -right-2 rounded-full bg-red-500 text-white p-1 hover:bg-red-600"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
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

