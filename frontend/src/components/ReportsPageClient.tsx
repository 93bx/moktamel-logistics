"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import type { ReportCatalogItem, ReportDataResponse, ReportTabKey } from "@/lib/types/reports";
import { ReportCard } from "./reports/ReportCard";
import { fetchReportPreview } from "@/lib/reports";

const tabs: Array<{ key: ReportTabKey; labelKey: string }> = [
  { key: "operations", labelKey: "reports.tabs.operations" },
  { key: "finance", labelKey: "reports.tabs.finance" },
  { key: "hr", labelKey: "reports.tabs.hr" },
  { key: "docs_assets", labelKey: "reports.tabs.docsAssets" },
];

export function ReportsPageClient({
  locale,
  month,
  catalog,
}: {
  locale: string;
  month: string;
  catalog: ReportCatalogItem[];
}) {
  const t = useTranslations();
  const tDashboard = useTranslations("dashboard");
  const translate = useCallback((key: string) => t(key as Parameters<typeof t>[0]), [t]);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ReportTabKey>("operations");
  const [search, setSearch] = useState("");
  const [dataByKey, setDataByKey] = useState<Record<string, ReportDataResponse | null>>({});
  const [loadingByKey, setLoadingByKey] = useState<Record<string, boolean>>({});
  const [filtersByKey, setFiltersByKey] = useState<Record<string, Record<string, string>>>({});
  const [cardWidthsByKey, setCardWidthsByKey] = useState<Record<string, "half" | "full">>({});
  const [selectedYear, setSelectedYear] = useState(() => Number(month.split("-")[0]));
  const [selectedMonth, setSelectedMonth] = useState(() => Number(month.split("-")[1]));

  const currentDate = useMemo(() => new Date(), []);
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const years = useMemo(() => {
    const y = [];
    for (let i = currentYear - 2; i <= currentYear + 1; i += 1) {
      y.push(i);
    }
    return y;
  }, [currentYear]);

  const visibleMonths = useMemo(() => {
    if (selectedYear < currentYear) return Array.from({ length: 12 }, (_, i) => i + 1);
    if (selectedYear === currentYear) return Array.from({ length: currentMonth }, (_, i) => i + 1);
    return [];
  }, [selectedYear, currentYear, currentMonth]);

  const handleMonthChange = (newYear: number, newMonth: number) => {
    setSelectedYear(newYear);
    setSelectedMonth(newMonth);
    router.push(`/${locale}/reports?month=${newYear}-${String(newMonth).padStart(2, "0")}`);
  };

  const visibleCards = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length <= 1) return catalog.filter((c) => c.tab === activeTab);
    return catalog.filter((c) => {
      const tabLabelKey = tabs.find((tab) => tab.key === c.tab)?.labelKey;
      return (
        translate(c.title_code).toLowerCase().includes(q) ||
        translate(c.description_code).toLowerCase().includes(q) ||
        (tabLabelKey ? translate(tabLabelKey).toLowerCase().includes(q) : false)
      );
    });
  }, [catalog, activeTab, search, translate]);

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-primary">{tDashboard("controls.year")}</label>
            <select
              value={selectedYear}
              onChange={(e) => {
                const newYear = Number(e.target.value);
                setSelectedYear(newYear);
                const nextMonth = newYear === currentYear ? Math.min(selectedMonth, currentMonth) : selectedMonth;
                handleMonthChange(newYear, nextMonth);
              }}
              className="rounded-xl border border-primary bg-slate-50/80 px-3 py-2 text-sm font-semibold text-primary outline-none"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {visibleMonths.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleMonthChange(selectedYear, m)}
                className={`min-w-[3.5rem] rounded-xl px-3 py-2 text-sm font-semibold transition-all ${selectedMonth === m
                  ? "bg-primary-600 text-white shadow-md"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-700 dark:text-slate-300"
                  }`}
              >
                {tDashboard(`controls.month${m}` as "controls.month1")}
              </button>
            ))}
          </div>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("reports.searchPlaceholder")}
            className="ms-auto w-full rounded-md border border-zinc-200 px-3 py-2 text-sm sm:max-w-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      <div className="border-b border-zinc-200 dark:border-zinc-700">
        <nav className="flex flex-wrap gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-sm font-medium ${
                activeTab === tab.key
                  ? "border-b-2 border-primary text-primary"
                  : "text-primary/60 hover:text-primary"
              }`}
            >
              {translate(tab.labelKey)}
            </button>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {visibleCards.map((report) => {
          const filters = filtersByKey[report.key] ?? {};
          return (
            <ReportCard
              key={report.key}
              report={report}
              month={month}
              locale={locale}
              data={dataByKey[report.key] ?? null}
              loading={loadingByKey[report.key] ?? false}
              filters={filters}
              width={cardWidthsByKey[report.key] ?? "half"}
              onWidthChange={(width) =>
                setCardWidthsByKey((prev) => ({
                  ...prev,
                  [report.key]: width,
                }))
              }
              onFilterChange={(k, v) =>
                setFiltersByKey((prev) => ({
                  ...prev,
                  [report.key]: { ...(prev[report.key] ?? {}), [k]: v },
                }))
              }
              onExpand={async () => {
                if (dataByKey[report.key] || loadingByKey[report.key]) return;
                setLoadingByKey((prev) => ({ ...prev, [report.key]: true }));
                try {
                  const next = await fetchReportPreview(report.key, {
                    ...(filtersByKey[report.key] ?? {}),
                    month,
                  });
                  setDataByKey((prev) => ({ ...prev, [report.key]: next }));
                } catch {
                  setDataByKey((prev) => ({ ...prev, [report.key]: null }));
                } finally {
                  setLoadingByKey((prev) => ({ ...prev, [report.key]: false }));
                }
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
