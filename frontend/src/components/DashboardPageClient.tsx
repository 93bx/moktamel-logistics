"use client";

import { useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { DashboardOverviewPayload } from "@/app/[locale]/(app)/dashboard/page";

type Props = {
  locale: string;
  payload: DashboardOverviewPayload;
};

const formatAmount = (v: number) =>
  Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const KPI_ACCENTS = [
  "border-l-primary-500 bg-gradient-to-br from-primary-50/80 to-white dark:from-primary-950/30 dark:to-zinc-900",
  "border-l-indigo-500 bg-gradient-to-br from-indigo-50/80 to-white dark:from-indigo-950/30 dark:to-zinc-900",
  "border-l-emerald-500 bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-zinc-900",
  "border-l-amber-500 bg-gradient-to-br from-amber-50/80 to-white dark:from-amber-950/30 dark:to-zinc-900",
  "border-l-rose-500 bg-gradient-to-br from-rose-50/80 to-white dark:from-rose-950/30 dark:to-zinc-900",
  "border-l-sky-500 bg-gradient-to-br from-sky-50/80 to-white dark:from-sky-950/30 dark:to-zinc-900",
] as const;

function StatCard({
  label,
  value,
  previousText,
  trend,
  pctText,
  drillDownHref,
  drillDownLabel,
  accentIndex = 0,
}: {
  label: string;
  value: string | number;
  previousText?: string;
  trend?: "up" | "down" | "neutral";
  pctText?: string | null;
  drillDownHref?: string;
  drillDownLabel?: string;
  accentIndex?: number;
}) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendStyles =
    trend === "up"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
      : trend === "down"
        ? "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
        : "bg-slate-100 text-slate-600 dark:bg-zinc-700 dark:text-zinc-400";
  const accent = KPI_ACCENTS[accentIndex % KPI_ACCENTS.length];
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200/80 border-l-4 shadow-md transition-all duration-200 hover:shadow-lg dark:border-zinc-700/80 ${accent}`}
    >
      <div className="p-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-primary dark:text-slate-400">
          {label}
        </p>
        <p className="mt-2 text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
          {value}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          {previousText != null && (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{previousText}</p>
          )}
          {trend != null && (
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${trendStyles}`}
            >
              <TrendIcon className="h-3.5 w-3.5 shrink-0" />
              {pctText != null && pctText !== "" ? pctText : ""}
            </span>
          )}
          {drillDownHref != null && drillDownLabel != null && (
            <Link
              href={drillDownHref}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100/80 px-2.5 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-200/80 hover:text-slate-900 dark:bg-zinc-700/80 dark:text-slate-300 dark:hover:bg-zinc-600/80 dark:hover:text-slate-100"
            >
              {drillDownLabel}
              <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export function DashboardPageClient({ locale, payload }: Props) {
  const t = useTranslations("dashboard");
  const [opsRankMode, setOpsRankMode] = useState<"top" | "worst">("top");
  const [opsMetricMode, setOpsMetricMode] = useState<"orders" | "revenue">("orders");
  const [perfChartMetric, setPerfChartMetric] = useState<"orders" | "revenue">("orders");

  const { meta, kpis, operations, platforms, cashFlow, notifications, links } = payload;

  const opsRows = useMemo(() => {
    if (opsMetricMode === "orders") {
      return opsRankMode === "top" ? operations.top10_by_orders : operations.worst10_by_orders;
    }
    return opsRankMode === "top" ? operations.top10_by_revenue : operations.worst10_by_revenue;
  }, [operations, opsRankMode, opsMetricMode]);

  const perfData = useMemo(
    () =>
      operations.daily_performance.map((d) => ({
        date: d.date.slice(5),
        orders: d.orders,
        revenue: d.revenue,
      })),
    [operations.daily_performance]
  );

  const cashCollectedData = useMemo(
    () =>
      cashFlow.daily_collected.map((d) => ({
        date: d.date.slice(5),
        amount: d.amount,
      })),
    [cashFlow.daily_collected]
  );

  const platformData = useMemo(
    () =>
      platforms.map((p) => ({
        name: p.platform,
        orders: p.orders,
        revenue: p.revenue,
        avg: p.avg_order_value,
      })),
    [platforms]
  );

  const dailyOpsUrl = links.daily_operations
    ? `/${locale}/daily-operations${links.daily_operations}`
    : `/${locale}/daily-operations`;

  const cashLoansUrl = links.cash_loans
    ? `/${locale}/cash-loans${links.cash_loans}`
    : `/${locale}/cash-loans`;
  const documentsUrl = links.documents
    ? `/${locale}/documents${links.documents}`
    : `/${locale}/documents?tab=near_expiry`;
  const fleetUrl = links.fleet ? `/${locale}/fleet${links.fleet}` : `/${locale}/fleet`;
  const employmentUrl = `/${locale}/employment`;

  const kpiPrevious = (key: keyof typeof kpis) => {
    const k = kpis[key];
    const prev = key === "gas_per_order" ? formatAmount(k.previous) : k.previous.toLocaleString();
    return `${t("compareVsPrevious")} ${prev}`;
  };

  const kpiPct = (key: keyof typeof kpis): string | null => {
    const k = kpis[key];
    return k.pct_delta != null ? `${k.pct_delta >= 0 ? "+" : ""}${k.pct_delta.toFixed(1)}%` : null;
  };

  const tooltipContentStyle = {
    borderRadius: 12,
    border: "1px solid var(--border, #e2e8f0)",
    boxShadow: "0 10px 40px -10px rgba(0,0,0,0.15)",
    padding: "12px 16px",
    background: "var(--tooltip-bg, #fff)",
    fontSize: 13,
  };

  const [selectedYear, setSelectedYear] = useState(() => {
    const [y] = meta.selected_month.split("-").map(Number);
    return y;
  });
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const [, m] = meta.selected_month.split("-").map(Number);
    return m;
  });
  const formRef = useRef<HTMLFormElement>(null);

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => current - 2 + i);
  }, []);

  const handleMonthClick = (month: number) => {
    setSelectedMonth(month);
    const yearSelect = formRef.current?.querySelector<HTMLSelectElement>("select");
    const year = yearSelect ? Number(yearSelect.value) : selectedYear;
    const value = `${year}-${String(month).padStart(2, "0")}`;
    const input = formRef.current?.querySelector<HTMLInputElement>('input[name="month"]');
    if (input) {
      input.value = value;
      formRef.current?.submit();
    }
  };

  const isRtl = locale === "ar";
  const tableDir = isRtl ? "rtl" : "ltr";
  const tableHeaderClass = "bg-primary px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white text-start";
  const tableHeaderClassRight = "bg-primary px-4 py-3 text-xs font-semibold uppercase tracking-wider text-white text-end";

  return (
    <div className="space-y-3">
      {/* Controls: full row — year dropdown + month buttons */}
      <form
        ref={formRef}
        action={`/${locale}/dashboard`}
        method="get"
        className="flex w-full flex-wrap items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/80"
      >
        <input type="hidden" name="month" value={`${selectedYear}-${String(selectedMonth).padStart(2, "0")}`} readOnly />
        <div className="flex items-center gap-2">
          <label className="text-sm font-semibold text-primary">
            {t("controls.year")}
          </label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="rounded-xl border border-primary bg-slate-50/80 px-3 py-2 text-sm font-semibold text-primary outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-slate-200"
            aria-label={t("controls.year")}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-between">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleMonthClick(m)}
              className={`min-w-[4rem] rounded-xl px-3 py-2 text-sm font-semibold transition-all ${selectedMonth === m
                ? "bg-primary-600 text-white shadow-md"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-700 dark:text-slate-300 dark:hover:bg-zinc-600"
                }`}
            >
              {t(`controls.month${m}` as "controls.month1")}
            </button>
          ))}
        </div>
      </form>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          accentIndex={0}
          label={t("cards.activeEmployees")}
          value={kpis.active_employees.current.toLocaleString()}
          previousText={kpiPrevious("active_employees")}
          trend={kpis.active_employees.trend}
          pctText={kpiPct("active_employees")}
          drillDownHref={employmentUrl}
          drillDownLabel={t("links.viewEmployment")}
        />
        <StatCard
          accentIndex={1}
          label={t("cards.totalOrders")}
          value={kpis.total_orders.current.toLocaleString()}
          previousText={kpiPrevious("total_orders")}
          trend={kpis.total_orders.trend}
          pctText={kpiPct("total_orders")}
          drillDownHref={dailyOpsUrl}
          drillDownLabel={t("links.viewDailyOps")}
        />
        <StatCard
          accentIndex={2}
          label={t("cards.totalRevenue")}
          value={formatAmount(kpis.total_revenue.current)}
          previousText={kpiPrevious("total_revenue")}
          trend={kpis.total_revenue.trend}
          pctText={kpiPct("total_revenue")}
          drillDownHref={dailyOpsUrl}
          drillDownLabel={t("links.viewDailyOps")}
        />
        <StatCard
          accentIndex={3}
          label={t("cards.totalCashCollected")}
          value={formatAmount(kpis.total_cash_collected.current)}
          previousText={kpiPrevious("total_cash_collected")}
          trend={kpis.total_cash_collected.trend}
          pctText={kpiPct("total_cash_collected")}
          drillDownHref={cashLoansUrl}
          drillDownLabel={t("links.viewCashLoans")}
        />
        <StatCard
          accentIndex={4}
          label={t("cards.totalDeductions")}
          value={formatAmount(kpis.total_deductions.current)}
          previousText={kpiPrevious("total_deductions")}
          trend={kpis.total_deductions.trend}
          pctText={kpiPct("total_deductions")}
          drillDownHref={dailyOpsUrl}
          drillDownLabel={t("links.viewDailyOps")}
        />
        <StatCard
          accentIndex={5}
          label={t("cards.gasPerOrder")}
          value={formatAmount(kpis.gas_per_order.current)}
          previousText={kpiPrevious("gas_per_order")}
          trend={kpis.gas_per_order.trend}
          pctText={kpiPct("gas_per_order")}
          drillDownHref={fleetUrl}
          drillDownLabel={t("links.viewFleet")}
        />
      </div>

      {/* Operations: table + charts */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md dark:border-zinc-700/80 dark:bg-zinc-900/80">
        <div className="bg-primary/90 border-b border-slate-200/80 px-6 py-2 dark:border-zinc-700/80">
          <h2 className="text-lg font-bold tracking-tight text-white dark:text-slate-100">
            {t("operations.title")}
          </h2>
        </div>
        <div className="flex flex-col ">
          
          <div className="flex flex-col">
            <div className="flex flex-wrap justify-between border-x-1 border-primary/90">
              <div className="flex rounded-xl bg-slate-100/80 p-1 dark:bg-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setOpsRankMode("top")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${opsRankMode === "top" ? "bg-primary-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400"}`}
                >
                  {t("operations.top10")}
                </button>
                <button
                  type="button"
                  onClick={() => setOpsRankMode("worst")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${opsRankMode === "worst" ? "bg-primary-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400"}`}
                >
                  {t("operations.worst10")}
                </button>
              </div>
              <div className="flex rounded-xl bg-slate-100/80 p-1 dark:bg-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setOpsMetricMode("orders")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${opsMetricMode === "orders" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400"}`}
                >
                  {t("operations.byOrders")}
                </button>
                <button
                  type="button"
                  onClick={() => setOpsMetricMode("revenue")}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${opsMetricMode === "revenue" ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 dark:text-slate-400"}`}
                >
                  {t("operations.byRevenue")}
                </button>
              </div>
            </div>
            {opsRows.length > 0 ? (
              <div className="min-h-[320px] overflow-hidden border border-primary/90 border-t-0 rounded-b-lg">
                <table className="w-full text-sm" dir={tableDir}>
                  <thead>
                    <tr className={tableDir === "rtl" ? "text-right" : "text-left"}>
                      <th className={tableHeaderClass}>{t("operations.employee")}</th>
                      <th className={tableHeaderClass}>{t("operations.orders")}</th>
                      <th className={tableHeaderClass}>{t("operations.revenue")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-700/50">
                    {opsRows.map((row, i) => (
                      <tr
                        key={row.employment_record_id}
                        className={i % 2 === 0 ? "bg-white dark:bg-zinc-900/50" : "bg-slate-50/50 dark:bg-zinc-800/30"}
                      >
                        <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                          {locale === "ar" ? row.full_name_ar : row.full_name_en ?? row.full_name_ar}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-slate-700 dark:text-slate-300">
                          {row.orders.toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-medium text-slate-800 dark:text-slate-200">
                          {formatAmount(row.revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-12 dark:border-zinc-700">
                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                  {t("empty.noReviewedOps")}
                </p>
              </div>
            )}
          </div>

          <div className="flex pt-2">
            <div className="flex flex-1 flex-col">
              <div className="flex justify-between items-center gap-2">
                <p className="text-lg px-2 font-semibold text-primary dark:text-slate-400">{t("chart.performance")}</p>
                <div className="flex px-2">
                  <button
                    type="button"
                    onClick={() => setPerfChartMetric("orders")}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-all ${perfChartMetric === "orders" ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-400"}`}
                  >
                    {t("chart.orders")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPerfChartMetric("revenue")}
                    className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-all ${perfChartMetric === "revenue" ? "bg-indigo-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-400"}`}
                  >
                    {t("chart.revenue")}
                  </button>

                </div>
              </div>
              {perfData.length > 0 ? (
                <div className="min-h-[320px] w-full">
                  <ResponsiveContainer width="100%" minHeight={320}>
                    <LineChart data={perfData} margin={{ top: 8, right: 8, left: -15, bottom: 0 }} style={{ margin: 0, padding: 0 }}>
                      <defs>
                        <linearGradient id="perfGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3 3 3" stroke="rgba(148,163,184,0.3)" vertical={true} />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fontWeight: 700 }} stroke="#94a3b8" />
                      <YAxis tick={{ fontSize: 11, fontWeight: 700 }} tickMargin={20} stroke="#94a3b8" />
                      <Tooltip
                        contentStyle={tooltipContentStyle}
                        formatter={(v: number | undefined) => [perfChartMetric === "revenue" ? formatAmount(v ?? 0) : (v ?? 0), perfChartMetric === "orders" ? t("chart.orders") : t("chart.revenue")]}
                      />
                      <Line
                        type="monotone"
                        dataKey={perfChartMetric}
                        stroke="#6366f1"
                        strokeWidth={2.5}
                        dot={false}
                        name={perfChartMetric === "orders" ? t("chart.orders") : t("chart.revenue")}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-12 dark:border-zinc-700">
                  <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                    {t("empty.noDailyPerf")}
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col">
              <div className="py-1">
                <p className="text-lg px-5 font-semibold text-primary dark:text-slate-400">{t("platforms.title")}</p>
              </div>
              {platformData.length > 0 ? (
                <ResponsiveContainer width="100%" minHeight={320}>
                  <BarChart data={platformData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="platformBar" x1="0" y1="1" x2="0" y2="0">
                        <stop offset="0%" stopColor="#0d9488" stopOpacity={0.75} />
                        <stop offset="100%" stopColor="#0d9488" stopOpacity={1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.3)" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700 }} stroke="#94a3b8" />
                    <YAxis tick={{ fontSize: 11, fontWeight: 700 }} tickMargin={45} tickFormatter={(v) => formatAmount(v)} stroke="#94a3b8" />
                    <Tooltip
                      contentStyle={tooltipContentStyle}
                      formatter={(v: number | undefined) => [formatAmount(v ?? 0), t("platforms.revenue")]}
                      labelFormatter={(label) => {
                        const row = platformData.find((d) => d.name === label);
                        return row ? `${label} — ${t("platforms.orders")}: ${row.orders}` : label;
                      }}
                    />
                    <Bar dataKey="revenue" fill="url(#platformBar)" name={t("platforms.revenue")} radius={[4, 4, 0, 0]} maxBarSize={48} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16 dark:border-zinc-700">
                  <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                    {t("empty.noPlatformData")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Cash flow */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md dark:border-zinc-700/80 dark:bg-zinc-900/80">
        <div className="bg-primary/90 border-b border-slate-200/80 px-6 py-2 dark:border-zinc-700/80">
          <h2 className="text-lg font-bold tracking-tight text-white dark:text-slate-100">
            {t("cashFlow.title")}
          </h2>
        </div>
        <div className="flex gap-2 pt-2">
          <div className="flex flex-2 flex-col">
            <h3 className="mb-2 px-2 text-sm font-semibold uppercase tracking-wider text-primary dark:text-slate-400">
              {t("cashFlow.topUncollected")}
            </h3>
            {cashFlow.top10_uncollected.length > 0 ? (
              <div className="overflow-hidden  border border-slate-200/80 dark:border-zinc-700/80">
                <table className="w-full text-sm" dir={tableDir}>
                  <thead>
                    <tr>
                      <th className={tableHeaderClass}>{t("cashFlow.employee")}</th>
                      <th className={tableHeaderClassRight}>{t("cashFlow.amount")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-700/50">
                    {cashFlow.top10_uncollected.map((row, i) => (
                      <tr
                        key={row.employment_record_id}
                        className={i % 2 === 0 ? "bg-white dark:bg-zinc-900/50" : "bg-slate-50/50 dark:bg-zinc-800/30"}
                      >
                        <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                          {locale === "ar" ? row.full_name_ar : row.full_name_en ?? row.full_name_ar}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                          {formatAmount(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-12 dark:border-zinc-700">
                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                  {t("empty.noUncollected")}
                </p>
              </div>
            )}
          </div>
          <div className="flex flex-3 flex-col">
            <h3 className="mb-2 px-4 text-sm font-semibold uppercase tracking-wider text-primary dark:text-slate-400">
              {t("cashFlow.dailyCollected")}
            </h3>
            {cashCollectedData.length > 0 ? (
              <ResponsiveContainer width="100%" minHeight={240}>
                <LineChart data={cashCollectedData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.3)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fontWeight: 700 }} stroke="#94a3b8" />
                  <YAxis tick={{ fontSize: 11, fontWeight: 700 }} tickFormatter={(v) => formatAmount(v)} tickMargin={35} stroke="#94a3b8" />
                  <Tooltip contentStyle={tooltipContentStyle} formatter={(v: number | undefined) => [formatAmount(v ?? 0), t("cashFlow.amount")]} />
                  <Line type="monotone" dataKey="amount" stroke="#22c55e" strokeWidth={2.5} dot={false} name={t("cashFlow.amount")} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-12 dark:border-zinc-700">
                <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                  {t("empty.noDailyCollected")}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Notifications */}
      <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-md dark:border-zinc-700/80 dark:bg-zinc-900/80">
        <div className="bg-primary/90 border-b border-slate-200/80 px-6 py-2 dark:border-zinc-700/80 dark:bg-zinc-800/50">
          <h2 className="text-lg font-bold tracking-tight text-white dark:text-slate-100">
            {t("notifications.title")}
          </h2>
        </div>
        <div className="p-0 m-0">
          {notifications.length > 0 ? (
            <div className="overflow-hidden  ">
              <table className="w-full text-sm mt-0 border-collapse" dir={tableDir}>
                <thead>
                  <tr className="border-b border-primary ">
                    <th className='text-start px-2 py-2'>{t("notifications.docName")}</th>
                    <th className='text-start px-2 py-2'>{t("notifications.association")}</th>
                    <th className='text-start px-2 py-2'>{t("notifications.expiryDate")}</th>
                    <th className='text-start px-2 py-2'>{t("notifications.status")}</th>
                    <th className='text-start px-2 py-2'>{t("notifications.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-700/50">
                  {notifications.map((row, i) => {
                    const docTypeKey = `notifications.docType.${row.doc_name}`;
                    const docNameTranslated = t(docTypeKey as "notifications.docType.Passport") !== docTypeKey ? t(docTypeKey as "notifications.docType.Passport") : row.doc_name;
                    const assocKey = `notifications.associationType.${row.association}`;
                    const associationTranslated = t(assocKey as "notifications.associationType.Employee") !== assocKey ? t(assocKey as "notifications.associationType.Employee") : row.association;
                    const statusStyles =
                      row.status_bucket === "expired"
                        ? "bg-slate-200/80 text-slate-700 dark:bg-zinc-600/60 dark:text-zinc-300"
                        : row.status_bucket === "critical_5"
                          ? "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
                    const rowBg =
                      row.status_bucket === "expired"
                        ? "bg-slate-50/80 dark:bg-zinc-800/40"
                        : row.status_bucket === "critical_5"
                          ? "bg-red-50/50 dark:bg-red-950/20"
                          : i % 2 === 0
                            ? "bg-white dark:bg-zinc-900/50"
                            : "bg-amber-50/30 dark:bg-amber-950/10";
                    return (
                      <tr key={row.id} className={rowBg}>
                        <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-200">
                          <div className="flex flex-col gap-0.5">
                            <span>{docNameTranslated}</span>
                            {"entity_display_name" in row && row.entity_display_name && (
                              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                                {row.entity_display_name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                          {associationTranslated}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-slate-700 dark:text-slate-300">
                          {row.expiry_date}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 tabular-nums text-xs font-semibold ${statusStyles}`}
                          >
                            {`${row.days_remaining} ${t("notifications.daysRemaining")}`}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <Link
                            href={
                              row.entity_type === "EMPLOYMENT_RECORD" || row.entity_type === "EMPLOYMENT_DOCUMENT"
                                ? `/${locale}/employment/${row.entity_id}`
                                : row.entity_type === "VEHICLE_DOCUMENT"
                                  ? `/${locale}/fleet?view=${row.entity_id}`
                                  : `/${locale}/documents${links.documents ?? "?tab=near_expiry"}`
                            }
                            className="inline-flex items-center gap-1.5 rounded-lg bg-teal-100 px-2.5 py-1 text-xs font-semibold text-teal-800 transition-colors hover:bg-teal-200 dark:bg-teal-900/50 dark:text-teal-200 dark:hover:bg-teal-800/50"
                          >
                            {t("notifications.view")}
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 py-16 dark:border-zinc-700">
              <p className="text-center text-sm text-slate-500 dark:text-slate-400">
                {t("empty.noExpiringDocs")}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
