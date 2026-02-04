"use client";

import { use, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CandidateImageCard } from "@/components/CandidateImageCard";
import { ImageViewerModal } from "@/components/ImageViewerModal";
import { NationalityDisplay } from "@/components/NationalityDisplay";
import { RecruitmentEditModal } from "@/components/RecruitmentEditModal";

type Candidate = {
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
  files?: Array<{
    file_id: string;
    purpose_code: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
  }>;
};

export default function RecruitmentViewPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const t = useTranslations();
  const { locale, id } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [markingAsArrived, setMarkingAsArrived] = useState(false);
  const [viewerState, setViewerState] = useState<{ url: string; title: string; filename: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/recruitment/${id}`);
        const data = (await res.json().catch(() => null)) as any;
        if (!res.ok) throw new Error(data?.message ?? "Failed to load");
        if (!cancelled) {
          setCandidate(data);
          
          // Load image URLs for all files
          if (data.files && data.files.length > 0) {
            const urlMap = await loadImageUrls(data.files);
            setImageUrls(urlMap);
          }
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const getStatusTranslation = (statusCode: string): string => {
    const statusMap: Record<string, string> = {
      DRAFT: "common.statusDraft",
      UNDER_PROCEDURE: "common.statusUnderProcedure",
      ON_ARRIVAL: "common.statusOnArrival",
      ARRIVED: "common.statusArrived",
    };
    const translationKey = statusMap[statusCode];
    return translationKey ? t(translationKey) : statusCode;
  };

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const loadImageUrls = async (files: any[]) => {
    if (!files || files.length === 0) return {};
    
    const urlPromises = files
      .filter((f: any) => f.mime_type?.startsWith('image/'))
      .map(async (file: any) => {
        try {
          const urlRes = await fetch("/api/files/download-url", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ file_id: file.file_id }),
          });
          if (urlRes.ok) {
            const urlData = await urlRes.json();
            return { purpose_code: file.purpose_code, url: urlData.download_url };
          }
        } catch (e) {
          console.error(`Failed to load URL for ${file.purpose_code}:`, e);
        }
        return null;
      });
    
    const urlResults = await Promise.all(urlPromises);
    const urlMap: Record<string, string> = {};
    urlResults.forEach((result) => {
      if (result) {
        urlMap[result.purpose_code] = result.url;
      }
    });
    return urlMap;
  };

  const reloadData = async () => {
    try {
      const res = await fetch(`/api/recruitment/${id}`);
      const data = (await res.json().catch(() => null)) as any;
      if (res.ok && data) {
        setCandidate(data);
        
        // Reload image URLs if files exist
        if (data.files && data.files.length > 0) {
          const urlMap = await loadImageUrls(data.files);
          setImageUrls(urlMap);
        }
      }
    } catch (e) {
      console.error("Failed to reload data:", e);
    }
  };

  const onMarkAsArrived = async () => {
    if (candidate?.status_code !== "ON_ARRIVAL") return;
    setMarkingAsArrived(true);
    try {
      const res = await fetch(`/api/recruitment/candidates/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status_code: "ARRIVED" }),
      });
      if (res.ok) await reloadData();
    } finally {
      setMarkingAsArrived(false);
    }
  };

  if (loading) return <div className="text-sm text-primary/80">{t("common.loading")}</div>;
  if (error) return <div className="text-sm text-red-700">{error}</div>;
  if (!candidate) return <div className="text-sm text-primary/80">{t("common.notFound")}</div>;

  return (
    <div className="max-w-4xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/${locale}/recruitment`}
            className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
            title={t("common.back")}
            aria-label={t("common.back")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-xl font-semibold text-primary">
            {candidate.full_name_ar} {candidate.full_name_en ? `(${candidate.full_name_en})` : ""}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {candidate.status_code === "ON_ARRIVAL" && (
            <button
              onClick={onMarkAsArrived}
              disabled={markingAsArrived}
              className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800 hover:bg-green-100 disabled:opacity-50 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200 dark:hover:bg-green-900/30"
            >
              {markingAsArrived ? t("common.saving") || "Saving..." : t("common.markAsArrived") || "Mark as Arrived"}
            </button>
          )}
          <button
            onClick={() => setEditModalOpen(true)}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-600"
          >
            {t("common.edit")}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-primary/60">{t("common.fullNameAr")}</label>
            <div className="mt-1 text-base text-primary">{candidate.full_name_ar}</div>
          </div>
          <div>
            <label className="text-sm font-medium text-primary/60">{t("common.fullNameEn")}</label>
            <div className="mt-1 text-base text-primary">{candidate.full_name_en || "-"}</div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-primary/60">{t("common.nationality")}</label>
            <div className="mt-1 text-base text-primary">
              <NationalityDisplay value={candidate.nationality} locale={locale as "ar" | "en"} />
            </div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-primary/60">{t("common.passportNo")}</label>
            <div className="mt-1 text-base text-primary">{candidate.passport_no}</div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-primary/60">{t("common.passportExpiryDate")}</label>
            <div className="mt-1 text-base text-primary">{formatDate(candidate.passport_expiry_at)}</div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-primary/60">{t("common.status")}</label>
            <div className="mt-1 text-base text-primary">{getStatusTranslation(candidate.status_code)}</div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-primary/60">{t("common.responsibleOffice")}</label>
            <div className="mt-1 text-base text-primary">{candidate.responsible_office}</div>
          </div>
          
          {candidate.responsible_office_number != null && candidate.responsible_office_number !== "" && (
            <div>
              <label className="text-sm font-medium text-primary/60">{t("common.responsibleOfficeNumber")}</label>
              <div className="mt-1 text-base text-primary">{candidate.responsible_office_number}</div>
            </div>
          )}
          
          <div>
            <label className="text-sm font-medium text-primary/60">{t("common.visaDeadline")}</label>
            <div className="mt-1 text-base text-primary">{formatDate(candidate.visa_deadline_at)}</div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-primary/60">{t("common.visaSentDate")}</label>
            <div className="mt-1 text-base text-primary">{formatDate(candidate.visa_sent_at)}</div>
          </div>
          
          <div>
            <label className="text-sm font-medium text-primary/60">{t("common.expectedArrival")}</label>
            <div className="mt-1 text-base text-primary">{formatDate(candidate.expected_arrival_at)}</div>
          </div>
          
          {candidate.notes && (
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-primary/60">{t("common.notes")}</label>
              <div className="mt-1 text-base text-primary whitespace-pre-wrap">{candidate.notes}</div>
            </div>
          )}
        </div>
      </div>

      {/* Images Section */}
      {(imageUrls["PASSPORT_IMAGE"] ||
        imageUrls["VISA_IMAGE"] ||
        imageUrls["FLIGHT_TICKET_IMAGE"] ||
        imageUrls["PERSONAL_PICTURE"]) && (
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-800">
          <h2 className="mb-4 text-lg font-semibold text-primary">{t("common.images")}</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {imageUrls["PASSPORT_IMAGE"] && (
              <CandidateImageCard
                src={imageUrls["PASSPORT_IMAGE"]}
                alt={t("common.passportImage")}
                label={t("common.passportImage")}
                downloadFilename={`${candidate.full_name_ar}_passport`}
                onView={() =>
                  setViewerState({
                    url: imageUrls["PASSPORT_IMAGE"],
                    title: t("common.passportImage"),
                    filename: `${candidate.full_name_ar}_passport`,
                  })
                }
              />
            )}
            {imageUrls["VISA_IMAGE"] && (
              <CandidateImageCard
                src={imageUrls["VISA_IMAGE"]}
                alt={t("common.visaImage")}
                label={t("common.visaImage")}
                downloadFilename={`${candidate.full_name_ar}_visa`}
                onView={() =>
                  setViewerState({
                    url: imageUrls["VISA_IMAGE"],
                    title: t("common.visaImage"),
                    filename: `${candidate.full_name_ar}_visa`,
                  })
                }
              />
            )}
            {imageUrls["FLIGHT_TICKET_IMAGE"] && (
              <CandidateImageCard
                src={imageUrls["FLIGHT_TICKET_IMAGE"]}
                alt={t("common.flightTicketImage")}
                label={t("common.flightTicketImage")}
                downloadFilename={`${candidate.full_name_ar}_flight_ticket`}
                onView={() =>
                  setViewerState({
                    url: imageUrls["FLIGHT_TICKET_IMAGE"],
                    title: t("common.flightTicketImage"),
                    filename: `${candidate.full_name_ar}_flight_ticket`,
                  })
                }
              />
            )}
            {imageUrls["PERSONAL_PICTURE"] && (
              <CandidateImageCard
                src={imageUrls["PERSONAL_PICTURE"]}
                alt={t("common.personalPicture")}
                label={t("common.personalPicture")}
                downloadFilename={`${candidate.full_name_ar}_personal`}
                onView={() =>
                  setViewerState({
                    url: imageUrls["PERSONAL_PICTURE"],
                    title: t("common.personalPicture"),
                    filename: `${candidate.full_name_ar}_personal`,
                  })
                }
              />
            )}
          </div>
        </div>
      )}
      {viewerState && (
        <ImageViewerModal
          isOpen={!!viewerState}
          onClose={() => setViewerState(null)}
          imageUrl={viewerState.url}
          imageTitle={viewerState.title}
          downloadFilename={viewerState.filename}
        />
      )}
      <RecruitmentEditModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          // Reload data after closing the modal to show updated information
          reloadData();
        }}
        locale={locale}
        candidateId={id}
      />
    </div>
  );
}

