"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  LocalizationProvider,
  DatePicker,
} from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { type Dayjs } from "dayjs";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Trash2, Eye, CheckCircle, Pencil } from "lucide-react";
import { EmployeeSearchBox } from "./EmployeeSearchBox";
import { DailyOperationViewModal } from "./DailyOperationViewModal";
import { Modal } from "./Modal";
import { PlatformIcon } from "./PlatformIcon";
import { StatusBadge } from "./StatusBadge";

type MonthlyChartsData = {
  pie: { totalTarget: number; totalAchieved: number };
  byEmployee: Array<{
    employment_record_id: string;
    full_name_ar: string;
    full_name_en: string | null;
    orders_count: number;
    monthly_orders_target: number | null;
  }>;
};

type OperatingPlatform = "NONE" | "JAHEZ" | "HUNGERSTATION" | "NINJA" | "KEETA";

type DailyOperationListItem = {
  id: string;
  date: string;
  platform: OperatingPlatform;
  orders_count: number;
  total_revenue: string | number;
  cash_collected: string | number;
  cash_received?: string | number;
  difference_amount?: string | number;
  tips: string | number;
  deduction_amount: string | number;
  deduction_reason: string | null;
  is_draft?: boolean;
  approved_at?: string | null;
  approved_by_user_id?: string | null;
  status_code: string;
  employment_record: {
    id: string;
    employee_no: string | null;
    avatar_file_id?: string | null;
    platform_user_no?: string | null;
    recruitment_candidate: { full_name_ar: string; full_name_en: string | null } | null;
  } | null;
};

type StatsData = {
  totalOrders: number;
  activeEmployees: number;
  totalSales: number;
  totalDeductions: number;
};

type DailyOpsPageProps = {
  locale: string;
  data: { items: DailyOperationListItem[]; total: number; page: number; page_size: number };
  stats: StatsData;
  chartsData: MonthlyChartsData | null;
  searchParams: { q?: string; date?: string };
  page: number;
};

const formatAmount = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CHART_COLORS = [
  "#6366f1", // indigo
  "#22c55e", // emerald
  "#f59e0b", // amber
  "#ec4899", // pink
  "#14b8a6", // teal
  "#8b5cf6", // violet
  "#ef4444", // red
  "#3b82f6", // blue
];

/** Split name into two lines for Y-axis (break near middle, preferably at space). */
function splitNameTwoLines(name: string, maxPerLine = 12): [string, string] {
  if (!name || name.length <= maxPerLine) return [name, ""];
  const mid = Math.min(maxPerLine, Math.ceil(name.length / 2));
  const before = name.slice(0, mid);
  const after = name.slice(mid);
  const spaceInBefore = before.lastIndexOf(" ");
  const spaceInAfter = after.indexOf(" ");
  if (spaceInBefore > 0 && mid - spaceInBefore <= 4) {
    return [before.slice(0, spaceInBefore).trim(), name.slice(spaceInBefore + 1)];
  }
  if (spaceInAfter > 0 && spaceInAfter <= 4) {
    return [name.slice(0, mid + spaceInAfter).trim(), name.slice(mid + spaceInAfter + 1).trim()];
  }
  return [before.trim(), after.trim()];
}

const statusTone = (status: string) => {
  if (status === "FLAGGED_DEDUCTION") return "bg-amber-100 text-amber-800 border-amber-300";
  if (status === "DRAFT") return "bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-600";
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (status === "REVIEWED") return "bg-emerald-100 text-emerald-800 border-emerald-300";
  return "bg-primary/10 text-primary border-primary/30";
};

type EmployeeOption = {
  id: string;
  employee_no: string | null;
  employee_code?: string | null;
  full_name_ar?: string | null;
  full_name_en?: string | null;
  assigned_platform?: string | null;
  platform_user_no?: string | null;
  status_code?: string | null;
  avatar_file_id?: string | null;
  recruitment_candidate: { full_name_ar: string; full_name_en: string | null } | null;
};

