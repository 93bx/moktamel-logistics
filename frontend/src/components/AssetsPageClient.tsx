"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AssetNewModal } from "./AssetNewModal";
import { AssetRecoveryModal } from "./AssetRecoveryModal";
import { AssetLossReportModal } from "./AssetLossReportModal";
import { AssetViewEditModal } from "./AssetViewEditModal";
import { AssetsTable } from "./AssetsTable";

type AssetListItem = {
  id: string;
  employee_no: string | null;
  employee_code?: string | null;
  recruitment_candidate: { full_name_ar: string; full_name_en: string | null; passport_no: string; nationality: string } | null;
  assets: Array<{
    id: string;
    status_code: string;
    receive_date: string;
    condition_code: string;
    asset: { id: string; type: string; name: string; price: string; vehicle_id: string | null; license_plate?: string };
    created_at: string;
    updated_at?: string;
  }>;
  contract_end_at: string | null;
};

type StatsData = {
  assetsValue: number;
  custodians: number;
  deductions: number;
  pendingRecovery: number;
};

export function AssetsPageClient({
  locale,
  data,
  stats,
  searchParams,
  page,
}: {
  locale: string;
  data: { items: AssetListItem[]; total: number; page: number; page_size: number };
  stats: StatsData;
  searchParams: { q?: string };
  page: number;
}) {
  const t = useTranslations();
  const [showNewAsset, setShowNewAsset] = useState(false);
  const [showRecovery, setShowRecovery] = useState(false);
  const [showLossReport, setShowLossReport] = useState(false);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  const openView = (id: string) => {
    setSelectedAssignmentId(id);
  };

  const closeView = () => setSelectedAssignmentId(null);

  const handleOpenLossReport = (employeeId?: string) => {
    setSelectedEmployeeId(employeeId || null);
    setShowLossReport(true);
  };

  const handleOpenRecovery = (employeeId?: string) => {
    setSelectedEmployeeId(employeeId || null);
    setShowRecovery(true);
  };

  return (
    <>
      <div className="space-y-4">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
            <div className="text-sm text-primary/60">{t("assets.assetsValue")}</div>
            <div className="mt-1 text-2xl font-semibold text-primary">{stats.assetsValue.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
            <div className="text-sm text-primary/60">{t("assets.custodians")}</div>
            <div className="mt-1 text-2xl font-semibold text-primary">{stats.custodians}</div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
            <div className="text-sm text-primary/60">{t("assets.deductionsThisMonth")}</div>
            <div className="mt-1 text-2xl font-semibold text-primary">{stats.deductions.toLocaleString()}</div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
            <div className="text-sm text-primary/60">{t("assets.pendingRecovery")}</div>
            <div className="mt-1 text-2xl font-semibold text-primary">{stats.pendingRecovery}</div>
          </div>
        </div>

        {/* Controls */}
        <form className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" action={`/${locale}/assets`} method="get">
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder={t("assets.searchEmployeeAsset")}
            className="w-full max-w-sm rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-800"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              {t("common.filter")}
            </button>
            <button
              type="button"
              onClick={() => setShowNewAsset(true)}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow hover:bg-primary/90"
            >
              {t("assets.newAsset")}
            </button>
            <button
              type="button"
              onClick={() => handleOpenRecovery()}
              className="rounded-md border border-primary/30 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5"
            >
              {t("assets.receiveAsset")}
            </button>
            <button
              type="button"
              onClick={() => handleOpenLossReport()}
              className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100"
            >
              {t("assets.newLossReport")}
            </button>
          </div>
        </form>

        {/* Table */}
        <AssetsTable
          locale={locale}
          items={data.items}
          onView={(id) => openView(id)}
          onReceive={(id) => handleOpenRecovery(id)}
          onLossReport={(id) => handleOpenLossReport(id)}
        />

        <div className="flex items-center justify-between text-sm text-primary/80">
          <div>
            {t("common.total")}: {data.total} ({t("common.page")} {data.page})
          </div>
          <div className="flex gap-2">
            <Link
              className={`rounded-md border border-zinc-200 px-3 py-1 text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
              href={`/${locale}/assets?q=${encodeURIComponent(searchParams.q ?? "")}&page=${page - 1}`}
            >
              {t("common.prev")}
            </Link>
            <Link
              className={`rounded-md border border-zinc-200 px-3 py-1 text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 ${page * data.page_size >= data.total ? "pointer-events-none opacity-50" : ""}`}
              href={`/${locale}/assets?q=${encodeURIComponent(searchParams.q ?? "")}&page=${page + 1}`}
            >
              {t("common.next")}
            </Link>
          </div>
        </div>
      </div>

      <AssetNewModal isOpen={showNewAsset} onClose={() => window.location.reload()} locale={locale} />
      <AssetRecoveryModal 
        isOpen={showRecovery} 
        onClose={() => window.location.reload()} 
        locale={locale} 
        // Note: AssetRecoveryModal would need to be updated to handle selectedEmployeeId if needed
      />
      <AssetLossReportModal 
        isOpen={showLossReport} 
        onClose={() => window.location.reload()} 
        locale={locale} 
        initialEmployeeId={selectedEmployeeId}
      />
      <AssetViewEditModal isOpen={!!selectedAssignmentId} onClose={() => closeView()} locale={locale} assignmentId={selectedAssignmentId} />
    </>
  );
}
