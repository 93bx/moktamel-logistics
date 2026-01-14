"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Eye, Pencil } from "lucide-react";
import { RecruitmentNewButton } from "@/components/RecruitmentNewButton";
import { RecruitmentEditModal } from "@/components/RecruitmentEditModal";

type CandidateListItem = {
  id: string;
  full_name_ar: string;
  full_name_en: string | null;
  nationality: string;
  passport_no: string;
  job_title_code: string | null;
  status_code: string;
  responsible_office: string;
  avatar_file_id: string | null;
  visa_deadline_at: string | null;
  visa_sent_at: string | null;
  expected_arrival_at: string | null;
  created_at: string;
  updated_at: string;
};

type StatsData = {
  underProcedureCount: number;
  olderThan45DaysCount: number;
  arrivingWithin7DaysCount: number;
};

export function RecruitmentPageClient({
  locale,
  data,
  stats,
  searchParams,
  page,
}: {
  locale: string;
  data: {
    items: CandidateListItem[];
    total: number;
    page: number;
    page_size: number;
  };
  stats: StatsData;
  searchParams: { q?: string; status_code?: string };
  page: number;
}) {
  const t = useTranslations();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);

  const handleEditClick = (candidateId: string) => {
    setSelectedCandidateId(candidateId);
    setEditModalOpen(true);
  };

  const getStatusTranslation = (statusCode: string): string => {
    const statusMap: Record<string, string> = {
      UNDER_PROCEDURE: "common.statusUnderProcedure",
      ON_ARRIVAL: "common.statusOnArrival",
      ARRIVED: "common.statusArrived",
    };
    const translationKey = statusMap[statusCode];
    return translationKey ? t(translationKey) : statusCode;
  };

  return (
    <>
      <div className="space-y-4">
        {/* Part 1: Quick Stats Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
            <div className="text-sm text-primary/60">{t("common.underProcedure")}</div>
            <div className="mt-1 text-2xl font-semibold text-primary">{stats.underProcedureCount}</div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
            <div className="text-sm text-primary/60">{t("common.olderThan45Days")}</div>
            <div className="mt-1 text-2xl font-semibold text-primary">{stats.olderThan45DaysCount}</div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
            <div className="text-sm text-primary/60">{t("common.arrivingWithin7Days")}</div>
            <div className="mt-1 text-2xl font-semibold text-primary">{stats.arrivingWithin7DaysCount}</div>
          </div>
        </div>

        {/* Part 2: Control Buttons (aligned) */}
        <form className="flex justify-between items-center " action={`/${locale}/recruitment`} method="get">
          <div className="flex gap-2 bg-[#244473] p-2 rounded-md w-[50%]">
            <input
              name="q"
              defaultValue={searchParams.q ?? ""}
              placeholder={t("common.searchNameOfficePassport")}
              className="w-full max-w-sm rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-800"
            />
            <select
              name="status_code"
              defaultValue={searchParams.status_code ?? ""}
              className="w-full max-w-xs rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800"
            >
              <option value="">{t("common.allStatuses")}</option>
              <option value="UNDER_PROCEDURE">{t("common.statusUnderProcedure")}</option>
              <option value="ON_ARRIVAL">{t("common.statusOnArrival")}</option>
              <option value="ARRIVED">{t("common.statusArrived")}</option>
            </select>

            <button className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700">
              {t("common.filter")}
            </button>

          </div>
          <RecruitmentNewButton locale={locale} />
        </form>

        {/* Part 3: Candidates Table */}
        <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-primary">
              <thead className="border-b border-zinc-200 text-left dark:border-zinc-700">
                <tr className={`${locale === "ar" ? "text-right" : "text-left"}`}>
                  <th className="px-3 py-2">{t("common.avatar")}</th>
                  <th className="px-3 py-2">{t("common.name")}</th>
                  <th className="px-3 py-2">{t("common.responsibleOffice")}</th>
                  <th className="px-3 py-2">{t("common.visaSentDate")}</th>
                  <th className="px-3 py-2">{t("common.passport")}</th>
                  <th className="px-3 py-2">{t("common.arrival")}</th>
                  <th className="px-3 py-2">{t("common.status")}</th>
                  <th className="px-3 py-2">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((c) => {
                  const arrivalSoon =
                    c.expected_arrival_at &&
                    Math.ceil((new Date(c.expected_arrival_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) <= 7 &&
                    Math.ceil((new Date(c.expected_arrival_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) >= 0;
                    const olderThan45Days = new Date(c.created_at).getTime() < new Date().getTime() - 45 * 24 * 60 * 60 * 1000;
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-zinc-100 dark:border-zinc-700 ${c.status_code === "ARRIVED" ? "bg-green-100 dark:bg-green-900/20" : arrivalSoon ? "bg-amber-100 dark:bg-amber-900/20" : olderThan45Days ? "bg-red-200 dark:bg-red-900/20" : ""} ${locale === "ar" ? "text-right" : "text-left"}`}
                    >
                      <td className="px-3 py-2">
                        <div className="h-10 w-10 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
                          {c.avatar_file_id ? (
                            <img
                              src={`/api/files/${c.avatar_file_id}/view`}
                              alt={c.full_name_ar}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-bold text-zinc-400 uppercase">
                              {(c.full_name_en || c.full_name_ar || "?")[0]}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 font-medium">
                        <div className="flex flex-col">
                          <span>{c.full_name_ar}</span>
                          <span className="text-xs text-primary/60">{c.full_name_en}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2">{c.responsible_office}</td>
                      <td className="px-3 py-2">{c.visa_sent_at ? new Date(c.visa_sent_at).toISOString().slice(0, 10) : "-"}</td>
                      <td className="px-3 py-2">{c.passport_no}</td>
                      <td className="px-3 py-2">{c.expected_arrival_at ? new Date(c.expected_arrival_at).toISOString().slice(0, 10) : "-"}</td>
                      <td className="px-3 py-2">{getStatusTranslation(c.status_code)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/${locale}/recruitment/${c.id}/view`}
                            className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                            title={t("common.view")}
                            aria-label={t("common.view")}
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          <button
                            onClick={() => handleEditClick(c.id)}
                            className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                            title={t("common.edit")}
                            aria-label={t("common.edit")}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {data.items.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-primary/60" colSpan={8}>
                      {t("common.noResults")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-primary/80">
          <div>
            {t("common.total")}: {data.total} ({t("common.page")} {data.page})
          </div>
          <div className="flex gap-2">
            <Link
              className={`rounded-md border border-zinc-200 px-3 py-1 text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
              href={`/${locale}/recruitment?q=${encodeURIComponent(searchParams.q ?? "")}&status_code=${encodeURIComponent(
                searchParams.status_code ?? "",
              )}&page=${page - 1}`}
            >
              {t("common.prev")}
            </Link>
            <Link
              className={`rounded-md border border-zinc-200 px-3 py-1 text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 ${page * data.page_size >= data.total ? "pointer-events-none opacity-50" : ""}`}
              href={`/${locale}/recruitment?q=${encodeURIComponent(searchParams.q ?? "")}&status_code=${encodeURIComponent(
                searchParams.status_code ?? "",
              )}&page=${page + 1}`}
            >
              {t("common.next")}
            </Link>
          </div>
        </div>
      </div>
      <RecruitmentEditModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedCandidateId(null);
        }}
        locale={locale}
        candidateId={selectedCandidateId}
      />
    </>
  );
}

