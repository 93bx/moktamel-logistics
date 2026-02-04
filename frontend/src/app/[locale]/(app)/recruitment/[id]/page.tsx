"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileUpload } from "@/components/FileUpload";
import { NationalitySearchDropdown } from "@/components/NationalitySearchDropdown";

type Candidate = {
  id: string;
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
  files?: Array<{
    file_id: string;
    purpose_code: string;
    original_name: string;
    mime_type: string;
    size_bytes: number;
  }>;
};

export default function RecruitmentEditPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const router = useRouter();
  const t = useTranslations();
  const { locale, id } = use(params);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [passportImageFileId, setPassportImageFileId] = useState<string | null>(null);
  const [visaImageFileId, setVisaImageFileId] = useState<string | null>(null);
  const [flightTicketImageFileId, setFlightTicketImageFileId] = useState<string | null>(null);
  const [personalPictureFileId, setPersonalPictureFileId] = useState<string | null>(null);

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
          // Set file IDs from existing files
          if (data.files) {
            const passportFile = data.files.find((f: any) => f.purpose_code === "PASSPORT_IMAGE");
            const visaFile = data.files.find((f: any) => f.purpose_code === "VISA_IMAGE");
            const flightTicketFile = data.files.find((f: any) => f.purpose_code === "FLIGHT_TICKET_IMAGE");
            const personalPictureFile = data.files.find((f: any) => f.purpose_code === "PERSONAL_PICTURE");
            if (passportFile) setPassportImageFileId(passportFile.file_id);
            if (visaFile) setVisaImageFileId(visaFile.file_id);
            if (flightTicketFile) setFlightTicketImageFileId(flightTicketFile.file_id);
            if (personalPictureFile) setPersonalPictureFileId(personalPictureFile.file_id);
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

  async function onSave() {
    if (!candidate) return;
    setError(null);
    const payload: any = {
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
    };
    // Add file IDs if they were updated
    if (passportImageFileId) payload.passport_image_file_id = passportImageFileId;
    if (visaImageFileId) payload.visa_image_file_id = visaImageFileId;
    if (flightTicketImageFileId) payload.flight_ticket_image_file_id = flightTicketImageFileId;
    if (personalPictureFileId) payload.personal_picture_file_id = personalPictureFileId;

    const res = await fetch(`/api/recruitment/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => null)) as any;
    if (!res.ok) {
      setError(data?.message ?? "Save failed");
      return;
    }
    router.push(`/${locale}/recruitment`);
    router.refresh();
  }

  async function onDelete() {
    const res = await fetch(`/api/recruitment/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as any;
      setError(data?.message ?? "Delete failed");
      return;
    }
    router.push(`/${locale}/recruitment`);
    router.refresh();
  }

  if (loading) return <div className="text-sm text-primary/80">Loading…</div>;
  if (error) return <div className="text-sm text-red-700">{error}</div>;
  if (!candidate) return <div className="text-sm text-primary/80">Not found</div>;

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-primary">{t("common.editCandidate")}</h1>
        <button
          onClick={onDelete}
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 hover:bg-red-100"
        >
          {t("common.delete")}
        </button>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm text-primary">{t("common.fullNameAr")}</label>
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
            <NationalitySearchDropdown
              value={candidate.nationality}
              onChange={(v) => setCandidate({ ...candidate, nationality: v })}
              locale={locale as "ar" | "en"}
              required
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
            <input
              value={candidate.status_code}
              onChange={(e) => setCandidate({ ...candidate, status_code: e.target.value })}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900"
            />
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
            <label className="text-sm text-primary">{t("common.visaDeadlineISO")}</label>
            <input
              value={candidate.visa_deadline_at ?? ""}
              onChange={(e) => setCandidate({ ...candidate, visa_deadline_at: e.target.value || null })}
              placeholder="2025-12-31T00:00:00.000Z"
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="text-sm text-primary">{t("common.visaSentDate")} (ISO)</label>
            <input
              value={candidate.visa_sent_at ?? ""}
              onChange={(e) => setCandidate({ ...candidate, visa_sent_at: e.target.value || null })}
              placeholder="2025-12-31T00:00:00.000Z"
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="text-sm text-primary">{t("common.expectedArrivalISO")}</label>
            <input
              value={candidate.expected_arrival_at ?? ""}
              onChange={(e) => setCandidate({ ...candidate, expected_arrival_at: e.target.value || null })}
              placeholder="2025-12-31T00:00:00.000Z"
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900"
            />
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
            <FileUpload
              purpose_code="PASSPORT_IMAGE"
              label={t("common.passportImage")}
              required={false}
              fileId={passportImageFileId}
              onFileIdChange={setPassportImageFileId}
            />
          </div>
          <div className="sm:col-span-2">
            <FileUpload
              purpose_code="VISA_IMAGE"
              label={t("common.visaImage")}
              required={false}
              fileId={visaImageFileId}
              onFileIdChange={setVisaImageFileId}
            />
          </div>
          <div className="sm:col-span-2">
            <FileUpload
              purpose_code="FLIGHT_TICKET_IMAGE"
              label={t("common.flightTicketImage")}
              required={false}
              fileId={flightTicketImageFileId}
              onFileIdChange={setFlightTicketImageFileId}
            />
          </div>
          <div className="sm:col-span-2">
            <FileUpload
              purpose_code="PERSONAL_PICTURE"
              label={t("common.personalPicture")}
              required={false}
              fileId={personalPictureFileId}
              onFileIdChange={setPersonalPictureFileId}
            />
          </div>
        </div>
        {error ? (
          <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {error}
          </div>
        ) : null}
        <div className="mt-4 flex gap-2">
          <button
            onClick={onSave}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-600"
          >
            {t("common.save")}
          </button>
          <button
            onClick={() => router.push(`/${locale}/recruitment`)}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}


