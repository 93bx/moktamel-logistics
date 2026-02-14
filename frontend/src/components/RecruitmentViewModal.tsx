"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  User,
  Hash,
  Globe,
  FileText,
  Calendar,
  Activity,
  Building2,
  Plane,
  CheckCircle,
} from "lucide-react";
import { Modal } from "./Modal";
import { CandidateImageCard } from "./CandidateImageCard";
import { ImageViewerModal } from "./ImageViewerModal";
import { NationalityDisplay } from "./NationalityDisplay";

type CandidateFull = {
  id: string;
  full_name_ar: string;
  full_name_en: string | null;
  nationality: string;
  passport_no: string;
  passport_expiry_at: string | null;
  job_title_code: string | null;
  status_code: string;
  responsible_office: string;
  responsible_office_number: string | null;
  visa_deadline_at: string | null;
  visa_sent_at: string | null;
  expected_arrival_at: string | null;
  notes: string | null;
  avatar_file_id?: string | null;
  files?: Array<{
    file_id: string;
    purpose_code: string;
    original_name?: string;
    mime_type?: string;
    size_bytes?: number;
  }>;
};

interface RecruitmentViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  candidateId: string | null;
  locale: string;
  onDataChange?: () => void;
}

function DocumentPlaceholder({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-800/50">
      <p className="text-sm font-medium text-primary/80">{label}</p>
      <p className="mt-1 text-xs text-primary/60">{detail}</p>
      <p className="mt-2 text-xs italic text-primary/50">—</p>
    </div>
  );
}

async function loadImageUrls(files: { file_id: string; purpose_code: string; mime_type?: string }[]): Promise<Record<string, string>> {
  if (!files || files.length === 0) return {};
  const filtered = files.filter((f) => f.mime_type?.startsWith("image/"));
  const results = await Promise.all(
    filtered.map(async (file) => {
      try {
        const urlRes = await fetch("/api/files/download-url", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ file_id: file.file_id }),
        });
        if (urlRes.ok) {
          const urlData = await urlRes.json();
          return { purpose_code: file.purpose_code, url: urlData.download_url } as const;
        }
      } catch {
        // ignore
      }
      return null;
    })
  );
  const urlMap: Record<string, string> = {};
  results.forEach((r) => {
    if (r) urlMap[r.purpose_code] = r.url;
  });
  return urlMap;
}