export function DailyOperationsPageClient({
  locale,
  data,
  stats,
  chartsData,
  searchParams,
  page,
}: DailyOpsPageProps) {
  const t = useTranslations();
  const [showSingle, setShowSingle] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [viewItem, setViewItem] = useState<DailyOperationListItem | null>(null);
  const [barMode, setBarMode] = useState<"top5" | "worst5">("top5");
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const pieData = useMemo(() => {
    if (!chartsData) return null;
    const { totalTarget, totalAchieved } = chartsData.pie;
    if (totalTarget <= 0 && totalAchieved <= 0) return null;
    const remaining = Math.max(0, totalTarget - totalAchieved);
    const segments: { name: string; value: number; key: string }[] = [];
    if (totalAchieved > 0) segments.push({ name: t("dailyOps.charts.achieved"), value: totalAchieved, key: "achieved" });
    if (remaining > 0) segments.push({ name: t("dailyOps.charts.remaining"), value: remaining, key: "remaining" });
    if (segments.length === 0) return null;
    return segments;
  }, [chartsData, t]);

  const barData = useMemo(() => {
    if (!chartsData?.byEmployee.length) return [];
    const sorted =
      barMode === "top5"
        ? [...chartsData.byEmployee].sort((a, b) => b.orders_count - a.orders_count).slice(0, 5)
        : [...chartsData.byEmployee].sort((a, b) => a.orders_count - b.orders_count).slice(0, 5);
    return sorted.map((e) => ({
      name: locale === "ar" ? e.full_name_ar : (e.full_name_en || e.full_name_ar),
      orders: e.orders_count,
    }));
  }, [chartsData, barMode, locale]);

  const handleStatusChange = async (id: string, status_code: string) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/daily-operations/records/${id}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status_code }),
      });
      if (!res.ok) {
        setUpdatingId(null);
        return;
      }
      window.location.reload();
    } catch {
      setUpdatingId(null);
    }
  };

  const handleDeleteDraft = async (id: string) => {
    if (!window.confirm(t("dailyOps.confirmDeleteDraft"))) return;
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/daily-operations/records/${id}`, { method: "DELETE" });
      if (!res.ok) {
        setUpdatingId(null);
        return;
      }
      window.location.reload();
    } catch {
      setUpdatingId(null);
    }
  };

  const displayName = (item: DailyOperationListItem) => {
    if (item.employment_record?.recruitment_candidate) {
      const { full_name_ar, full_name_en } = item.employment_record.recruitment_candidate;
      return `${full_name_ar} ${full_name_en ? `(${full_name_en})` : ""}`;
    }
    return item.employment_record?.employee_no ?? "-";
  };

  return (
    <>
      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("dailyOps.totalOrders")} value={stats.totalOrders.toLocaleString()} />
        <StatCard label={t("dailyOps.activeEmployees")} value={stats.activeEmployees.toLocaleString()} />
        <StatCard label={t("dailyOps.totalSales")} value={stats.totalSales.toLocaleString()} />
        <StatCard label={t("dailyOps.totalDeductions")} value={stats.totalDeductions.toLocaleString()} />
      </div>

      {/* Charts: Pie narrower, Bar wider; colorful, animated; RTL-safe labels */}
      {chartsData && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="rounded-xl border border-zinc-200 bg-white p-1 m-0 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 lg:col-span-2">
            <h3 className="mb-2 text-sm font-semibold text-primary/80">{t("dailyOps.charts.monthlyTargetAchieved")}</h3>
            {pieData && pieData.length > 0 ? (
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={300} bg-red-500>
                  <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="45%"
                      innerRadius={64}
                      outerRadius={100}
                      paddingAngle={1}
                      isAnimationActive
                      animationBegin={0}
                      animationDuration={800}
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={entry.key} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="rgba(255,255,255,0.4)" strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number | undefined) => [value ?? 0, t("dailyOps.charts.orders")]}
                      contentStyle={{ borderRadius: 8 }}
                    />
                    <Legend layout="horizontal" verticalAlign="top" align="center" style={{ padding: 0, margin: 0 }} />
                  </PieChart>
                </ResponsiveContainer>
                <p className="m-0 p-0 text-center text-sm font-semibold text-primary">
                  {chartsData.pie.totalAchieved} / {chartsData.pie.totalTarget} {t("dailyOps.charts.orders")}
                </p>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-primary/60">{t("dailyOps.charts.noTargetData")}</p>
            )}
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-1 m-0 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 lg:col-span-3 ">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-primary/80">{t("dailyOps.charts.employeeOrders")}</h3>
              <div className="flex rounded-md border border-zinc-200 dark:border-zinc-700">
                <button
                  type="button"
                  onClick={() => setBarMode("top5")}
                  className={`rounded-s-md px-2 py-1 text-xs ${barMode === "top5" ? "bg-primary text-white" : "bg-zinc-100 text-primary dark:bg-zinc-800"}`}
                >
                  {t("dailyOps.charts.top5")}
                </button>
                <button
                  type="button"
                  onClick={() => setBarMode("worst5")}
                  className={`rounded-e-md px-2 py-1 text-xs ${barMode === "worst5" ? "bg-primary text-white" : "bg-zinc-100 text-primary dark:bg-zinc-800"}`}
                >
                  {t("dailyOps.charts.worst5")}
                </button>
              </div>
            </div>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  layout="vertical"
                  data={barData}
                  width="100%"
                  margin={{ top: 8, right: 0, bottom: 0, left: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.15)" vertical={true} />
                  <XAxis type="number" dataKey="orders" tick={{ fontSize: 12, fontWeight: 700 }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={locale === "ar" ? 70 : 80}
                    tickMargin={12}
                    interval={0}
                    tick={(props) => {
                      const { x, y, payload } = props;
                      const [line1, line2] = splitNameTwoLines(String(payload?.value ?? ""));
                      return (
                        <g transform={`translate(${locale === "ar" ? (x as number) - 35 : (x as number) - 65},${y})`}>

                          <text textAnchor={locale === "ar" ? "end" : "start"} x={locale === "ar" ? -8 : 8} y={0} dy={line2 ? -4 : 0} style={{ fontSize: 11, fontWeight: 700 }}>
                            <tspan x={locale === "ar" ? -8 : 8} dy={0}>
                              {line1}
                            </tspan>
                            {line2 ? (
                              <tspan x={locale === "ar" ? -8 : 8} dy={14}>
                                {line2}
                              </tspan>
                            ) : null}
                          </text>
                        </g>
                      );
                    }}
                  />
                  <Tooltip
                    formatter={(value: number | undefined) => [value ?? 0, t("dailyOps.charts.orders")]}
                    contentStyle={{ borderRadius: 8 }}
                  />
                  <Bar
                    dataKey="orders"
                    radius={[0, 6, 6, 0]}
                    name={t("dailyOps.charts.orders")}
                    isAnimationActive
                    animationDuration={600}
                    animationBegin={0}
                  >
                    {barData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-primary/60">{t("dailyOps.charts.noEmployeeData")}</p>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <form
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        action={`/${locale}/daily-operations`}
        method="get"
      >
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder={t("dailyOps.searchPlaceholder")}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-800"
          />
          <input
            type="date"
            name="date"
            max={today}
            defaultValue={searchParams.date ?? ""}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800 sm:w-48"
            aria-label={t("dailyOps.dateLabel")}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            {t("common.filter")}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow hover:bg-primary/90"
            >
              +
              <span>{t("dailyOps.addOperation")}</span>
            </button>
            {menuOpen && (
              <div className="absolute end-0 z-10 mt-2 w-72 rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowSingle(true);
                  }}
                  className="block w-full px-4 py-3 text-start text-sm hover:bg-primary/5"
                >
                  {t("dailyOps.singleInput")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setShowBulk(true);
                  }}
                  className="block w-full px-4 py-3 text-start text-sm hover:bg-primary/5"
                >
                  {t("dailyOps.bulkInput")}
                </button>
              </div>
            )}
          </div>
        </div>
      </form>

      {/* Table */}
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-primary">
            <thead className="border-b border-zinc-200 dark:border-zinc-700">
              <tr className={`${locale === "ar" ? "text-right" : "text-left"}`}>
                <th className="px-3 py-2">{t("common.employeeInfo")}</th>
                <th className="px-3 py-2">{t("dailyOps.tablePlatform")}</th>
                <th className="px-3 py-2">{t("dailyOps.tableOrders")}</th>
                <th className="px-3 py-2">{t("dailyOps.tableRevenue")}</th>
                <th className="px-3 py-2">{t("dailyOps.tableCash")}</th>
                <th className="px-3 py-2">{t("dailyOps.tableTips")}</th>
                <th className="px-3 py-2">{t("dailyOps.tableDeductions")}</th>
                <th className="px-3 py-2">{t("dailyOps.tableStatus")}</th>
                <th className="px-3 py-2 text-right">{t("dailyOps.tableActions")}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => {
                const name = displayName(item);
                const initial = name && name !== "-" ? name.charAt(0).toUpperCase() : "?";
                const nameAr = item.employment_record?.recruitment_candidate?.full_name_ar ?? "";
                const nameEn = item.employment_record?.recruitment_candidate?.full_name_en ?? null;
                const fallbackLabel = item.employment_record?.employee_no ?? "-";
                return (
                  <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-700">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-3">
                        {item.employment_record?.avatar_file_id ? (
                          <img
                            src={`/api/files/${item.employment_record.avatar_file_id}/view`}
                            alt={name}
                            className="h-10 w-10 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {initial}
                          </div>
                        )}
                        <div className="flex min-w-0 flex-col font-medium">
                          {nameAr || nameEn ? (
                            <>
                              {nameAr ? <span>{nameAr}</span> : null}
                              {nameEn ? (
                                <span className="text-primary/80">{nameEn}</span>
                              ) : null}
                            </>
                          ) : (
                            <span>{fallbackLabel}</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        <PlatformIcon platform={item.platform} />
                        {item.employment_record?.platform_user_no ? (
                          <span className="text-xs text-primary/60">
                            {t("common.platformUserNo")}: {item.employment_record.platform_user_no}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">{item.orders_count}</td>
                    <td className="px-3 py-2">{formatAmount(item.total_revenue)}</td>
                    <td className="px-3 py-2">{formatAmount(item.cash_collected)}</td>
                    <td className="px-3 py-2">{formatAmount(item.tips)}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span>{formatAmount(item.deduction_amount)}</span>
                        {item.deduction_amount && Number(item.deduction_amount) > 0 && item.deduction_reason ? (
                          <span className="text-xs text-primary/60">{item.deduction_reason}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${statusTone(item.status_code)}`}>
                        {item.status_code === "FLAGGED_DEDUCTION"
                          ? t("dailyOps.statusFlagged")
                          : item.status_code === "APPROVED"
                            ? t("dailyOps.statusApproved")
                            : item.status_code === "DRAFT"
                              ? t("dailyOps.statusDraft")
                              : item.status_code === "REVIEWED"
                                ? t("dailyOps.statusReviewed")
                                : t("dailyOps.statusRecorded")}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        {item.status_code === "APPROVED" ? (
                          <button
                            type="button"
                            onClick={() => handleStatusChange(item.id, "REVIEWED")}
                            disabled={updatingId === item.id}
                            title={t("dailyOps.markReviewed")}
                            aria-label={t("dailyOps.markReviewed")}
                            className="rounded-md border border-zinc-200 p-1.5 text-primary hover:bg-primary/5 disabled:opacity-50 dark:border-zinc-700"
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        ) : null}
                        {item.status_code === "DRAFT" ? (
                          <button
                            type="button"
                            onClick={() => handleDeleteDraft(item.id)}
                            disabled={updatingId === item.id}
                            title={t("dailyOps.deleteDraft")}
                            aria-label={t("dailyOps.deleteDraft")}
                            className="rounded-md border border-zinc-200 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                        {(item.status_code === "DRAFT" || item.status_code === "APPROVED") ? (
                          <button
                            type="button"
                            onClick={() => setViewItem(item)}
                            title={t("common.edit")}
                            aria-label={t("common.edit")}
                            className="rounded-md border border-zinc-200 p-1.5 text-primary hover:bg-primary/5 dark:border-zinc-700"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setViewItem(item)}
                          title={t("common.view")}
                          aria-label={t("common.view")}
                          className="rounded-md border border-zinc-200 p-1.5 text-primary hover:bg-primary/5 dark:border-zinc-700"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data.items.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-primary/60" colSpan={9}>
                    {t("dailyOps.noResults")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-primary/80">
        <div>
          {t("common.total")}: {data.total} ({t("common.page")} {data.page})
        </div>
        <div className="flex gap-2">
          <Link
            className={`rounded-md border border-zinc-200 px-3 py-1 text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
            href={`/${locale}/daily-operations?q=${encodeURIComponent(searchParams.q ?? "")}&date=${encodeURIComponent(searchParams.date ?? "")}&page=${page - 1}`}
          >
            {t("common.prev")}
          </Link>
          <Link
            className={`rounded-md border border-zinc-200 px-3 py-1 text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 ${page * data.page_size >= data.total ? "pointer-events-none opacity-50" : ""}`}
            href={`/${locale}/daily-operations?q=${encodeURIComponent(searchParams.q ?? "")}&date=${encodeURIComponent(searchParams.date ?? "")}&page=${page + 1}`}
          >
            {t("common.next")}
          </Link>
        </div>
      </div>

      <DailyOperationViewModal
        isOpen={!!viewItem}
        onClose={() => setViewItem(null)}
        record={viewItem}
      />
      <DailyOperationSingleModal isOpen={showSingle} onClose={() => setShowSingle(false)} today={today} />
      <DailyOperationBulkModal isOpen={showBulk} onClose={() => setShowBulk(false)} today={today} locale={locale} />
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="text-sm text-primary/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-primary">{value}</div>
    </div>
  );
}

function DailyOperationSingleModal({
  isOpen,
  onClose,
  today,
}: {
  isOpen: boolean;
  onClose: () => void;
  today: string;
}) {
  const t = useTranslations();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [step, setStep] = useState<1 | 2>(1);
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employee, setEmployee] = useState<EmployeeOption | null>(null);
  const [date, setDate] = useState<string>(today);
  const [ordersCount, setOrdersCount] = useState<string>("");
  const [totalRevenue, setTotalRevenue] = useState<string>("");
  const [cashCollected, setCashCollected] = useState<string>("");
  const [cashReceived, setCashReceived] = useState<string>("0");
  const [deductionAmount, setDeductionAmount] = useState<string>("0");
  const [deductionReason, setDeductionReason] = useState<string>("");
  const [tipsAmount, setTipsAmount] = useState<string>("0");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkingEntry, setCheckingEntry] = useState(false);

  const difference = Number(cashReceived || 0) - Number(cashCollected || 0);
  const isNegativeDifference = difference < 0;

  const reset = () => {
    setStep(1);
    setDate(today);
    setEmployeeId(null);
    setEmployee(null);
    setOrdersCount("");
    setTotalRevenue("");
    setCashCollected("");
    setCashReceived("0");
    setDeductionAmount("0");
    setDeductionReason("");
    setTipsAmount("0");
    setError(null);
    setSaving(false);
    setCheckingEntry(false);
  };

  const validateForApproval = () => {
    if (!employeeId) return t("dailyOps.selectEmployee");
    if (!ordersCount || Number(ordersCount) <= 0) return t("dailyOps.ordersCountRequired");
    if (!totalRevenue || Number(totalRevenue) <= 0) return t("dailyOps.totalRevenueRequired");
    if (!cashCollected || Number(cashCollected) <= 0) return t("dailyOps.cashCollectedRequired");
    if (Number(deductionAmount || 0) > 0 && !deductionReason) return t("dailyOps.deductionReasonRequired");
    return null;
  };

  const submit = async (action: "draft" | "approve") => {
    const validationError = action === "approve" ? validateForApproval() : null;
    if (validationError) {
      setError(validationError);
      return;
    }
    if (!employeeId) return;

    setSaving(true);
    setError(null);
    try {
      const payload = {
        employment_record_id: employeeId,
        date: new Date(`${date}T00:00:00.000Z`).toISOString(),
        orders_count: Number(ordersCount || 0),
        total_revenue: Number(totalRevenue || 0),
        cash_collected: Number(cashCollected || 0),
        cash_received: Number(cashReceived || 0),
        tips: Number(tipsAmount || 0),
        deduction_amount: Number(deductionAmount || 0),
        deduction_reason: Number(deductionAmount || 0) > 0 ? deductionReason || undefined : undefined,
        submit_action: action,
      };
      const res = await fetch("/api/daily-operations/records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.message;
        setError(
          typeof msg === "string" && msg.includes("OPS_DAILY_012")
            ? t("dailyOps.employeeAlreadyHasEntryForDate")
            : (msg ?? "Save failed"),
        );
        setSaving(false);
        return;
      }
      reset();
      onClose();
      window.location.reload();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Save failed";
      setError(message);
      setSaving(false);
    }
  };

  const showDeductionReason = Number(deductionAmount || 0) > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        reset();
        onClose();
      }}
      title={t("dailyOps.singleInput")}
    >
      <LocalizationProvider dateAdapter={AdapterDayjs}>
      <div className="space-y-4">
        <div className="text-sm font-semibold text-primary">
          {step === 1 ? t("dailyOps.stepOne") : t("dailyOps.stepTwo")}
        </div>

        {step === 1 ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm text-primary">{t("dailyOps.dateLabel")}</label>
                <div className="mt-1">
                  <DatePicker
                    value={date ? dayjs(date) : null}
                    onChange={(d: Dayjs | null) => setDate(d ? d.format("YYYY-MM-DD") : today)}
                    maxDate={dayjs(today)}
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
                <p className="mt-1 text-xs text-primary/60">{t("dailyOps.dateMaxToday")}</p>
              </div>
              <div>
                <label className="text-sm text-primary">{t("dailyOps.selectEmployee")}</label>
                <EmployeeSearchBox
                  value={employeeId}
                  onChange={(id) => {
                    setEmployeeId(id);
                    if (!id) setEmployee(null);
                  }}
                  onSelectOption={(opt) => {
                    setEmployee(opt);
                    setEmployeeId(opt.id);
                  }}
                  searchPath="/api/daily-operations/employees/search"
                  placeholder={t("dailyOps.searchByNameOrCode")}
                />
              </div>
            </div>
            {employee ? <EmployeeCard employee={employee} /> : null}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label={t("dailyOps.ordersCount")}
              value={ordersCount}
              onChange={setOrdersCount}
              type="number"
              min={0.01}
              step="1"
            />
            <Field
              label={t("dailyOps.totalRevenue")}
              value={totalRevenue}
              onChange={setTotalRevenue}
              type="number"
              min={0.01}
              step="0.01"
            />
            <Field
              label={t("dailyOps.cashCollected")}
              value={cashCollected}
              onChange={setCashCollected}
              type="number"
              min={0.01}
              step="0.01"
            />
            <Field
              label={t("dailyOps.cashReceived")}
              value={cashReceived}
              onChange={setCashReceived}
              type="number"
              min={0}
              step="0.01"
            />
            <Field
              label={t("dailyOps.deductions")}
              value={deductionAmount}
              onChange={setDeductionAmount}
              type="number"
              min={0}
              step="0.01"
            />
            {showDeductionReason ? (
              <div className="sm:col-span-2">
                <label className="text-sm text-primary">{t("dailyOps.deductionReason")}</label>
                <input
                  value={deductionReason}
                  onChange={(e) => setDeductionReason(e.target.value)}
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            ) : null}
            <Field
              label={t("dailyOps.tips")}
              value={tipsAmount}
              onChange={setTipsAmount}
              type="number"
              min={0}
              step="0.01"
            />
            <div className="sm:col-span-2">
              <label className="text-sm text-primary">{t("dailyOps.difference")}</label>
              <div className="mt-1 rounded-md border border-zinc-200 bg-white px-3 py-3 dark:border-zinc-700 dark:bg-zinc-900">
                <div className={`text-lg font-semibold ${isNegativeDifference ? "text-red-600" : "text-emerald-600"}`}>
                  {formatAmount(difference)}
                </div>
                <div className="text-xs text-primary/60">{t("dailyOps.differenceHint")}</div>
                {isNegativeDifference ? (
                  <div className="text-xs text-red-600">{t("dailyOps.differenceWarning")}</div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {error}
          </div>
        )}

        <div className="flex justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              if (step === 1) {
                reset();
                onClose();
              } else {
                setStep(1);
              }
            }}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            {step === 1 ? t("common.cancel") : t("common.back")}
          </button>
          {step === 1 ? (
            <button
              type="button"
              disabled={!employeeId || checkingEntry}
              onClick={async () => {
                if (!employeeId) return;
                setError(null);
                setCheckingEntry(true);
                try {
                  const checkRes = await fetch(
                    `/api/daily-operations/records/check?employment_record_id=${encodeURIComponent(employeeId)}&date=${encodeURIComponent(date)}`,
                  );
                  const checkData = await checkRes.json().catch(() => null);
                  if (checkData?.hasEntry) {
                    setError(t("dailyOps.employeeAlreadyHasEntryForDate"));
                    return;
                  }
                  setStep(2);
                } finally {
                  setCheckingEntry(false);
                }
              }}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {checkingEntry ? t("common.loading") : (t("common.next") || "Next")}
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => submit("draft")}
                disabled={saving}
                className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                {saving ? t("common.saving") : t("dailyOps.saveDraft")}
              </button>
              <button
                type="button"
                onClick={() => submit("approve")}
                disabled={saving}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? t("common.saving") : t("dailyOps.saveAndApprove")}
              </button>
            </div>
          )}
        </div>
      </div>
      </LocalizationProvider>
    </Modal>
  );
}

const thAlign = (locale: string, isActions = false) =>
  isActions
    ? locale === "ar"
      ? "text-left"
      : "text-right"
    : locale === "ar"
      ? "text-right"
      : "text-left";

function DailyOperationBulkModal({
  isOpen,
  onClose,
  today,
  locale,
}: {
  isOpen: boolean;
  onClose: () => void;
  today: string;
  locale: string;
}) {
  const t = useTranslations();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [date, setDate] = useState<string>(today);
  const [rows, setRows] = useState<
    Array<{
      employment_record_id: string | null;
      selected?: EmployeeOption | null;
      orders_count: string;
      total_revenue: string;
      cash_collected: string;
      cash_received: string;
      deduction_amount: string;
      deduction_reason: string;
      tips: string;
    }>
  >([
    {
      employment_record_id: null,
      selected: null,
      orders_count: "",
      total_revenue: "",
      cash_collected: "",
      cash_received: "0",
      deduction_amount: "0",
      deduction_reason: "",
      tips: "0",
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const orderRefs = useRef<HTMLInputElement[]>([]);
  const [supervisorName, setSupervisorName] = useState("");

  const addRow = () =>
    setRows((r) => [
      ...r,
      {
        employment_record_id: null,
        selected: null,
        orders_count: "",
        total_revenue: "",
        cash_collected: "",
        cash_received: "0",
        deduction_amount: "0",
        deduction_reason: "",
        tips: "0",
      },
    ]);

  const updateRow = (idx: number, patch: Partial<(typeof rows)[number]>) => {
    setRows((r) => r.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  };

  const removeRow = (idx: number) => setRows((r) => r.filter((_, i) => i !== idx));

  const parsedRows = rows.map((row) => ({
    ...row,
    orders_count_num: Number(row.orders_count || 0),
    total_revenue_num: Number(row.total_revenue || 0),
    cash_collected_num: Number(row.cash_collected || 0),
    cash_received_num: Number(row.cash_received || 0),
    deduction_amount_num: Number(row.deduction_amount || 0),
    tips_num: Number(row.tips || 0),
  }));

  const validRowsForSummary = parsedRows.filter(
    (row) =>
      row.employment_record_id &&
      row.orders_count_num > 0 &&
      row.total_revenue_num > 0 &&
      row.cash_collected_num > 0 &&
      row.cash_received_num >= 0,
  );

  const summary = validRowsForSummary.reduce(
    (acc, row) => {
      acc.orders += row.orders_count_num;
      acc.revenue += row.total_revenue_num;
      acc.cashCollected += row.cash_collected_num;
      acc.cashReceived += row.cash_received_num;
      acc.deductions += row.deduction_amount_num;
      acc.tips += row.tips_num;
      return acc;
    },
    { orders: 0, revenue: 0, cashCollected: 0, cashReceived: 0, deductions: 0, tips: 0 },
  );

  const handleSelectEmployee = (idx: number, option: EmployeeOption) => {
    const isDuplicate = rows.some((row, rowIdx) => rowIdx !== idx && row.employment_record_id === option.id);
    if (isDuplicate) {
      setError(t("dailyOps.duplicateEmployee"));
      return;
    }
    setError(null);
    updateRow(idx, { employment_record_id: option.id, selected: option });
  };

  const focusNextRow = (idx: number) => {
    if (orderRefs.current[idx + 1]) {
      orderRefs.current[idx + 1]?.focus();
    } else {
      addRow();
      setTimeout(() => orderRefs.current[idx + 1]?.focus(), 80);
    }
  };

  const onKeyDownRow = (idx: number) => (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      focusNextRow(idx);
    }
  };

  const allowPositiveInteger = (raw: string): string => {
    const v = raw.replace(/[^\d]/g, "");
    if (v === "") return "";
    const n = parseInt(v, 10);
    return n > 0 ? String(n) : "";
  };

  const allowNonNegativeDecimal = (raw: string, allowZero: boolean): string => {
    if (raw === "" || raw === "-") return allowZero ? "0" : "";
    const normalized = raw.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
    if (normalized === "" || normalized === ".") return allowZero ? "0" : "";
    const n = parseFloat(normalized);
    if (Number.isNaN(n)) return allowZero ? "0" : "";
    if (n < 0) return allowZero ? "0" : "";
    if (!allowZero && n === 0) return "";
    return normalized;
  };

  const allowPositiveDecimal = (raw: string): string => allowNonNegativeDecimal(raw, false);

  const normalizePayloadRows = (action: "draft" | "approve") => {
    const filtered = parsedRows.filter((row) => row.employment_record_id);
    if (action === "approve") {
      for (const row of filtered) {
        if (!row.orders_count_num || !row.total_revenue_num || !row.cash_collected_num) {
          throw new Error(t("dailyOps.bulkRequiredFields"));
        }
        if (row.deduction_amount_num > 0 && !row.deduction_reason) {
          throw new Error(t("dailyOps.deductionReasonRequired"));
        }
      }
    }
    return filtered.map((row) => ({
      employment_record_id: row.employment_record_id!,
      orders_count: row.orders_count_num,
      total_revenue: row.total_revenue_num,
      cash_collected: row.cash_collected_num,
      cash_received: row.cash_received_num,
      deduction_amount: row.deduction_amount_num,
      deduction_reason: row.deduction_amount_num > 0 ? row.deduction_reason || undefined : undefined,
      tips: row.tips_num,
    }));
  };

  const submit = async (action: "draft" | "approve") => {
    setSaving(true);
    setError(null);
    try {
      const payloadRows = normalizePayloadRows(action);
      if (payloadRows.length === 0) {
        throw new Error(t("dailyOps.selectEmployee"));
      }

      const res = await fetch("/api/daily-operations/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: new Date(`${date}T00:00:00.000Z`).toISOString(),
          submit_action: action,
          rows: payloadRows,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.message;
        throw new Error(
          typeof msg === "string" && msg.includes("OPS_DAILY_012")
            ? t("dailyOps.employeeAlreadyHasEntryForDate")
            : (msg ?? "Save failed"),
        );
      }
      onClose();
      window.location.reload();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Save failed";
      setError(message);
      setSaving(false);
    }
  };

  const dirty =
    date !== today ||
    supervisorName.length > 0 ||
    rows.length > 1 ||
    rows.some(
      (row) =>
        row.employment_record_id ||
        row.orders_count ||
        row.total_revenue ||
        row.cash_collected ||
        row.cash_received ||
        row.deduction_amount ||
        row.deduction_reason ||
        row.tips,
    );

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        if (!dirty || confirm(t("common.unsavedPrompt"))) {
          onClose();
        }
      }}
      title={t("dailyOps.bulkTitle")}
      maxWidth="8xl"
    >
      <LocalizationProvider dateAdapter={AdapterDayjs}>
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm text-primary">{t("dailyOps.dateLabel")}</label>
            <div className="mt-1">
              <DatePicker
                value={date ? dayjs(date) : null}
                onChange={(d: Dayjs | null) => setDate(d ? d.format("YYYY-MM-DD") : today)}
                maxDate={dayjs(today)}
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
            <p className="mt-1 text-xs text-primary/60">{t("dailyOps.dateMaxToday")}</p>
          </div>
          <div>
            <label className="text-sm text-primary">{t("dailyOps.supervisorName")}</label>
            <input
              type="text"
              value={supervisorName}
              onChange={(e) => setSupervisorName(e.target.value)}
              placeholder={t("dailyOps.supervisorNamePlaceholder")}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </div>

        <div className="overflow-auto rounded-md border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full text-sm text-primary">
            <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-primary/70 dark:bg-zinc-800/60 dark:text-primary/60">
              <tr>
                <th className={`px-3 py-2 ${thAlign(locale)}`}>{t("dailyOps.employeeNameCode")}</th>
                <th className={`px-3 py-2 ${thAlign(locale)}`}>{t("dailyOps.platform")}</th>
                <th className={`px-3 py-2 ${thAlign(locale)}`}>{t("dailyOps.ordersCount")}</th>
                <th className={`px-3 py-2 ${thAlign(locale)}`}>{t("dailyOps.totalRevenue")}</th>
                <th className={`px-3 py-2 ${thAlign(locale)}`}>{t("dailyOps.cashCollected")}</th>
                <th className={`px-3 py-2 ${thAlign(locale)}`}>{t("dailyOps.cashReceived")}</th>
                <th className={`px-3 py-2 ${thAlign(locale)}`}>{t("dailyOps.deductions")}</th>
                <th className={`px-3 py-2 ${thAlign(locale)}`}>{t("dailyOps.tips")}</th>
                <th className={`px-3 py-2 ${thAlign(locale, true)}`}>{t("dailyOps.tableActions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const showDeductionReason = Number(row.deduction_amount || 0) > 0;
                const nameAr = row.selected?.recruitment_candidate?.full_name_ar ?? row.selected?.full_name_ar ?? "";
                const nameEn = row.selected?.recruitment_candidate?.full_name_en ?? row.selected?.full_name_en ?? "";
                const code = row.selected?.employee_no ?? row.selected?.employee_code ?? "";
                const nameCodeDisplay = row.selected ? `${nameAr}${nameEn ? ` | ${nameEn}` : ""} | ${code}` : null;
                return (
                  <tr key={idx} className="border-t border-zinc-200 align-top dark:border-zinc-700">
                    <td className="px-3 py-2 min-w-[220px]">
                      {row.selected ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium text-primary">{nameCodeDisplay}</span>
                          <button
                            type="button"
                            onClick={() => updateRow(idx, { employment_record_id: null, selected: null })}
                            className="w-fit text-xs text-primary/70 hover:underline"
                          >
                            {t("dailyOps.changeEmployee")}
                          </button>
                        </div>
                      ) : (
                        <EmployeeSearchBox
                          value={row.employment_record_id}
                          onChange={(id) => updateRow(idx, { employment_record_id: id })}
                          onSelectOption={(opt) => handleSelectEmployee(idx, opt)}
                          searchPath="/api/daily-operations/employees/search"
                          placeholder={t("dailyOps.searchByNameOrCode")}
                        />
                      )}
                    </td>
                    <td className="px-3 py-2 min-w-[140px]">
                      {row.selected ? (
                        <div className="flex flex-col gap-1">
                          <PlatformIcon platform={(row.selected.assigned_platform as string) ?? "NONE"} />
                          {row.selected.platform_user_no ? (
                            <span className="text-xs text-primary/60">{t("common.platformUserNo")}: {row.selected.platform_user_no}</span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-xs text-primary/60">{t("dailyOps.platformNone")}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <input
                        ref={(el) => {
                          if (el) orderRefs.current[idx] = el;
                        }}
                        type="text"
                        inputMode="numeric"
                        value={row.orders_count}
                        onChange={(e) => updateRow(idx, { orders_count: allowPositiveInteger(e.target.value) })}
                        onKeyDown={onKeyDownRow(idx)}
                        className="w-24 rounded-md border border-zinc-200 bg-white px-2 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.total_revenue}
                        onChange={(e) => updateRow(idx, { total_revenue: allowPositiveDecimal(e.target.value) })}
                        onKeyDown={onKeyDownRow(idx)}
                        className="w-28 rounded-md border border-zinc-200 bg-white px-2 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.cash_collected}
                        onChange={(e) => updateRow(idx, { cash_collected: allowPositiveDecimal(e.target.value) })}
                        onKeyDown={onKeyDownRow(idx)}
                        className="w-28 rounded-md border border-zinc-200 bg-white px-2 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.cash_received}
                        onChange={(e) => updateRow(idx, { cash_received: allowNonNegativeDecimal(e.target.value, true) })}
                        onKeyDown={onKeyDownRow(idx)}
                        className="w-28 rounded-md border border-zinc-200 bg-white px-2 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row.deduction_amount}
                          onChange={(e) => updateRow(idx, { deduction_amount: allowNonNegativeDecimal(e.target.value, true) })}
                          onKeyDown={onKeyDownRow(idx)}
                          className="w-24 rounded-md border border-zinc-200 bg-white px-2 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
                        />
                        {showDeductionReason && (
                          <input
                            value={row.deduction_reason}
                            onChange={(e) => updateRow(idx, { deduction_reason: e.target.value })}
                            placeholder={t("dailyOps.deductionReason")}
                            className="w-full rounded-md border border-zinc-200 bg-white px-2 py-2 text-xs text-primary placeholder:text-primary/40 dark:border-zinc-700 dark:bg-zinc-900"
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={row.tips}
                        onChange={(e) => updateRow(idx, { tips: allowNonNegativeDecimal(e.target.value, true) })}
                        onKeyDown={onKeyDownRow(idx)}
                        className="w-24 rounded-md border border-zinc-200 bg-white px-2 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </td>
                    <td className={`px-3 py-2 ${thAlign(locale, true)}`}>
                      {rows.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => removeRow(idx)}
                          className="rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title={t("dailyOps.removeRow")}
                          aria-label={t("dailyOps.removeRow")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : (
                        <span className="text-xs text-primary/40">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={addRow}
            className="rounded-md border border-dashed border-primary px-3 py-2 text-sm text-primary hover:bg-primary/5"
          >
            {t("dailyOps.addRow")}
          </button>
          <div className="text-xs text-primary/60">{t("dailyOps.keyboardHelp")}</div>
        </div>

        <div className="grid grid-cols-1 gap-2 rounded-md border border-zinc-200 bg-white p-3 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800 sm:grid-cols-3 lg:grid-cols-6">
          <div>
            <div className="text-xs text-primary/60">{t("dailyOps.summaryOrders")}</div>
            <div className="font-semibold">{summary.orders.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-primary/60">{t("dailyOps.summaryRevenue")}</div>
            <div className="font-semibold">{formatAmount(summary.revenue)}</div>
          </div>
          <div>
            <div className="text-xs text-primary/60">{t("dailyOps.summaryCashCollected")}</div>
            <div className="font-semibold">{formatAmount(summary.cashCollected)}</div>
          </div>
          <div>
            <div className="text-xs text-primary/60">{t("dailyOps.summaryCashReceived")}</div>
            <div className="font-semibold">{formatAmount(summary.cashReceived)}</div>
          </div>
          <div>
            <div className="text-xs text-primary/60">{t("dailyOps.summaryDeductions")}</div>
            <div className="font-semibold">{formatAmount(summary.deductions)}</div>
          </div>
          <div>
            <div className="text-xs text-primary/60">{t("dailyOps.summaryTips")}</div>
            <div className="font-semibold">{formatAmount(summary.tips)}</div>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {error}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              if (!dirty || confirm(t("common.unsavedPrompt"))) {
                onClose();
              }
            }}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={() => submit("draft")}
            disabled={saving}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            {saving ? t("common.saving") : t("dailyOps.saveDraft")}
          </button>
          <button
            type="button"
            onClick={() => submit("approve")}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("dailyOps.saveAndApprove")}
          </button>
        </div>
      </div>
      </LocalizationProvider>
    </Modal>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  min,
  step,
  disabled = false,
  onKeyDown,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  min?: number;
  step?: string;
  disabled?: boolean;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="text-sm text-primary">{label}</label>
      <input
        type={type}
        min={min}
        step={step}
        disabled={disabled}
        onKeyDown={onKeyDown}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 disabled:bg-zinc-100 disabled:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900"
      />
    </div>
  );
}

function EmployeeCard({ employee }: { employee: EmployeeOption }) {
  const nameAr = employee.recruitment_candidate?.full_name_ar ?? employee.full_name_ar ?? "-";
  const nameEn = employee.recruitment_candidate?.full_name_en ?? employee.full_name_en ?? "-";
  const initial = (nameAr || employee.employee_no || employee.employee_code || "?").charAt(0);

  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-lg font-semibold text-primary">
          {employee.avatar_file_id ? (
            <img
              src={`/api/files/${employee.avatar_file_id}/view`}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            initial
          )}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-primary">{nameAr}</div>
            <PlatformIcon platform={(employee.assigned_platform as string) ?? "NONE"} />
          </div>
          <div className="flex items-center justify-between text-sm text-primary/70">
            <span>{nameEn}</span>
            <span className="font-mono">{employee.employee_no ?? employee.employee_code ?? "-"}</span>
          </div>
          {employee.status_code ? (
            <StatusBadge status={employee.status_code} />
          ) : null}
        </div>
      </div>
    </div>
  );
}


