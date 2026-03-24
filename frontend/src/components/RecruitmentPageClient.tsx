"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  CheckCircle,
  ChevronDown,
  CircleHelp,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Eye,
  Pencil,
  Plane,
  TriangleAlert,
  Upload,
  User,
  Users,
} from "lucide-react";
import { RecruitmentNewButton } from "@/components/RecruitmentNewButton";
import { RecruitmentEditModal } from "@/components/RecruitmentEditModal";
import { RecruitmentViewModal } from "@/components/RecruitmentViewModal";
import { EmploymentModal } from "@/components/EmploymentModal";
import {
  RecruitmentImportModal,
  downloadRecruitmentExport,
} from "@/components/RecruitmentImportModal";

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
  draftCount: number;
  olderThan45DaysCount: number;
  arrivingWithin7DaysCount: number;
  totalCandidatesCount?: number;
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
  searchParams: { q?: string; status_code?: string; sort?: string };
  page: number;
}) {
  const t = useTranslations();
  const router = useRouter();

  type SortValue = "under_procedure" | "arriving_soon" | "older_than_45_days" | "drafts";

  function buildRecruitmentUrl(opts: {
    sort?: SortValue | null;
    page?: number;
  }): string {
    const params = new URLSearchParams();
    if (searchParams.q) params.set("q", searchParams.q);
    if (searchParams.status_code) params.set("status_code", searchParams.status_code);
    if (opts.sort != null) params.set("sort", opts.sort);
    if (opts.page != null && opts.page > 1) params.set("page", String(opts.page));
    const qs = params.toString();
    return `/${locale}/recruitment${qs ? `?${qs}` : ""}`;
  }
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [viewCandidateId, setViewCandidateId] = useState<string | null>(null);
  const [markingAsArrivedId, setMarkingAsArrivedId] = useState<string | null>(null);
  const [addToEmploymentCandidateId, setAddToEmploymentCandidateId] = useState<string | null>(null);
  const [isRowColorCodingEnabled, setIsRowColorCodingEnabled] = useState(true);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const hasFiltersApplied = Boolean(searchParams.q || searchParams.status_code || searchParams.sort);

  const handleViewClick = (candidateId: string) => {
    setViewCandidateId(candidateId);
  };

  const handleEditClick = (candidateId: string) => {
    setSelectedCandidateId(candidateId);
    setEditModalOpen(true);
  };

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

  const handleMarkAsArrived = async (candidateId: string) => {
    setMarkingAsArrivedId(candidateId);
    try {
      const res = await fetch(`/api/recruitment/candidates/${candidateId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status_code: "ARRIVED" }),
      });
      if (res.ok) router.refresh();
    } finally {
      setMarkingAsArrivedId(null);
    }
  };

  const startOfDayUTC = (d: Date) => {
    const out = new Date(d);
    out.setUTCHours(0, 0, 0, 0);
    return out;
  };

  /** Format date for display in Asia/Riyadh so calendar date matches what the user picked (avoids UTC date shift). */
  const formatDateColumn = (iso: string | null): string =>
    iso
      ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Riyadh" })
      : "-";

  return (
    <>
      <div className="space-y-4">
        {/* Part 1: Quick Stats Cards (click to sort; click again to clear) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {(
            [
              {
                sort: null,
                label: t("common.numberOfCandidates"),
                value: stats.totalCandidatesCount ?? data.total,
                tip: t("common.recruitmentStatTipTotalCandidates"),
                href: `/${locale}/recruitment`,
                icon: Users,
              },
              {
                sort: "under_procedure" as const,
                label: t("common.underProcedure"),
                value: stats.underProcedureCount,
                tip: t("common.recruitmentStatTipUnderProcedure"),
                href: buildRecruitmentUrl({ sort: "under_procedure", page: 1 }),
                icon: Clock3,
              },
              {
                sort: "arriving_soon" as const,
                label: t("common.arrivingWithin7Days"),
                value: stats.arrivingWithin7DaysCount,
                tip: t("common.recruitmentStatTipArrivingSoon"),
                href: buildRecruitmentUrl({ sort: "arriving_soon", page: 1 }),
                icon: Plane,
              },
              {
                sort: "older_than_45_days" as const,
                label: t("common.olderThan45Days"),
                value: stats.olderThan45DaysCount,
                tip: t("common.recruitmentStatTipOlderThan45Days"),
                href: buildRecruitmentUrl({ sort: "older_than_45_days", page: 1 }),
                icon: TriangleAlert,
              },
              {
                sort: "drafts" as const,
                label: t("common.drafts"),
                value: stats.draftCount,
                tip: t("common.recruitmentStatTipDrafts"),
                href: buildRecruitmentUrl({ sort: "drafts", page: 1 }),
                icon: FileText,
              },
            ] as const
          ).map(({ sort, label, value, tip, href, icon: Icon }) => {
            const isActive = sort === null ? !hasFiltersApplied : searchParams.sort === sort;
            return (
              <Link
                key={sort ?? "all_candidates"}
                href={sort === null ? href : isActive ? buildRecruitmentUrl({ sort: null, page: 1 }) : href}
                className={`group rounded-lg border p-4 transition-colors dark:bg-zinc-800 ${isActive
                  ? "border-primary bg-primary/5 ring-2 ring-primary/20 dark:bg-primary/10"
                  : "border-zinc-200 bg-white dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                  } cursor-pointer relative`}
              >
                <span
                  className={`absolute top-2 ${locale === "ar" ? "left-2" : "right-2"} group/tip inline-flex items-center justify-center rounded-full bg-zinc-100 p-1 text-primary/60 shadow-sm ring-1 ring-zinc-200 transition-colors hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:ring-zinc-600 dark:hover:bg-zinc-600`}
                  aria-label={tip}
                  tabIndex={0}
                >
                  <CircleHelp className="h-3.5 w-3.5" />
                  <span
                    className={`pointer-events-none absolute top-full z-20 mt-2 w-56 rounded-md border border-zinc-200 bg-white p-2 text-xs font-normal text-zinc-700 opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-visible/tip:opacity-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ${locale === "ar" ? "left-0 text-right" : "right-0 text-left"}`}
                    role="tooltip"
                  >
                    {tip}
                  </span>
                </span>
                <div className="flex items-center gap-2 text-sm text-primary/70">
                  <Icon className="h-4 w-4 text-primary/70" />
                  <span>{label}</span>
                </div>
                <div className="mt-1 text-2xl font-semibold text-primary">{value}</div>
              </Link>
            );
          })}
        </div>

        {/* Part 2: Control Buttons (aligned) */}
        <form className="flex justify-between items-center " action={`/${locale}/recruitment`} method="get">
          <div className="flex gap-2 bg-[#244473] p-2 rounded-md w-full max-w-3xl justify-between">
            <div className="flex gap-2 flex-1">
              {searchParams.sort ? (
                <input type="hidden" name="sort" value={searchParams.sort} />
              ) : null}
              <input
                name="q"
                defaultValue={searchParams.q ?? ""}
                placeholder={t("common.searchNameOfficePassport")}
                className="w-full max-w-sm rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-800"
              />
              <select
                name="status_code"
                defaultValue={searchParams.status_code ?? ""}
                className="w-full max-w-32 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-primary dark:border-zinc-700 dark:bg-zinc-800"
              >
                <option value="">{t("common.allStatuses")}</option>
                <option value="DRAFT">{t("common.statusDraft")}</option>
                <option value="UNDER_PROCEDURE">{t("common.statusUnderProcedure")}</option>
                <option value="ON_ARRIVAL">{t("common.statusOnArrival")}</option>
                <option value="ARRIVED">{t("common.statusArrived")}</option>
              </select>
              <label className="p-2 flex items-center gap-2 text-sm font-semibold bg-white border-1 rounded-md min-w-max">
                <input
                  type="checkbox"
                  checked={isRowColorCodingEnabled}
                  onChange={(e) => setIsRowColorCodingEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary dark:border-zinc-600"
                />
                <span>{t("common.recruitmentRowColorCoding")}</span>
              </label>
            </div>
            <div className="flex gap-2">
              <button className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700">
                {t("common.filter")}
              </button>
              {hasFiltersApplied ? (
                <Link
                  href={`/${locale}/recruitment`}
                  className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                >
                  {t("common.clearFilters")}
                </Link>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <details className="relative">
              <summary className="inline-flex list-none cursor-pointer items-center gap-2 rounded-md border border-[#0E5C2F] bg-[#107C41] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#185C37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#107C41]/40 dark:border-[#21A366] dark:bg-[#107C41] dark:hover:bg-[#185C37] [&::-webkit-details-marker]:hidden">
                <FileSpreadsheet className="h-4 w-4" />
                {t("common.excel")}
                <ChevronDown className="h-4 w-4" />
              </summary>
              <div className="absolute z-20 mt-2 min-w-40 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                <button
                  type="button"
                  onClick={() => setImportModalOpen(true)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-zinc-50 dark:hover:bg-zinc-700"
                >
                  <Upload className="h-4 w-4" />
                  {t("common.import")}
                </button>
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => {
                    void (async () => {
                      setExporting(true);
                      try {
                        await downloadRecruitmentExport({
                          q: searchParams.q,
                          status_code: searchParams.status_code,
                          sort: searchParams.sort,
                          locale: locale === "ar" ? "ar" : "en",
                        });
                      } catch (e) {
                        console.error(e);
                        alert(
                          e instanceof Error ? e.message : t("recruitment.import.exportFailed"),
                        );
                      } finally {
                        setExporting(false);
                      }
                    })();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {exporting ? t("common.loading") : t("common.export")}
                </button>
              </div>
            </details>
            <RecruitmentNewButton locale={locale} />
          </div>
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
                  const olderThan45Days =
                    (c.status_code === "UNDER_PROCEDURE" || c.status_code === "DRAFT") &&
                    !!c.visa_sent_at &&
                    new Date(c.visa_sent_at).getTime() < new Date().getTime() - 45 * 24 * 60 * 60 * 1000;
                  const now = new Date();
                  const todayStart = startOfDayUTC(now);
                  const twoDaysLater = new Date(todayStart);
                  twoDaysLater.setUTCDate(twoDaysLater.getUTCDate() + 2);
                  const isArrivalImminent =
                    !!c.expected_arrival_at &&
                    (() => {
                      const arrivalStart = startOfDayUTC(new Date(c.expected_arrival_at!));
                      return arrivalStart >= todayStart && arrivalStart <= twoDaysLater;
                    })();
                  const onArrivalPastDue =
                    c.status_code === "ON_ARRIVAL" &&
                    !!c.expected_arrival_at &&
                    startOfDayUTC(new Date(c.expected_arrival_at)) < todayStart;
                  return (
                    <tr
                      key={c.id}
                      className={`border-b border-zinc-100 dark:border-zinc-700 ${isRowColorCodingEnabled
                        ? c.status_code === "DRAFT"
                          ? "bg-zinc-300 dark:bg-zinc-800/80"
                          : c.status_code === "ARRIVED"
                            ? "bg-green-100 dark:bg-green-900/20"
                            : arrivalSoon
                              ? "bg-amber-100 dark:bg-amber-900/20"
                              : olderThan45Days
                                ? "bg-red-200 dark:bg-red-900/20"
                                : onArrivalPastDue
                                  ? "bg-red-200 dark:bg-red-900/20"
                                  : ""
                        : ""
                        } ${isArrivalImminent || onArrivalPastDue ? "font-semibold" : ""} ${locale === "ar" ? "text-right" : "text-left"}`}
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
                      <td className="px-3 py-2">{formatDateColumn(c.visa_sent_at)}</td>
                      <td className="px-3 py-2">{c.passport_no}</td>
                      <td className="px-3 py-2">{formatDateColumn(c.expected_arrival_at)}</td>
                      <td className="px-3 py-2">{getStatusTranslation(c.status_code)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleViewClick(c.id)}
                            className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                            title={t("common.view")}
                            aria-label={t("common.view")}
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleEditClick(c.id)}
                            className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                            title={t("common.edit")}
                            aria-label={t("common.edit")}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {c.status_code === "ON_ARRIVAL" && (
                            <button
                              onClick={() => handleMarkAsArrived(c.id)}
                              disabled={markingAsArrivedId === c.id}
                              className="rounded-md p-1.5 text-green-700 hover:bg-green-100 dark:text-green-300 dark:hover:bg-green-900/30 disabled:opacity-50"
                              title={t("common.markAsArrived") || "Mark as Arrived"}
                              aria-label={t("common.markAsArrived") || "Mark as Arrived"}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setAddToEmploymentCandidateId(c.id)}
                            className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                            title={t("employment.addToEmployment")}
                            aria-label={t("employment.addToEmployment")}
                          >
                            <User className="h-4 w-4" />
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
              href={buildRecruitmentUrl({
                sort: (searchParams.sort as SortValue) || null,
                page: page - 1,
              })}
            >
              {t("common.prev")}
            </Link>
            <Link
              className={`rounded-md border border-zinc-200 px-3 py-1 text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 ${page * data.page_size >= data.total ? "pointer-events-none opacity-50" : ""}`}
              href={buildRecruitmentUrl({
                sort: (searchParams.sort as SortValue) || null,
                page: page + 1,
              })}
            >
              {t("common.next")}
            </Link>
          </div>
        </div>
      </div>
      <RecruitmentViewModal
        isOpen={!!viewCandidateId}
        onClose={() => setViewCandidateId(null)}
        candidateId={viewCandidateId}
        locale={locale}
        onDataChange={() => router.refresh()}
      />
      <RecruitmentEditModal
        isOpen={editModalOpen}
        onClose={() => {
          setEditModalOpen(false);
          setSelectedCandidateId(null);
        }}
        locale={locale}
        candidateId={selectedCandidateId}
      />
      <EmploymentModal
        isOpen={!!addToEmploymentCandidateId}
        onClose={() => setAddToEmploymentCandidateId(null)}
        locale={locale}
        recruitmentCandidateId={addToEmploymentCandidateId}
      />
      <RecruitmentImportModal
        isOpen={importModalOpen}
        onClose={() => {
          setImportModalOpen(false);
          router.refresh();
        }}
        locale={locale}
      />
    </>
  );
}