export function RecruitmentViewModal({
  isOpen,
  onClose,
  candidateId,
  locale,
  onDataChange,
}: RecruitmentViewModalProps) {
  const t = useTranslations();
  const [candidate, setCandidate] = useState<CandidateFull | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [viewerState, setViewerState] = useState<{ url: string; title: string; filename: string } | null>(null);
  const [markingAsArrived, setMarkingAsArrived] = useState(false);

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const getStatusTranslation = (statusCode: string): string => {
    const map: Record<string, string> = {
      DRAFT: t("common.statusDraft"),
      UNDER_PROCEDURE: t("common.statusUnderProcedure"),
      ON_ARRIVAL: t("common.statusOnArrival"),
      ARRIVED: t("common.statusArrived"),
    };
    return map[statusCode] ?? statusCode;
  };

  const refetchCandidate = async () => {
    if (!candidateId) return;
    try {
      const res = await fetch(`/api/recruitment/${candidateId}`);
      const data = await res.json().catch(() => null);
      if (res.ok && data) {
        setCandidate(data as CandidateFull);
        if (data.files && data.files.length > 0) {
          const urlMap = await loadImageUrls(data.files);
          setImageUrls(urlMap);
        }
      }
    } catch (e) {
      console.error("Failed to refetch candidate:", e);
    }
  };

  useEffect(() => {
    if (!isOpen || !candidateId) {
      setCandidate(null);
      setImageUrls({});
      setError(null);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      setCandidate(null);
      setImageUrls({});
      try {
        const res = await fetch(`/api/recruitment/${candidateId}`);
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.message ?? "Failed to load");
          return;
        }
        setCandidate(data as CandidateFull);
        if (data.files && data.files.length > 0 && !cancelled) {
          const urlMap = await loadImageUrls(data.files);
          if (!cancelled) setImageUrls(urlMap);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, candidateId]);

  const onMarkAsArrived = async () => {
    if (!candidateId || candidate?.status_code !== "ON_ARRIVAL") return;
    setMarkingAsArrived(true);
    try {
      const res = await fetch(`/api/recruitment/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status_code: "ARRIVED" }),
      });
      if (res.ok) {
        await refetchCandidate();
        onDataChange?.();
      }
    } finally {
      setMarkingAsArrived(false);
    }
  };

  const displayName = candidate?.full_name_ar ?? "-";

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={t("common.view")} maxWidth="4xl">
        <div className="space-y-4">
          {loading ? (
            <div className="py-12 text-center text-sm text-primary/70">{t("common.loading")}</div>
          ) : error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          ) : candidate ? (
            <div className="space-y-6">
              {/* Block A – Personal Info */}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary/80">
                  <User className="h-4 w-4" />
                  {t("common.personalInfo")}
                </h3>
                <div className="flex flex-wrap items-start gap-6">
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700">
                      {candidate.avatar_file_id ? (
                        <img
                          src={`/api/files/${candidate.avatar_file_id}/view`}
                          className="h-full w-full object-cover"
                          alt=""
                        />
                      ) : imageUrls["PERSONAL_PICTURE"] ? (
                        <img
                          src={imageUrls["PERSONAL_PICTURE"]}
                          className="h-full w-full object-cover"
                          alt=""
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-zinc-400">
                          {(candidate.full_name_ar || candidate.full_name_en || "?")[0]}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 shrink-0 text-primary/50" />
                      <span className="text-primary/60">{t("common.fullNameAr")}:</span>
                      <span className="font-medium text-primary">{candidate.full_name_ar || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 shrink-0 text-primary/50" />
                      <span className="text-primary/60">{t("common.fullNameEn")}:</span>
                      <span className="font-medium text-primary">{candidate.full_name_en || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 shrink-0 text-primary/50" />
                      <span className="text-primary/60">{t("common.nationality")}:</span>
                      <NationalityDisplay value={candidate.nationality} locale={locale as "ar" | "en"} />
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-primary/50" />
                      <span className="text-primary/60">{t("common.passportNo")}:</span>
                      <span className="font-medium text-primary">{candidate.passport_no || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 shrink-0 text-primary/50" />
                      <span className="text-primary/60">{t("common.passportExpiryDate")}:</span>
                      <span className="font-medium text-primary">{formatDate(candidate.passport_expiry_at)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Block B – Official Documents / Images */}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary/80">
                  <FileText className="h-4 w-4" />
                  {t("common.officialDocuments")}
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {imageUrls["PASSPORT_IMAGE"] ? (
                    <CandidateImageCard
                      src={imageUrls["PASSPORT_IMAGE"]}
                      alt={t("common.passportImage")}
                      label={t("common.passportImage")}
                      downloadFilename={`${displayName}_passport`}
                      onView={() =>
                        setViewerState({
                          url: imageUrls["PASSPORT_IMAGE"],
                          title: t("common.passportImage"),
                          filename: `${displayName}_passport`,
                        })
                      }
                    />
                  ) : (
                    <DocumentPlaceholder label={t("common.passportImage")} detail="—" />
                  )}
                  {imageUrls["VISA_IMAGE"] ? (
                    <CandidateImageCard
                      src={imageUrls["VISA_IMAGE"]}
                      alt={t("common.visaImage")}
                      label={t("common.visaImage")}
                      downloadFilename={`${displayName}_visa`}
                      onView={() =>
                        setViewerState({
                          url: imageUrls["VISA_IMAGE"],
                          title: t("common.visaImage"),
                          filename: `${displayName}_visa`,
                        })
                      }
                    />
                  ) : (
                    <DocumentPlaceholder label={t("common.visaImage")} detail="—" />
                  )}
                  {imageUrls["FLIGHT_TICKET_IMAGE"] ? (
                    <CandidateImageCard
                      src={imageUrls["FLIGHT_TICKET_IMAGE"]}
                      alt={t("common.flightTicketImage")}
                      label={t("common.flightTicketImage")}
                      downloadFilename={`${displayName}_flight_ticket`}
                      onView={() =>
                        setViewerState({
                          url: imageUrls["FLIGHT_TICKET_IMAGE"],
                          title: t("common.flightTicketImage"),
                          filename: `${displayName}_flight_ticket`,
                        })
                      }
                    />
                  ) : (
                    <DocumentPlaceholder label={t("common.flightTicketImage")} detail="—" />
                  )}
                  {imageUrls["PERSONAL_PICTURE"] ? (
                    <CandidateImageCard
                      src={imageUrls["PERSONAL_PICTURE"]}
                      alt={t("common.personalPicture")}
                      label={t("common.personalPicture")}
                      downloadFilename={`${displayName}_personal`}
                      onView={() =>
                        setViewerState({
                          url: imageUrls["PERSONAL_PICTURE"],
                          title: t("common.personalPicture"),
                          filename: `${displayName}_personal`,
                        })
                      }
                    />
                  ) : (
                    <DocumentPlaceholder label={t("common.personalPicture")} detail="—" />
                  )}
                </div>
              </div>

              {/* Block C – Recruitment & Visa */}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary/80">
                  <Activity className="h-4 w-4" />
                  {t("common.recruitmentAndVisa")}
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Activity className="h-4 w-4 shrink-0 text-primary/50" />
                    <span className="text-primary/60">{t("common.status")}:</span>
                    <span className="font-medium text-primary">{getStatusTranslation(candidate.status_code)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 shrink-0 text-primary/50" />
                    <span className="text-primary/60">{t("common.responsibleOffice")}:</span>
                    <span className="font-medium text-primary">{candidate.responsible_office || "-"}</span>
                  </div>
                  {candidate.responsible_office_number != null && candidate.responsible_office_number !== "" && (
                    <div className="flex items-center gap-2 text-sm">
                      <Hash className="h-4 w-4 shrink-0 text-primary/50" />
                      <span className="text-primary/60">{t("common.responsibleOfficeNumber")}:</span>
                      <span className="font-medium text-primary">{candidate.responsible_office_number}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 shrink-0 text-primary/50" />
                    <span className="text-primary/60">{t("common.visaDeadline")}:</span>
                    <span className="font-medium text-primary">{formatDate(candidate.visa_deadline_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 shrink-0 text-primary/50" />
                    <span className="text-primary/60">{t("common.visaSentDate")}:</span>
                    <span className="font-medium text-primary">{formatDate(candidate.visa_sent_at)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Plane className="h-4 w-4 shrink-0 text-primary/50" />
                    <span className="text-primary/60">{t("common.expectedArrival")}:</span>
                    <span className="font-medium text-primary">{formatDate(candidate.expected_arrival_at)}</span>
                  </div>
                </div>
                {candidate.notes != null && candidate.notes !== "" && (
                  <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                    <div className="flex items-start gap-2 text-sm">
                      <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary/50" />
                      <div>
                        <span className="text-primary/60">{t("common.notes")}:</span>
                        <p className="mt-1 whitespace-pre-wrap font-medium text-primary">{candidate.notes}</p>
                      </div>
                    </div>
                  </div>
                )}
                {candidate.status_code === "ON_ARRIVAL" && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                    <button
                      type="button"
                      onClick={onMarkAsArrived}
                      disabled={markingAsArrived}
                      className="inline-flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-100 disabled:opacity-50 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200 dark:hover:bg-green-900/30"
                    >
                      <CheckCircle className="h-4 w-4" />
                      {markingAsArrived ? t("common.saving") : t("common.markAsArrived")}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </Modal>

      {viewerState && (
        <ImageViewerModal
          isOpen={!!viewerState}
          onClose={() => setViewerState(null)}
          imageUrl={viewerState.url}
          imageTitle={viewerState.title}
          downloadFilename={viewerState.filename}
        />
      )}
    </>
  );
}
