"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, FileSpreadsheet, FileText, Maximize2, Minimize2, Printer } from "lucide-react";
import { useTranslations } from "next-intl";
import type { ReportCatalogItem, ReportDataResponse } from "@/lib/types/reports";
import { ReportFilters } from "./ReportFilters";
import { ReportTable } from "./ReportTable";

export function ReportCard({
  report,
  month,
  locale,
  data,
  loading,
  onExpand,
  onFilterChange,
  filters,
  width,
  onWidthChange,
}: {
  report: ReportCatalogItem;
  month: string;
  locale: string;
  data: ReportDataResponse | null;
  loading: boolean;
  onExpand: () => void;
  onFilterChange: (k: string, v: string) => void;
  filters: Record<string, string>;
  width: "half" | "full";
  onWidthChange: (width: "half" | "full") => void;
}) {
  const t = useTranslations();
  const translate = (key: string) => t(key as Parameters<typeof t>[0]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const exportFilters = useMemo(() => {
    const hasDate = Boolean(filters.date_from || filters.date_to);
    return {
      ...filters,
      ...(hasDate ? {} : { month }),
      locale,
    };
  }, [filters, month, locale]);

  const handleExportClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!data || data.rows.length === 0) {
      e.preventDefault();
      setToast(t("reports.noDataToExport"));
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handlePrintClick = () => {
    if (!data || data.rows.length === 0) {
      setToast(t("reports.noDataToPrint"));
      setTimeout(() => setToast(null), 3000);
      return;
    }
    window.print();
  };

  return (
    <div
      className={`relative rounded-lg border border-zinc-200 bg-white shadow-sm transition-all dark:border-zinc-700 dark:bg-zinc-800 ${
        width === "full" ? "lg:col-span-2" : "lg:col-span-1"
      }`}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="font-semibold text-primary">{translate(report.title_code)}</h3>
          <p className="text-xs text-primary/70">{translate(report.description_code)}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/reports/${report.key}/export?${new URLSearchParams({ ...exportFilters, format: "xlsx" }).toString()}`}
            onClick={handleExportClick}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
            title={t("common.excel")}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>{t("common.excel")}</span>
          </a>
          <a
            href={`/api/reports/${report.key}/export?${new URLSearchParams({ ...exportFilters, format: "pdf" }).toString()}`}
            onClick={handleExportClick}
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 shadow-sm transition hover:border-red-300 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/50"
            title={t("reports.pdf")}
          >
            <FileText className="h-4 w-4" />
            <span>{t("reports.pdf")}</span>
          </a>
          <button type="button" onClick={handlePrintClick} className="rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700" title={t("common.print")}>
            <Printer className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onWidthChange(width === "full" ? "half" : "full")}
            className="rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            title={width === "full" ? t("reports.halfWidthCard") : t("reports.fullWidthCard")}
            aria-label={width === "full" ? t("reports.halfWidthCard") : t("reports.fullWidthCard")}
          >
            {width === "full" ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !open;
              setOpen(next);
              if (next) onExpand();
            }}
            className="rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700"
            title={t("common.expand")}
          >
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open ? (
        <div className="space-y-3 border-t border-zinc-200 p-4 dark:border-zinc-700">
          <ReportFilters filters={report.filters} values={filters} onChange={onFilterChange} />
          {loading ? (
            <div className="text-sm text-primary/60">{t("common.loading")}</div>
          ) : (
            <ReportTable
              data={data}
              columns={width === "full" ? [...report.preview_columns, ...report.export_columns] : undefined}
            />
          )}
        </div>
      ) : null}
      {toast ? (
        <div className="absolute bottom-3 start-1/2 z-50 -translate-x-1/2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 shadow-lg dark:border-amber-800 dark:bg-amber-950/90 dark:text-amber-100">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
