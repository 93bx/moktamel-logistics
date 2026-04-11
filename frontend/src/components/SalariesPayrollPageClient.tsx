"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Banknote,
  CalendarDays,
  CircleHelp,
  Download,
  Eye,
  FileSpreadsheet,
  PiggyBank,
  Printer,
  Receipt,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  ChevronDown,
  X,
  BarChart3,
  DollarSign,
} from "lucide-react";
import {
  useSalariesPayroll,
  useSalariesPayrollDetail,
  useCreateSalaryReceipt,
  type SalariesPayrollDetailRow,
} from "@/hooks/use-salaries-payroll";
import type { SalariesPayrollRow } from "@/lib/types/salaries-payroll";
import type { PayrollSortKey } from "@/lib/types/salaries-payroll";
import { Modal } from "./Modal";
import { PlatformIcon } from "./PlatformIcon";
import { FileUpload } from "./FileUpload";
import { downloadSalariesPayrollExport } from "@/lib/salaries-payroll-export";

function num(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return Number(v);
}

function performanceDeduction(row: SalariesPayrollRow): number {
  return num(row.total_deductions);
}

function monthDateBounds(monthYYYYMM: string): { minDate: string; maxDate: string } {
  const [y, m] = monthYYYYMM.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const mm = String(m).padStart(2, "0");
  return {
    minDate: `${y}-${mm}-01`,
    maxDate: `${y}-${mm}-${String(lastDay).padStart(2, "0")}`,
  };
}

function defaultPaymentDateInMonth(monthYYYYMM: string): string {
  const { minDate, maxDate } = monthDateBounds(monthYYYYMM);
  const today = new Date();
  const ty = today.getFullYear();
  const tm = today.getMonth() + 1;
  const td = today.getDate();
  const [y, m] = monthYYYYMM.split("-").map(Number);
  if (ty === y && tm === m) {
    const maxD = Number(maxDate.slice(-2));
    const d = Math.min(td, maxD);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return minDate;
}

function grandTotalDeductions(row: SalariesPayrollRow): number {
  return (
    performanceDeduction(row) +
    num(row.operations_deductions_total) +
    num(row.scheduled_loan_installments)
  );
}

interface SalariesPayrollPageClientProps {
  locale: string;
  month: string;
  sort?: PayrollSortKey;
}

function StatTip({ tip, locale }: { tip: string; locale: string }) {
  return (
    <span
      className={`pointer-events-auto absolute top-2 ${locale === "ar" ? "left-2" : "right-2"} group/tip inline-flex cursor-help items-center justify-center rounded-full bg-zinc-100 p-1 text-primary/60 shadow-sm ring-1 ring-zinc-200 transition-colors hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:ring-zinc-600 dark:hover:bg-zinc-600`}
      aria-label={tip}
      role="img"
    >
      <CircleHelp className="h-3.5 w-3.5" aria-hidden />
      <span
        className={`pointer-events-none absolute top-full z-20 mt-2 w-56 rounded-md border border-zinc-200 bg-white p-2 text-xs font-normal text-zinc-700 opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-visible/tip:opacity-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ${locale === "ar" ? "left-0 text-right" : "right-0 text-left"}`}
        role="tooltip"
      >
        {tip}
      </span>
    </span>
  );
}

/** Help icon + tooltip for payroll view modal sections (locale selects tooltip alignment). */
function ModalHelpTip({ tip, locale }: { tip: string; locale: string }) {
  return (
    <span
      className={`group/mhtip relative inline-flex shrink-0 align-middle ${locale === "ar" ? "ms-1" : "me-1"}`}
    >
      <span
        className="inline-flex cursor-help rounded-full p-1 text-primary/45 transition hover:bg-zinc-100 hover:text-primary focus-visible:outline focus-visible:ring-2 focus-visible:ring-primary/30 dark:hover:bg-zinc-800"
        aria-label={tip}
        role="img"
      >
        <CircleHelp className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span
        className={`pointer-events-none absolute z-[100] mt-2 w-[min(18rem,calc(100vw-3rem))] rounded-md border border-zinc-200 bg-white p-2 text-xs font-normal leading-snug text-zinc-700 opacity-0 shadow-lg transition-opacity duration-150 group-hover/mhtip:opacity-100 group-focus-within/mhtip:opacity-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ${locale === "ar" ? "end-0 text-right" : "start-0 text-left"}`}
        role="tooltip"
      >
        {tip}
      </span>
    </span>
  );
}

function PayrollMonthFilter({
  locale,
  month,
  sort,
}: {
  locale: string;
  month: string;
  sort?: PayrollSortKey;
}) {
  const t = useTranslations();
  const tDashboard = useTranslations("dashboard");
  const formRef = useRef<HTMLFormElement>(null);
  const [selectedYear, setSelectedYear] = useState(() => Number(month.split("-")[0]));
  const [selectedMonth, setSelectedMonth] = useState(() => Number(month.split("-")[1]));

  useEffect(() => {
    const [y, m] = month.split("-").map(Number);
    setSelectedYear(y);
    setSelectedMonth(m);
  }, [month]);

  const currentDate = useMemo(() => new Date(), []);
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  const years = useMemo(
    () => Array.from({ length: 3 }, (_, i) => currentYear - 2 + i),
    [currentYear],
  );

  const visibleMonths = useMemo(() => {
    if (selectedYear < currentYear) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    return Array.from({ length: currentMonth }, (_, i) => i + 1);
  }, [selectedYear, currentYear, currentMonth]);

  const handleMonthClick = (m: number) => {
    setSelectedMonth(m);
    const yearSelect = formRef.current?.querySelector<HTMLSelectElement>("select");
    const year = yearSelect ? Number(yearSelect.value) : selectedYear;
    const value = `${year}-${String(m).padStart(2, "0")}`;
    const input = formRef.current?.querySelector<HTMLInputElement>('input[name="month"]');
    if (input) {
      input.value = value;
      formRef.current?.submit();
    }
  };

  return (
    <form
      ref={formRef}
      action={`/${locale}/salaries-payroll`}
      method="get"
      className="flex w-full flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-700/80 dark:bg-zinc-900/80"
    >
      {sort && sort !== "default" ? (
        <input type="hidden" name="sort" value={sort} readOnly />
      ) : null}
      <input
        type="hidden"
        name="month"
        value={`${selectedYear}-${String(selectedMonth).padStart(2, "0")}`}
        readOnly
      />
      <div className="flex flex-wrap items-center gap-2">
        <label className="text-sm font-semibold text-primary">{tDashboard("controls.year")}</label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="rounded-xl border border-primary bg-slate-50/80 px-3 py-2 text-sm font-semibold text-primary outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 dark:border-zinc-600 dark:bg-zinc-800 dark:text-slate-200"
          aria-label={tDashboard("controls.year")}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <div className="flex flex-1 flex-wrap items-center gap-2">
          {visibleMonths.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => handleMonthClick(m)}
              className={`min-w-[3.5rem] rounded-xl px-3 py-2 text-sm font-semibold transition-all ${selectedMonth === m
                ? "bg-primary-600 text-white shadow-md"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-700 dark:text-slate-300 dark:hover:bg-zinc-600"
                }`}
            >
              {tDashboard(`controls.month${m}` as "controls.month1")}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}

function buildSalariesPayrollHref(
  locale: string,
  p: { month: string; sort?: PayrollSortKey },
) {
  const params = new URLSearchParams();
  params.set("month", p.month);
  if (p.sort && p.sort !== "default") params.set("sort", p.sort);
  return `/${locale}/salaries-payroll?${params.toString()}`;
}

export function SalariesPayrollPageClient({ locale, month, sort }: SalariesPayrollPageClientProps) {
  const t = useTranslations();
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [exporting, setExporting] = useState(false);

  const sortKey: PayrollSortKey = sort ?? "default";
  const hasSortApplied = Boolean(sort && sort !== "default");

  const { data, loading, error, refresh } = useSalariesPayroll({
    month,
    status: statusFilter,
    search,
    page,
    pageSize,
    sort: sortKey,
  });

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const formatAmount = (v: number) =>
    v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const targetType = (row: SalariesPayrollRow) =>
    row.employee?.target_type || "TARGET_TYPE_ORDERS";

  const rowTone = (row: SalariesPayrollRow): "" | "success" | "danger" => {
    const dm = row.deduction_method;
    const isOrders = dm === "DEDUCTION_FIXED" || dm === "DEDUCTION_ORDERS_TIERS";
    const isRev = dm === "DEDUCTION_REVENUE_TIERS";
    if (isOrders && row.target_difference >= 0) return "success";
    if (isOrders && row.target_difference < 0) return "danger";
    if (isRev && row.target_difference >= 0) return "success";
    if (isRev && row.target_difference < 0) return "danger";
    return "";
  };

  const rowClass = (row: SalariesPayrollRow) => {
    const tone = rowTone(row);
    if (!tone) return "hover:bg-zinc-50 dark:hover:bg-zinc-700/50";
    if (tone === "success")
      return "bg-emerald-50/60 hover:bg-emerald-50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/30";
    return "bg-red-50/60 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/30";
  };

  return (
    <div className="space-y-3">
      {data?.needsApproval && (
        <div className="space-y-2">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/20">
            <h3 className="text-base font-semibold text-amber-900 dark:text-amber-100">
              {t("payrollConfig.needsApproval")}
            </h3>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
              {t("salariesPayroll.needsApprovalBody", { month: data.month ?? month })}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/${locale}/payroll-config?year=${(data.month ?? month).split("-")[0]}&month=${(data.month ?? month).split("-")[1]}`}
                className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                {t("salariesPayroll.goToPayrollSettings")}
              </Link>
            </div>
          </div>
          <PayrollMonthFilter locale={locale} month={month} sort={sort} />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          <div className="flex items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => refresh()}
              className="shrink-0 rounded border border-red-300 bg-white px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 dark:border-red-700 dark:bg-red-900/40 dark:text-red-200 dark:hover:bg-red-900/60"
            >
              {t("common.retry")}
            </button>
          </div>
        </div>
      )}

      {!data?.needsApproval && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {(
              [
                {
                  key: "default" as const,
                  label: t("salariesPayroll.stats.activeEmployees"),
                  value: data?.quickStats.activeEmployeesCount.toLocaleString() ?? "0",
                  tip: t("salariesPayroll.statsTip.activeEmployees"),
                  href: buildSalariesPayrollHref(locale, { month, sort: undefined }),
                  icon: Users,
                },
                {
                  key: "revenue" as const,
                  label: t("salariesPayroll.stats.totalRevenue"),
                  value: formatAmount(data?.quickStats.totalRevenueAmount ?? 0),
                  tip: t("salariesPayroll.statsTip.totalRevenue"),
                  href: buildSalariesPayrollHref(locale, { month, sort: "revenue" }),
                  icon: TrendingUp,
                },
                {
                  key: "salary_due" as const,
                  label: t("salariesPayroll.stats.totalSalariesDue"),
                  value: formatAmount(data?.quickStats.totalSalariesDueAmount ?? 0),
                  tip: t("salariesPayroll.statsTip.totalSalariesDue"),
                  href: buildSalariesPayrollHref(locale, { month, sort: "salary_due" }),
                  icon: Banknote,
                },
                {
                  key: "deductions" as const,
                  label: t("salariesPayroll.stats.totalDeductions"),
                  value: formatAmount(data?.quickStats.totalDeductionsAmount ?? 0),
                  tip: t("salariesPayroll.statsTip.totalDeductions"),
                  href: buildSalariesPayrollHref(locale, { month, sort: "deductions" }),
                  icon: TrendingDown,
                },
                {
                  key: "loans" as const,
                  label: t("salariesPayroll.stats.totalLoans"),
                  value: formatAmount(data?.quickStats.totalLoansAmount ?? 0),
                  tip: t("salariesPayroll.statsTip.totalLoans"),
                  href: buildSalariesPayrollHref(locale, { month, sort: "loans" }),
                  icon: PiggyBank,
                },
                {
                  key: "uncollected" as const,
                  label: t("salariesPayroll.stats.totalUncollectedCash"),
                  value: formatAmount(data?.quickStats.totalUncollectedCashAmount ?? 0),
                  tip: t("salariesPayroll.statsTip.totalUncollectedCash"),
                  href: buildSalariesPayrollHref(locale, { month, sort: "default" }),
                  icon: Wallet,
                },
              ] as const
            ).map(({ key, label, value, tip, href, icon: Icon }) => {
              const isActive =
                key === "default"
                  ? !hasSortApplied
                  : key === "uncollected"
                    ? false
                    : sortKey === key;
              const cardHref =
                key === "uncollected"
                  ? href
                  : isActive && key !== "default"
                    ? buildSalariesPayrollHref(locale, { month, sort: undefined })
                    : href;
              return (
                <Link
                  key={key}
                  href={cardHref}
                  className={`group relative rounded-lg border p-4 transition-colors dark:bg-zinc-800 ${isActive
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20 dark:bg-primary/10"
                    : "border-zinc-200 bg-white dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
                    } cursor-pointer`}
                >
                  <StatTip tip={tip} locale={locale} />
                  <div className="flex items-center gap-2 text-sm text-primary/70">
                    <Icon className="h-4 w-4 text-primary/70" />
                    <span>{label}</span>
                  </div>
                  <div className="mt-1 text-2xl font-semibold text-primary">{value}</div>
                </Link>
              );
            })}
          </div>

          <PayrollMonthFilter locale={locale} month={month} sort={sort} />

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm text-primary/60">{t("salariesPayroll.status")}:</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800"
              >
                <option value="ALL">{t("salariesPayroll.statusAll")}</option>
                <option value="PAID">{t("salariesPayroll.statusPaid")}</option>
                <option value="NOT_PAID">{t("salariesPayroll.statusNotPaid")}</option>
              </select>
              <input
                type="text"
                placeholder={t("salariesPayroll.searchPlaceholder")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-64 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800"
              />
            </div>
            <details className="relative">
              <summary className="inline-flex list-none cursor-pointer items-center gap-2 rounded-md border border-[#0E5C2F] bg-[#107C41] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#185C37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#107C41]/40 dark:border-[#21A366] dark:bg-[#107C41] dark:hover:bg-[#185C37] [&::-webkit-details-marker]:hidden">
                <FileSpreadsheet className="h-4 w-4" />
                {t("common.excel")}
                <ChevronDown className="h-4 w-4" />
              </summary>
              <div className="absolute end-0 z-20 mt-2 min-w-40 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                <button
                  type="button"
                  disabled={exporting}
                  onClick={() => {
                    void (async () => {
                      setExporting(true);
                      try {
                        await downloadSalariesPayrollExport({
                          month,
                          status: statusFilter,
                          search: search || undefined,
                          sort: sortKey === "default" ? undefined : sortKey,
                          locale: locale === "ar" ? "ar" : "en",
                        });
                      } catch (e) {
                        console.error(e);
                        alert(e instanceof Error ? e.message : t("salariesPayroll.exportFailed"));
                      } finally {
                        setExporting(false);
                      }
                    })();
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-primary hover:bg-zinc-50 dark:hover:bg-zinc-700 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {exporting ? t("common.loading") : t("common.export")}
                </button>
              </div>
            </details>
          </div>

          <div className="rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-sm">
                <thead className="bg-zinc-50 text-xs uppercase text-primary/60 dark:bg-zinc-800/60">
                  <tr>
                    <th className="px-3 py-3 text-start">{t("salariesPayroll.colEmployee")}</th>
                    <th className="px-3 py-3 text-start">{t("salariesPayroll.colPlatform")}</th>
                    <th className="px-3 py-3 text-end">{t("salariesPayroll.colBasicSalary")}</th>
                    <th className="px-3 py-3 text-start">{t("salariesPayroll.colCalculationMethod")}</th>
                    <th className="px-3 py-3 text-end">{t("salariesPayroll.colOrdersRevenue")}</th>
                    <th className="px-3 py-3 text-end">{t("salariesPayroll.colTargetDiff")}</th>
                    <th className="px-3 py-3 text-end">{t("salariesPayroll.colTargetDeduction")}</th>
                    <th className="px-3 py-3 text-end">{t("salariesPayroll.colTotalDeductions")}</th>
                    <th className="px-3 py-3 text-end">{t("salariesPayroll.colTipsBonus")}</th>
                    <th className="px-3 py-3 text-end">{t("salariesPayroll.colFinalSalary")}</th>
                    <th className="px-3 py-3 text-center">{t("salariesPayroll.colStatus")}</th>
                    <th className="px-3 py-3 text-end">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
                  {loading ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-8 text-center text-primary/60">
                        {t("common.loading")}
                      </td>
                    </tr>
                  ) : data?.items.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-8 text-center text-primary/60">
                        {t("common.noResults")}
                      </td>
                    </tr>
                  ) : (
                    data?.items.map((row) => {
                      const tt = targetType(row);
                      const ordersOrRev =
                        tt === "TARGET_TYPE_REVENUE"
                          ? formatAmount(num(row.total_revenue))
                          : `${row.orders_count}`;
                      const diffDisplay =
                        tt === "TARGET_TYPE_REVENUE"
                          ? `${row.target_difference >= 0 ? "+" : ""}${formatAmount(Math.abs(row.target_difference))} ${t("employment.sar")}`
                          : `${row.target_difference >= 0 ? "+" : ""}${row.target_difference} ${t("salariesPayroll.ordersUnit")}`;
                      const dmLabel = t(`salariesPayroll.deduction_${row.deduction_method}` as "salariesPayroll.deduction_DEDUCTION_FIXED");
                      return (
                        <tr key={row.id} className={rowClass(row)}>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-zinc-200">
                                {row.employee_avatar_url ? (
                                  <img
                                    src={`/api/files/${row.employee_avatar_url}/view`}
                                    alt=""
                                    className="h-full w-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = "none";
                                    }}
                                  />
                                ) : null}
                              </div>
                              <div>
                                <div className="font-medium leading-tight text-primary">
                                  {(locale === "ar" ? row.employee_name_ar : row.employee_name_en) ||
                                    row.employee_code ||
                                    "—"}
                                </div>
                                {row.employee_code ? (
                                  <div className="text-xs text-primary/40">{row.employee_code}</div>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {row.employee?.assigned_platform ? (
                              <div className="flex flex-col gap-0.5">
                                <PlatformIcon platform={row.employee.assigned_platform} />
                                {row.employee.platform_user_no ? (
                                  <span className="font-semibold text-primary">{row.employee.platform_user_no}</span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-end font-medium">{formatAmount(num(row.base_salary))}</td>
                          <td className="px-3 py-3">
                            <span
                              className="cursor-help border-b border-dotted border-primary/30"
                              title={t(`salariesPayroll.deductionHelp_${row.deduction_method}` as "salariesPayroll.deductionHelp_DEDUCTION_FIXED")}
                            >
                              {dmLabel}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-end font-medium">{ordersOrRev}</td>
                          <td className="px-3 py-3 text-end" title={t("salariesPayroll.targetDiffHint")}>
                            <span
                              className={
                                row.target_difference >= 0 ? "font-semibold text-emerald-600" : "font-semibold text-red-600"
                              }
                            >
                              {diffDisplay}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-end text-red-600">{formatAmount(performanceDeduction(row))}</td>
                          <td
                            className="px-3 py-3 text-end text-red-600"
                            title={t("salariesPayroll.totalDeductionsHint")}
                          >
                            {formatAmount(grandTotalDeductions(row))}
                          </td>
                          <td
                            className="px-3 py-3 text-end text-emerald-700"
                            title={t("salariesPayroll.tipsBonusHint")}
                          >
                            {formatAmount(num(row.total_bonus))}
                          </td>
                          <td
                            className="px-3 py-3 text-end font-semibold"
                            title={t("salariesPayroll.finalSalaryHint")}
                          >
                            {formatAmount(num(row.salary_after_deductions))}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase leading-none ${row.status === "PAID"
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                }`}
                            >
                              {t(`salariesPayroll.status_${row.status}`)}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-end">
                            <div className="flex justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedEmployeeId(row.id);
                                  setIsViewModalOpen(true);
                                }}
                                className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                title={t("common.view")}
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {row.status === "NOT_PAID" && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedEmployeeId(row.id);
                                    setIsReceiptModalOpen(true);
                                  }}
                                  className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                                  title={t("salariesPayroll.addReceipt")}
                                >
                                  <Receipt className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {data && data.pagination.total > pageSize && (
            <div className="flex items-center justify-between border-t border-zinc-100 pt-4 dark:border-zinc-700">
              <div className="text-sm text-primary/60">
                {t("common.showing", {
                  from: (page - 1) * pageSize + 1,
                  to: Math.min(page * pageSize, data.pagination.total),
                  total: data.pagination.total,
                })}
              </div>
              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-md border border-zinc-200 px-3 py-1 text-sm disabled:opacity-50"
                >
                  {t("common.previous")}
                </button>
                <button
                  disabled={page * pageSize >= data.pagination.total}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-md border border-zinc-200 px-3 py-1 text-sm disabled:opacity-50"
                >
                  {t("common.next")}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedEmployeeId(null);
        }}
        title={t("salariesPayroll.viewEmployeeDetail")}
        maxWidth="5xl"
        contentClassName="p-0"
      >
        <EmployeePayrollDetailView
          id={selectedEmployeeId}
          locale={locale}
          month={month}
          onClose={() => setIsViewModalOpen(false)}
          onAddReceipt={() => {
            setIsViewModalOpen(false);
            setIsReceiptModalOpen(true);
          }}
        />
      </Modal>

      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setSelectedEmployeeId(null);
        }}
        title={t("salariesPayroll.addSalaryReceipt")}
        maxWidth="lg"
      >
        <AddReceiptForm
          id={selectedEmployeeId}
          locale={locale}
          month={month}
          onSave={() => {
            setIsReceiptModalOpen(false);
            setSelectedEmployeeId(null);
            refresh();
          }}
          onCancel={() => setIsReceiptModalOpen(false)}
        />
      </Modal>
    </div>
  );
}

function PayrollEmployeeInfoCard({
  d,
  locale,
  month,
  showFinalSalary,
}: {
  d: SalariesPayrollDetailRow;
  locale: string;
  month: string;
  showFinalSalary?: boolean;
}) {
  const t = useTranslations();
  const formatAmount = (v: number) =>
    v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div
      className={`relative rounded-xl border border-zinc-200 bg-gradient-to-br from-slate-50 to-white p-4 dark:border-zinc-700 dark:from-zinc-900 dark:to-zinc-950 ${locale === "ar" ? "ps-11" : "pe-11"}`}
    >
      <div className={`absolute top-3 ${locale === "ar" ? "left-3" : "right-3"}`}>
        <ModalHelpTip tip={t("salariesPayroll.help.employeeCard")} locale={locale} />
      </div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-zinc-200">
          {d.employee_avatar_url ? (
            <img
              src={`/api/files/${d.employee_avatar_url}/view`}
              alt=""
              className="h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-semibold text-primary">
            {locale === "ar" ? d.employee_name_ar : d.employee_name_en || d.employee_name_ar}
          </div>
          <div className="text-sm text-primary/60">
            {locale === "ar" ? d.employee_name_en : d.employee_name_ar}
          </div>
          {d.employee_code ? (
            <div className="mt-1 text-sm text-primary/50">{d.employee_code}</div>
          ) : null}
        </div>
        <div
          className={`flex flex-col gap-2 sm:items-end ${locale === "ar" ? "sm:items-start" : "sm:items-end"}`}
        >
          <span
            className={`inline-flex w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase ${d.status === "PAID"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
              }`}
          >
            {t(`salariesPayroll.status_${d.status}`)}
          </span>
          {d.employee?.assigned_platform ? (
            <PlatformIcon platform={d.employee.assigned_platform} />
          ) : null}

          <div className="text-sm text-primary">
            {month}
          </div>
          {showFinalSalary ? (
            <div className="text-sm font-semibold text-primary">
              {t("salariesPayroll.finalSalary")}: {formatAmount(num(d.salary_after_deductions))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PerformanceInputsSummary({
  d,
  formatAmount,
}: {
  d: SalariesPayrollDetailRow;
  formatAmount: (v: number) => string;
}) {
  const t = useTranslations();
  const calcDetails = d.calculation_details as Record<string, unknown> | null;
  const inputs = calcDetails?.inputs as Record<string, unknown> | undefined;
  const tt = d.employee?.target_type || "TARGET_TYPE_ORDERS";
  const dm = d.deduction_method;

  const ordersAchieved = inputs != null ? num(inputs.ordersCount ?? inputs.orders_count) : d.orders_count;
  const revenueAchieved = inputs != null ? num(inputs.totalRevenue ?? inputs.total_revenue) : num(d.total_revenue);
  const monthlyOrdersTarget =
    inputs != null ? num(inputs.monthlyOrdersTarget ?? inputs.monthly_orders_target) : num(d.employee?.monthly_orders_target ?? d.monthly_target);
  const monthlyRevenueTarget =
    inputs != null
      ? num(inputs.monthlyRevenueTarget ?? inputs.monthly_revenue_target)
      : num(d.employee?.monthly_target_amount ?? d.monthly_target);

  const diffDisplay =
    tt === "TARGET_TYPE_REVENUE"
      ? `${d.target_difference >= 0 ? "+" : ""}${formatAmount(Math.abs(d.target_difference))} ${t("employment.sar")}`
      : `${d.target_difference >= 0 ? "+" : ""}${d.target_difference} ${t("salariesPayroll.ordersUnit")}`;

  return (
    <div className="rounded-md border border-zinc-200/80 bg-white/70 p-3 dark:border-zinc-600/60 dark:bg-zinc-900/50 w-full">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary/70">
        {t("salariesPayroll.breakdownInputsTitle")}
      </div>
      <ul className="space-y-1.5 text-primary/85">
        <li>
          <span className="text-primary/55">{t("salariesPayroll.targetType")}: </span>
          {tt === "TARGET_TYPE_REVENUE" ? t("employment.targetTypeRevenue") : t("employment.targetTypeOrders")}
        </li>
        {tt === "TARGET_TYPE_ORDERS" ? (
          <>
            <li>
              <span className="text-primary/55">{t("salariesPayroll.ordersCount")}: </span>
              {ordersAchieved}
            </li>
            <li>
              <span className="text-primary/55">{t("salariesPayroll.monthlyTarget")}: </span>
              {monthlyOrdersTarget}
            </li>
          </>
        ) : (
          <>
            <li>
              <span className="text-primary/55">{t("salariesPayroll.totalRevenue")}: </span>
              {formatAmount(revenueAchieved)} {t("employment.sar")}
            </li>
            <li>
              <span className="text-primary/55">{t("salariesPayroll.monthlyTarget")}: </span>
              {formatAmount(monthlyRevenueTarget)} {t("employment.sar")}
            </li>
          </>
        )}
        <li>
          <span className="text-primary/55">{t("salariesPayroll.targetDiff")}: </span>
          <span className={d.target_difference >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"}>
            {diffDisplay}
          </span>
        </li>
        <li>
          <span className="text-primary/55">{t("salariesPayroll.deductionMethod")}: </span>
          {t(`salariesPayroll.deduction_${dm}` as "salariesPayroll.deduction_DEDUCTION_FIXED")}
        </li>
        <li className="font-semibold text-primary">
          <span className="text-primary/55 font-normal">{t("salariesPayroll.colTargetDeduction")}: </span>
          {formatAmount(performanceDeduction(d))} {t("employment.sar")}
        </li>
      </ul>
    </div>
  );
}

function PerformanceDeductionBreakdown({
  d,
  formatAmount,
}: {
  d: SalariesPayrollDetailRow;
  formatAmount: (v: number) => string;
}) {
  const t = useTranslations();
  const calcDetails = d.calculation_details as Record<string, unknown> | null;
  const raw = calcDetails?.performanceDeductionBreakdown;
  const items = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
  const tt = d.employee?.target_type || "TARGET_TYPE_ORDERS";
  const dm = d.deduction_method;
  const td = d.target_difference;

  const noStepsExplanation = () => {
    if (td >= 0) return t("salariesPayroll.breakdownTargetMetNoShortfall");
    if (tt === "TARGET_TYPE_REVENUE" && dm === "DEDUCTION_FIXED") return t("salariesPayroll.breakdownRevenueFixedNote");
    return t("salariesPayroll.breakdownNoDetailShortfall");
  };

  return (
    <div className="flex border-t border-zinc-100 pt-3 text-xs dark:border-zinc-800">

      {items.length > 0 ? (
        <div className="space-y-3 w-full">
          <div className="text-[11px] font-semibold uppercase text-primary/60">{t("salariesPayroll.targetDeductionDetail")}</div>
          {items.map((b, idx) => {
            const type = String(b.type ?? "");
            if (type === "FIXED_PER_ORDER") {
              const inputs = calcDetails?.inputs as Record<string, unknown> | undefined;
              const achieved =
                inputs != null ? String(inputs.ordersCount ?? inputs.orders_count ?? "—") : "—";
              const targetOrders =
                inputs != null ? String(inputs.monthlyOrdersTarget ?? inputs.monthly_orders_target ?? "—") : "—";
              return (
                <ul key={idx} className="space-y-1 text-primary/80">
                  <li>
                    {t("salariesPayroll.targetType")}: {t("employment.targetTypeOrders")}
                  </li>
                  <li>
                    {t("salariesPayroll.breakdownAchieved")}: {achieved} · {t("salariesPayroll.monthlyTarget")}:{" "}
                    {targetOrders}
                  </li>
                  <li>
                    {t("salariesPayroll.breakdownMissingOrders")}: {String(b.missingOrders ?? "—")}
                  </li>
                  <li>
                    {t("salariesPayroll.breakdownRatePerOrder")}: {formatAmount(num(b.rate))}
                  </li>
                  <li className="font-medium text-primary">
                    {t("salariesPayroll.breakdownTotalFixedDeduction")}: {formatAmount(num(b.amount))}{" "}
                    {t("employment.sar")}
                  </li>
                </ul>
              );
            }
            if (type === "ORDERS_PROGRESSIVE") {
              const inputs = calcDetails?.inputs as Record<string, unknown> | undefined;
              const achievedOrd =
                inputs != null ? String(inputs.ordersCount ?? inputs.orders_count ?? "—") : "—";
              const targetOrd =
                inputs != null ? String(inputs.monthlyOrdersTarget ?? inputs.monthly_orders_target ?? "—") : "—";
              const br = Array.isArray(b.breakdown) ? (b.breakdown as Record<string, unknown>[]) : [];
              return (
                <div key={idx} className="space-y-2">
                  <p className="text-primary/70">
                    {t("salariesPayroll.targetType")}: {t("employment.targetTypeOrders")}
                  </p>
                  <p className="text-primary/70">
                    {t("salariesPayroll.breakdownAchieved")}: {achievedOrd} · {t("salariesPayroll.monthlyTarget")}:{" "}
                    {targetOrd}
                  </p>
                  <p className="text-primary/70">
                    {t("salariesPayroll.breakdownMissingOrders")}: {String(b.missingOrders ?? "—")}
                  </p>
                  <ul className="space-y-1 rounded-md bg-zinc-50 p-2 dark:bg-zinc-900/50">
                    {br.map((row, i) => (
                      <li key={i} className="text-primary/80">
                        {t("salariesPayroll.breakdownTierFrom")}{" "}
                        {String((row.tier as Record<string, unknown>)?.from ?? "")} —{" "}
                        {t("salariesPayroll.breakdownTierTo")}{" "}
                        {String((row.tier as Record<string, unknown>)?.to ?? "")}:{" "}
                        {t("salariesPayroll.breakdownApplicable")} {String(row.applicableAmount ?? "")},{" "}
                        {t("salariesPayroll.breakdownDeduction")} {formatAmount(num(row.tierDeduction))}
                      </li>
                    ))}
                  </ul>
                  <p className="font-medium text-primary">
                    {t("salariesPayroll.colTargetDeduction")}: {formatAmount(num(b.amount))} {t("employment.sar")}
                  </p>
                </div>
              );
            }
            if (type === "REVENUE_FLAT_BANDS") {
              const inputs = calcDetails?.inputs as Record<string, unknown> | undefined;
              const achievedRev =
                inputs != null ? formatAmount(num(inputs.totalRevenue ?? inputs.total_revenue)) : "—";
              const targetRev =
                inputs != null ? formatAmount(num(inputs.monthlyRevenueTarget ?? inputs.monthly_revenue_target)) : "—";
              const br = Array.isArray(b.breakdown) ? (b.breakdown as Record<string, unknown>[]) : [];
              return (
                <div key={idx} className="space-y-2">
                  <p className="text-primary/70">
                    {t("salariesPayroll.targetType")}: {t("employment.targetTypeRevenue")}
                  </p>
                  <p className="text-primary/70">
                    {t("salariesPayroll.breakdownAchieved")}: {achievedRev} {t("employment.sar")} ·{" "}
                    {t("salariesPayroll.monthlyTarget")}: {targetRev} {t("employment.sar")}
                  </p>
                  <p className="text-primary/70">
                    {t("salariesPayroll.breakdownMissingRevenue")}: {formatAmount(num(b.missingRevenue))} ·{" "}
                    {t("salariesPayroll.breakdownUnitBand")}: {formatAmount(num(b.unitAmount))}
                  </p>
                  <ul className="space-y-1 rounded-md bg-zinc-50 p-2 dark:bg-zinc-900/50">
                    {br.map((row, i) => (
                      <li key={i} className="text-primary/80">
                        {t("salariesPayroll.breakdownTierFrom")}{" "}
                        {String((row.tier as Record<string, unknown>)?.from ?? "")} —{" "}
                        {t("salariesPayroll.breakdownTierTo")}{" "}
                        {String((row.tier as Record<string, unknown>)?.to ?? "")}:{" "}
                        {t("salariesPayroll.breakdownApplicable")} {formatAmount(num(row.consumedDeficitSar))},{" "}
                        {t("salariesPayroll.breakdownFlat")} {formatAmount(num(row.tierDeduction))}
                      </li>
                    ))}
                  </ul>
                  <p className="font-medium text-primary">
                    {t("salariesPayroll.colTargetDeduction")}: {formatAmount(num(b.amount))} {t("employment.sar")}
                  </p>
                </div>
              );
            }
            return (
              <pre key={idx} className="overflow-x-auto text-[10px] text-primary/60">
                {JSON.stringify(b, null, 2)}
              </pre>
            );
          })}
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-primary/75">{noStepsExplanation()}</p>
      )}
      <PerformanceInputsSummary d={d} formatAmount={formatAmount} />
    </div>
  );
}

function MiniTable({
  title,
  columns,
  rows,
  emptyLabel,
  helpTip,
  locale,
}: {
  title: string;
  columns: { key: string; label: string }[];
  rows: Record<string, string | number>[];
  emptyLabel: string;
  helpTip?: string;
  locale?: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900/40">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-xs font-semibold uppercase text-primary/70 dark:border-zinc-800 dark:bg-zinc-800/50">
        <span>{title}</span>
        {helpTip && locale ? <ModalHelpTip tip={helpTip} locale={locale} /> : null}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[200px] text-xs">
          <thead>
            <tr className="text-start text-primary/50">
              {columns.map((c) => (
                <th key={c.key} className="px-2 py-2 font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-2 py-3 text-center text-primary/40">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                  {columns.map((c) => (
                    <td key={c.key} className="px-2 py-2 text-primary">
                      {row[c.key] ?? "—"}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Bilingual platform label for print (matches PlatformIcon). */
function platformLabelForPrint(
  platform: string | null | undefined,
  tr: (key: string) => string,
): string {
  if (!platform) return "—";
  switch (platform.toUpperCase()) {
    case "JAHEZ":
      return tr("common.platformJahez");
    case "NONE":
      return tr("common.platformNone");
    case "HUNGERSTATION":
      return tr("common.platformHungerstation");
    case "NINJA":
      return tr("common.platformNinja");
    case "KEETA":
      return tr("common.platformKeeta");
    default:
      return platform;
  }
}

function PayrollEnterprisePrintView({
  d,
  month,
  locale,
  tt,
  targetTypeLabel,
  formatAmount,
  loanRows,
  otherDedRows,
  tipsRows,
  cashCollected,
  cashReceived,
  cashDiff,
}: {
  d: SalariesPayrollDetailRow;
  month: string;
  locale: string;
  tt: string;
  targetTypeLabel: string;
  formatAmount: (v: number) => string;
  loanRows: { date: string; amount: string; status: string; note: string }[];
  otherDedRows: { date: string; amount: string; type: string; notes: string }[];
  tipsRows: { date: string; amount: string; type: string }[];
  cashCollected: number | null | undefined;
  cashReceived: number | null | undefined;
  cashDiff: number;
}) {
  const t = useTranslations();
  const tApp = useTranslations("app");
  const nameDisplay = (locale === "ar" ? d.employee_name_ar : d.employee_name_en || d.employee_name_ar) || "—";
  const nameAlt = locale === "ar" ? d.employee_name_en : d.employee_name_ar;
  const generated = new Date().toLocaleString(locale === "ar" ? "ar-SA" : "en-GB", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const dmLabel = t(`salariesPayroll.deduction_${d.deduction_method}` as "salariesPayroll.deduction_DEDUCTION_FIXED");

  return (
    <div
      id="payroll-print-document"
      className="hidden bg-white text-sm leading-relaxed text-zinc-900 print:block"
      dir={locale === "ar" ? "rtl" : "ltr"}
    >
      <div className="border-b-4 border-[#244473] pb-4">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#244473]">{tApp("title")}</h1>
            <p className="mt-1 text-xs font-medium uppercase tracking-wider text-zinc-500">{t("salariesPayroll.printSubtitle")}</p>
          </div>
          <div className="text-end text-xs text-zinc-600">
            <div className="font-semibold text-zinc-900">{t("salariesPayroll.printDocumentTitle")}</div>
            <div>
              {t("salariesPayroll.payrollMonth")}: {month}
            </div>
            <div>
              {t("salariesPayroll.printGeneratedAt")}: {generated}
            </div>
          </div>
        </div>
      </div>

      <section className="mt-6 break-inside-avoid border border-zinc-300 p-4">
        <h2 className="border-b border-zinc-200 pb-2 text-sm font-bold uppercase tracking-wide text-zinc-800">
          {t("salariesPayroll.colEmployee")}
        </h2>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-full border border-zinc-200 bg-zinc-100 print:h-24 print:w-24">
            {d.employee_avatar_url ? (
              <img
                src={`/api/files/${d.employee_avatar_url}/view`}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">—</div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-lg font-bold text-zinc-900">{nameDisplay}</div>
            {nameAlt ? <div className="text-sm text-zinc-600">{nameAlt}</div> : null}
            {d.employee_code ? (
              <div className="mt-1 text-sm text-zinc-700">
                <span className="font-medium text-zinc-500">{t("common.employeeCode")}: </span>
                {d.employee_code}
              </div>
            ) : null}
            <table className="mt-3 w-full border-collapse border border-zinc-200 text-xs">
              <tbody>
                <tr>
                  <td className="border border-zinc-200 bg-zinc-50 px-2 py-1 font-medium">{t("common.fullNameEn")}</td>
                  <td className="border border-zinc-200 px-2 py-1">{d.employee_name_en ?? "—"}</td>
                </tr>
                <tr>
                  <td className="border border-zinc-200 bg-zinc-50 px-2 py-1 font-medium">{t("common.fullNameAr")}</td>
                  <td className="border border-zinc-200 px-2 py-1">{d.employee_name_ar ?? "—"}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="shrink-0 text-sm sm:min-w-[10rem] sm:text-end">
            <div
              className={`inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase ${d.status === "PAID" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
            >
              {t(`salariesPayroll.status_${d.status}`)}
            </div>
            <div className="mt-2 text-zinc-700">
              <span className="block text-[10px] font-semibold uppercase text-zinc-500">{t("common.operatingPlatform")}</span>
              <span className="font-medium">{platformLabelForPrint(d.employee?.assigned_platform, t)}</span>
            </div>
            <div className="mt-2 text-zinc-700">
              <span className="block text-[10px] font-semibold uppercase text-zinc-500">{t("common.platformUserNo")}</span>
              <span className="font-medium">{d.employee?.platform_user_no ?? "—"}</span>
            </div>
            <div className="mt-3 border-t border-zinc-200 pt-2">
              <div className="text-[10px] font-semibold uppercase text-zinc-500">{t("salariesPayroll.payrollMonth")}</div>
              <div className="font-medium text-zinc-900">{month}</div>
            </div>
            <div className="mt-3 rounded-md border border-[#244473]/30 bg-[#f0f4fa] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase text-[#244473]/80">{t("salariesPayroll.finalSalary")}</div>
              <div className="text-lg font-bold text-[#244473]">
                {formatAmount(num(d.salary_after_deductions))} {t("employment.sar")}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 break-inside-avoid border border-zinc-300 p-4">
        <h2 className="border-b border-zinc-200 pb-2 text-sm font-bold uppercase tracking-wide text-zinc-800">
          {t("salariesPayroll.printSectionSalary")}
        </h2>
        <table className="mt-3 w-full border-collapse border border-zinc-300 text-sm">
          <tbody>
            <tr>
              <td className="border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-medium">{t("salariesPayroll.workingDays")}</td>
              <td className="border border-zinc-200 px-2 py-1.5">{d.working_days}</td>
            </tr>
            <tr>
              <td className="border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-medium">
                {tt === "TARGET_TYPE_REVENUE" ? t("salariesPayroll.totalRevenue") : t("salariesPayroll.ordersCount")}
              </td>
              <td className="border border-zinc-200 px-2 py-1.5">
                {tt === "TARGET_TYPE_REVENUE" ? formatAmount(num(d.total_revenue)) : d.orders_count}
              </td>
            </tr>
            <tr>
              <td className="border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-medium">{t("salariesPayroll.targetDiff")}</td>
              <td className="border border-zinc-200 px-2 py-1.5">
                {tt === "TARGET_TYPE_REVENUE"
                  ? `${d.target_difference >= 0 ? "+" : ""}${formatAmount(Math.abs(d.target_difference))} ${t("employment.sar")}`
                  : `${d.target_difference >= 0 ? "+" : ""}${d.target_difference} ${t("salariesPayroll.ordersUnit")}`}
              </td>
            </tr>
            <tr>
              <td className="border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-medium">{t("salariesPayroll.colTargetDeduction")}</td>
              <td className="border border-zinc-200 px-2 py-1.5 font-semibold text-red-800">
                {formatAmount(performanceDeduction(d))} {t("employment.sar")}
              </td>
            </tr>
            <tr>
              <td className="border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-medium">{t("salariesPayroll.scheduledLoans")}</td>
              <td className="border border-zinc-200 px-2 py-1.5">{formatAmount(num(d.scheduled_loan_installments))}</td>
            </tr>
            <tr>
              <td className="border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-medium">{t("salariesPayroll.operationsDeductions")}</td>
              <td className="border border-zinc-200 px-2 py-1.5">{formatAmount(num(d.operations_deductions_total))}</td>
            </tr>
            <tr>
              <td className="border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-medium">{t("salariesPayroll.bonuses")}</td>
              <td className="border border-zinc-200 px-2 py-1.5">{formatAmount(num(d.total_bonus))}</td>
            </tr>
            <tr>
              <td className="border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-medium">{t("salariesPayroll.carryoverAdjustment")}</td>
              <td className="border border-zinc-200 px-2 py-1.5">{formatAmount(num(d.carryover_adjustment_sar))}</td>
            </tr>
            <tr>
              <td className="border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-medium">{t("salariesPayroll.collectedCashHint")}</td>
              <td className="border border-zinc-200 px-2 py-1.5">{formatAmount(num(d.total_unreceived_cash))}</td>
            </tr>
            <tr>
              <td className="border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-base font-bold">{t("salariesPayroll.finalSalary")}</td>
              <td className="border border-zinc-200 bg-[#f0f4fa] px-2 py-2 text-lg font-bold text-[#244473]">
                {formatAmount(num(d.salary_after_deductions))} {t("employment.sar")}
              </td>
            </tr>
          </tbody>
        </table>

        <div className="mt-6 rounded-md border border-zinc-200 bg-zinc-50/80 p-3 print:border-zinc-300 print:bg-white">
          <h3 className="mb-2 border-b border-zinc-200 pb-1 text-xs font-bold uppercase tracking-wide text-zinc-800">
            {t("salariesPayroll.performanceDeductionCardTitle")}
          </h3>
          <PerformanceDeductionBreakdown d={d} formatAmount={formatAmount} />
        </div>
      </section>

      <section className="mt-6 break-inside-avoid border border-zinc-300 p-4">
        <h3 className="mb-2 text-xs font-bold uppercase text-zinc-700">{t("salariesPayroll.tableLoans")}</h3>
        <table className="w-full border-collapse border border-zinc-300 text-xs">
          <thead>
            <tr className="bg-zinc-100">
              <th className="border border-zinc-300 px-2 py-1 text-start">{t("salariesPayroll.colLoanDate")}</th>
              <th className="border border-zinc-300 px-2 py-1 text-start">{t("salariesPayroll.colLoanAmount")}</th>
              <th className="border border-zinc-300 px-2 py-1 text-start">{t("salariesPayroll.colLoanStatus")}</th>
              <th className="border border-zinc-300 px-2 py-1 text-start">{t("salariesPayroll.colLoanNote")}</th>
            </tr>
          </thead>
          <tbody>
            {loanRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="border border-zinc-300 px-2 py-2 text-center text-zinc-500">
                  {t("salariesPayroll.noRows")}
                </td>
              </tr>
            ) : (
              loanRows.map((r, i) => (
                <tr key={i}>
                  <td className="border border-zinc-300 px-2 py-1">{r.date}</td>
                  <td className="border border-zinc-300 px-2 py-1">{r.amount}</td>
                  <td className="border border-zinc-300 px-2 py-1">{r.status}</td>
                  <td className="border border-zinc-300 px-2 py-1">{r.note}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="mt-4 border border-zinc-300 p-4">
        <h3 className="mb-2 text-xs font-bold uppercase text-zinc-700">{t("salariesPayroll.tableCash")}</h3>
        <table className="w-full border-collapse border border-zinc-300 text-xs">
          <thead>
            <tr className="bg-zinc-100">
              <th className="border border-zinc-300 px-2 py-1">{t("salariesPayroll.colCashCollected")}</th>
              <th className="border border-zinc-300 px-2 py-1">{t("salariesPayroll.colCashReceived")}</th>
              <th className="border border-zinc-300 px-2 py-1">{t("salariesPayroll.colCashDifference")}</th>
              <th className="border border-zinc-300 px-2 py-1">{t("salariesPayroll.colCashNote")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border border-zinc-300 px-2 py-1">{cashCollected != null ? formatAmount(cashCollected) : "—"}</td>
              <td className="border border-zinc-300 px-2 py-1">{cashReceived != null ? formatAmount(cashReceived) : "—"}</td>
              <td className="border border-zinc-300 px-2 py-1">
                {`${cashDiff < 0 ? "" : "+"}${formatAmount(Math.abs(cashDiff))}`}
              </td>
              <td className="border border-zinc-300 px-2 py-1 text-[11px]">
                {cashDiff < 0 ? t("salariesPayroll.cashDifferenceDeducted") : "—"}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="mt-4 grid gap-4 border border-zinc-300 p-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase text-zinc-700">{t("salariesPayroll.tableOtherDeductions")}</h3>
          <table className="w-full border-collapse border border-zinc-300 text-xs">
            <thead>
              <tr className="bg-zinc-100">
                <th className="border border-zinc-300 px-2 py-1">{t("salariesPayroll.colDedDate")}</th>
                <th className="border border-zinc-300 px-2 py-1">{t("salariesPayroll.colDedAmount")}</th>
                <th className="border border-zinc-300 px-2 py-1">{t("salariesPayroll.colDedType")}</th>
                <th className="border border-zinc-300 px-2 py-1">{t("salariesPayroll.colDedNotes")}</th>
              </tr>
            </thead>
            <tbody>
              {otherDedRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="border border-zinc-300 px-2 py-2 text-center text-zinc-500">
                    {t("salariesPayroll.noRows")}
                  </td>
                </tr>
              ) : (
                otherDedRows.map((r, i) => (
                  <tr key={i}>
                    <td className="border border-zinc-300 px-2 py-1">{r.date}</td>
                    <td className="border border-zinc-300 px-2 py-1">{r.amount}</td>
                    <td className="border border-zinc-300 px-2 py-1">{r.type}</td>
                    <td className="border border-zinc-300 px-2 py-1">{r.notes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div>
          <h3 className="mb-2 text-xs font-bold uppercase text-zinc-700">{t("salariesPayroll.tableTipsBonuses")}</h3>
          <table className="w-full border-collapse border border-zinc-300 text-xs">
            <thead>
              <tr className="bg-zinc-100">
                <th className="border border-zinc-300 px-2 py-1">{t("salariesPayroll.colTipDate")}</th>
                <th className="border border-zinc-300 px-2 py-1">{t("salariesPayroll.colTipAmount")}</th>
                <th className="border border-zinc-300 px-2 py-1">{t("salariesPayroll.colTipType")}</th>
              </tr>
            </thead>
            <tbody>
              {tipsRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="border border-zinc-300 px-2 py-2 text-center text-zinc-500">
                    {t("salariesPayroll.noRows")}
                  </td>
                </tr>
              ) : (
                tipsRows.map((r, i) => (
                  <tr key={i}>
                    <td className="border border-zinc-300 px-2 py-1">{r.date}</td>
                    <td className="border border-zinc-300 px-2 py-1">{r.amount}</td>
                    <td className="border border-zinc-300 px-2 py-1">{r.type}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-6 break-inside-avoid border border-zinc-300 p-4">
        <h2 className="border-b border-zinc-200 pb-2 text-sm font-bold uppercase tracking-wide text-zinc-800">
          {t("salariesPayroll.printSectionOperating")}
        </h2>
        <p className="mt-2 text-xs text-zinc-500">{t("salariesPayroll.help.tabOperating")}</p>
        <table className="mt-3 w-full border-collapse border border-zinc-300 text-sm">
          <tbody>
            <tr>
              <td className="border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-medium">{t("salariesPayroll.basicSalary")}</td>
              <td className="border border-zinc-200 px-2 py-1.5">{formatAmount(num(d.base_salary))}</td>
            </tr>
            <tr>
              <td className="border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-medium">{t("salariesPayroll.targetType")}</td>
              <td className="border border-zinc-200 px-2 py-1.5">{targetTypeLabel}</td>
            </tr>
            <tr>
              <td className="border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-medium">{t("salariesPayroll.targetValue")}</td>
              <td className="border border-zinc-200 px-2 py-1.5">
                {tt === "TARGET_TYPE_ORDERS"
                  ? String(d.employee?.monthly_orders_target ?? d.monthly_target)
                  : formatAmount(num(d.employee?.monthly_target_amount ?? d.monthly_target))}
              </td>
            </tr>
            <tr>
              <td className="border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-medium">{t("salariesPayroll.deductionMethod")}</td>
              <td className="border border-zinc-200 px-2 py-1.5">{dmLabel}</td>
            </tr>
            <tr>
              <td className="border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-medium">{t("salariesPayroll.operatingPlatform")}</td>
              <td className="border border-zinc-200 px-2 py-1.5">{platformLabelForPrint(d.employee?.assigned_platform, t)}</td>
            </tr>
            <tr>
              <td className="border border-zinc-200 bg-zinc-50 px-2 py-1.5 font-medium">{t("salariesPayroll.platformId")}</td>
              <td className="border border-zinc-200 px-2 py-1.5">{d.employee?.platform_user_no ?? "—"}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <footer className="mt-8 border-t border-zinc-200 pt-4 text-center text-[10px] text-zinc-500">
        {t("salariesPayroll.printSubtitle")} · {tApp("title")}
      </footer>
    </div>
  );
}

function EmployeePayrollDetailView({
  id,
  locale,
  month,
  onClose,
  onAddReceipt,
}: {
  id: string | null;
  locale: string;
  month: string;
  onClose: () => void;
  onAddReceipt: () => void;
}) {
  const t = useTranslations();
  const [tab, setTab] = useState<"salary" | "operating">("salary");
  const [printToBody, setPrintToBody] = useState(false);
  const { data, loading } = useSalariesPayrollDetail(id);

  useEffect(() => {
    setPrintToBody(true);
  }, []);

  const formatAmount = (v: number) =>
    v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const formatDay = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-SA" : undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  };

  if (loading) return <div className="py-8 text-center">{t("common.loading")}</div>;
  if (!data) return <div className="py-8 text-center">{t("common.noResults")}</div>;

  const d = data as SalariesPayrollDetailRow;
  const tt = d.employee?.target_type || "TARGET_TYPE_ORDERS";
  const details = d.calculation_details as Record<string, unknown> | null;
  const targetTypeLabel =
    tt === "TARGET_TYPE_REVENUE" ? t("employment.targetTypeRevenue") : t("employment.targetTypeOrders");

  const cf = details?.cashFromOperations as
    | { totalCashCollected?: number; totalCashReceived?: number; difference?: number }
    | undefined;
  const cashCollected = cf?.totalCashCollected;
  const cashReceived = cf?.totalCashReceived;
  const cashDiff = cf?.difference ?? num(d.total_unreceived_cash);

  const loanRowsRaw = details?.loanInstallmentRows as
    | { date: string; amount: number; status: string; note?: string }[]
    | undefined;
  const loanRows =
    loanRowsRaw && loanRowsRaw.length > 0
      ? loanRowsRaw.map((r) => ({
        date: formatDay(r.date),
        amount: formatAmount(num(r.amount)),
        status: r.status,
        note: r.note || "—",
      }))
      : num(d.scheduled_loan_installments) > 0
        ? [
          {
            date: month,
            amount: formatAmount(num(d.scheduled_loan_installments)),
            status: "—",
            note: t("salariesPayroll.scheduledLoans"),
          },
        ]
        : [];

  const opDed = (details?.operationsDeductionRows as { date: string; amount: number; type?: string; notes?: string }[]) ?? [];
  const otherDedRows = opDed.map((r) => ({
    date: formatDay(r.date),
    amount: formatAmount(num(r.amount)),
    type: t("salariesPayroll.deductionTypeDailyOps"),
    notes: r.notes || "—",
  }));

  const tipsRowsRaw = details?.tipsFromOperationsRows as { date: string; amount: number; type?: string }[] | undefined;
  const cfgBonus = num((details?.configBonuses as { amount?: number } | undefined)?.amount);
  const tipsRows: { date: string; amount: string; type: string }[] = [];
  if (tipsRowsRaw && tipsRowsRaw.length > 0) {
    for (const r of tipsRowsRaw) {
      tipsRows.push({
        date: formatDay(r.date),
        amount: formatAmount(num(r.amount)),
        type: t("salariesPayroll.tipTypeTip"),
      });
    }
  }
  if (cfgBonus > 0) {
    tipsRows.push({
      date: month,
      amount: formatAmount(cfgBonus),
      type: t("salariesPayroll.tipTypeConfigBonus"),
    });
  }

  const otherDedRowsDisplay =
    otherDedRows.length > 0
      ? otherDedRows
      : num(d.operations_deductions_total) > 0
        ? [
          {
            date: month,
            amount: formatAmount(num(d.operations_deductions_total)),
            type: t("salariesPayroll.deductionTypeDailyOps"),
            notes: "—",
          },
        ]
        : [];

  const tipsRowsDisplay =
    tipsRows.length > 0
      ? tipsRows
      : num(d.total_bonus) > 0
        ? [
          {
            date: month,
            amount: formatAmount(num(d.total_bonus)),
            type: t("salariesPayroll.tipTypeTip"),
          },
        ]
        : [];

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div className="print:hidden">
        <div id="payroll-detail-print-root" className="flex flex-col gap-4 px-3 pb-3 pt-2">
          <PayrollEmployeeInfoCard d={d} locale={locale} month={month} />

          <div className="flex w-full flex-wrap items-center gap-2 border-b border-zinc-200 dark:border-zinc-700">
            <div
              className={`inline-flex items-center gap-0.5 border-b-2 ${tab === "salary" ? "border-primary" : "border-transparent"}`}
            >
              <button
                type="button"
                onClick={() => setTab("salary")}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${tab === "salary"
                  ? "text-primary"
                  : "text-primary/60 hover:text-primary"
                  }`}
              >
                {t("salariesPayroll.tabSalaryInfo")}
              </button>
              <ModalHelpTip tip={t("salariesPayroll.help.tabSalary")} locale={locale} />
            </div>
            <div
              className={`inline-flex items-center gap-0.5 border-b-2 ${tab === "operating" ? "border-primary" : "border-transparent"}`}
            >
              <button
                type="button"
                onClick={() => setTab("operating")}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium ${tab === "operating"
                  ? "text-primary"
                  : "text-primary/60 hover:text-primary"
                  }`}
              >
                {t("salariesPayroll.tabOperatingInfo")}
              </button>
              <ModalHelpTip tip={t("salariesPayroll.help.tabOperating")} locale={locale} />
            </div>
          </div>

          <div className="min-w-0 w-full ">
            {tab === "salary" ? (
              <div className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
                    <div className="flex items-center justify-between gap-2 text-primary/60">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 shrink-0" />
                        <span className="text-xs font-medium uppercase">{t("salariesPayroll.workingDays")}</span>
                      </div>
                      <ModalHelpTip tip={t("salariesPayroll.help.workingDays")} locale={locale} />
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-primary">{d.working_days}</div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
                    <div className="flex items-center justify-between gap-2 text-primary/60">
                      <div className="flex items-center gap-2">
                        {tt === "TARGET_TYPE_REVENUE" ? (
                          <DollarSign className="h-4 w-4 shrink-0" />
                        ) : (
                          <BarChart3 className="h-4 w-4 shrink-0" />
                        )}
                        <span className="text-xs font-medium uppercase">
                          {tt === "TARGET_TYPE_REVENUE" ? t("salariesPayroll.totalRevenue") : t("salariesPayroll.ordersCount")}
                        </span>
                      </div>
                      <ModalHelpTip tip={t("salariesPayroll.help.ordersRevenue")} locale={locale} />
                    </div>
                    <div className="mt-2 text-2xl font-semibold text-primary">
                      {tt === "TARGET_TYPE_REVENUE" ? formatAmount(num(d.total_revenue)) : d.orders_count}
                    </div>
                  </div>
                  <div className="rounded-xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/50">
                    <div className="flex items-center justify-between gap-2 text-primary/60">
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 shrink-0" />
                        <span className="text-xs font-medium uppercase">{t("salariesPayroll.targetDiff")}</span>
                      </div>
                      <ModalHelpTip tip={t("salariesPayroll.help.targetDiff")} locale={locale} />
                    </div>
                    <div
                      className={`mt-2 text-2xl font-semibold ${d.target_difference >= 0 ? "text-emerald-600" : "text-red-600"
                        }`}
                    >
                      {tt === "TARGET_TYPE_REVENUE"
                        ? `${d.target_difference >= 0 ? "+" : ""}${formatAmount(Math.abs(d.target_difference))} ${t("employment.sar")}`
                        : `${d.target_difference >= 0 ? "+" : ""}${d.target_difference} ${t("salariesPayroll.ordersUnit")}`}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-2 dark:border-amber-900/40 dark:bg-amber-950/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold text-primary">{t("salariesPayroll.performanceDeductionCardTitle")}</div>
                    <ModalHelpTip tip={t("salariesPayroll.help.performanceDeduction")} locale={locale} />
                  </div>
                  <div className="mt-2 text-3xl font-bold text-red-700 dark:text-red-400">
                    {formatAmount(performanceDeduction(d))} {t("employment.sar")}
                  </div>
                  <PerformanceDeductionBreakdown d={d} formatAmount={formatAmount} />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <MiniTable
                    title={t("salariesPayroll.tableLoans")}
                    columns={[
                      { key: "date", label: t("salariesPayroll.colLoanDate") },
                      { key: "amount", label: t("salariesPayroll.colLoanAmount") },
                      { key: "status", label: t("salariesPayroll.colLoanStatus") },
                      { key: "note", label: t("salariesPayroll.colLoanNote") },
                    ]}
                    rows={loanRows}
                    emptyLabel={t("salariesPayroll.noRows")}
                    helpTip={t("salariesPayroll.help.tableLoans")}
                    locale={locale}
                  />
                  <MiniTable
                    title={t("salariesPayroll.tableCash")}
                    columns={[
                      { key: "collected", label: t("salariesPayroll.colCashCollected") },
                      { key: "received", label: t("salariesPayroll.colCashReceived") },
                      { key: "difference", label: t("salariesPayroll.colCashDifference") },
                      { key: "note", label: t("salariesPayroll.colCashNote") },
                    ]}
                    rows={[
                      {
                        collected:
                          cashCollected != null ? formatAmount(cashCollected) : "—",
                        received: cashReceived != null ? formatAmount(cashReceived) : "—",
                        difference: `${cashDiff < 0 ? "" : "+"}${formatAmount(Math.abs(cashDiff))}`,
                        note: cashDiff < 0 ? t("salariesPayroll.cashDifferenceDeducted") : "—",
                      },
                    ]}
                    emptyLabel={t("salariesPayroll.noRows")}
                    helpTip={t("salariesPayroll.help.tableCash")}
                    locale={locale}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <MiniTable
                    title={t("salariesPayroll.tableOtherDeductions")}
                    columns={[
                      { key: "date", label: t("salariesPayroll.colDedDate") },
                      { key: "amount", label: t("salariesPayroll.colDedAmount") },
                      { key: "type", label: t("salariesPayroll.colDedType") },
                      { key: "notes", label: t("salariesPayroll.colDedNotes") },
                    ]}
                    rows={otherDedRowsDisplay}
                    emptyLabel={t("salariesPayroll.noRows")}
                    helpTip={t("salariesPayroll.help.tableOtherDeductions")}
                    locale={locale}
                  />
                  <MiniTable
                    title={t("salariesPayroll.tableTipsBonuses")}
                    columns={[
                      { key: "date", label: t("salariesPayroll.colTipDate") },
                      { key: "amount", label: t("salariesPayroll.colTipAmount") },
                      { key: "type", label: t("salariesPayroll.colTipType") },
                    ]}
                    rows={tipsRowsDisplay}
                    emptyLabel={t("salariesPayroll.noRows")}
                    helpTip={t("salariesPayroll.help.tableTipsBonuses")}
                    locale={locale}
                  />
                </div>

                <div className="relative rounded-xl border-2 border-primary/30 bg-primary/5 px-4 py-5 text-center dark:bg-primary/10">
                  <div className={`absolute top-3 ${locale === "ar" ? "left-3" : "right-3"}`}>
                    <ModalHelpTip tip={t("salariesPayroll.help.finalSalary")} locale={locale} />
                  </div>
                  <div className="text-xs font-semibold uppercase text-primary/70">{t("salariesPayroll.finalSalary")}</div>
                  <div className="mt-1 text-3xl font-bold text-primary md:text-4xl">
                    {formatAmount(num(d.salary_after_deductions))} {t("employment.sar")}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="relative rounded-xl border border-zinc-200 bg-white p-4 pe-11 dark:border-zinc-700 dark:bg-zinc-900/50">
                  <div className={`absolute top-3 ${locale === "ar" ? "left-3" : "right-3"}`}>
                    <ModalHelpTip tip={t("salariesPayroll.help.operatingCard1")} locale={locale} />
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs uppercase text-primary/50">{t("salariesPayroll.basicSalary")}</span>
                      <span className="font-semibold text-primary">{formatAmount(num(d.base_salary))}</span>
                    </div>
                    <div className="flex flex-col gap-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                      <span className="text-xs uppercase text-primary/50">{t("salariesPayroll.targetType")}</span>
                      <span className="font-semibold text-primary">{targetTypeLabel}</span>
                    </div>
                  </div>
                </div>
                <div className="relative rounded-xl border border-zinc-200 bg-white p-4 pe-11 dark:border-zinc-700 dark:bg-zinc-900/50">
                  <div className={`absolute top-3 ${locale === "ar" ? "left-3" : "right-3"}`}>
                    <ModalHelpTip tip={t("salariesPayroll.help.operatingCard2")} locale={locale} />
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs uppercase text-primary/50">{t("salariesPayroll.targetValue")}</span>
                      <span className="font-semibold text-primary">
                        {tt === "TARGET_TYPE_ORDERS"
                          ? String(d.employee?.monthly_orders_target ?? d.monthly_target)
                          : formatAmount(num(d.employee?.monthly_target_amount ?? d.monthly_target))}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                      <span className="text-xs uppercase text-primary/50">{t("salariesPayroll.deductionMethod")}</span>
                      <span className="font-semibold text-primary">
                        {t(`salariesPayroll.deduction_${d.deduction_method}` as "salariesPayroll.deduction_DEDUCTION_FIXED")}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="relative rounded-xl border border-zinc-200 bg-white p-4 pe-11 dark:border-zinc-700 dark:bg-zinc-900/50">
                  <div className={`absolute top-3 ${locale === "ar" ? "left-3" : "right-3"}`}>
                    <ModalHelpTip tip={t("salariesPayroll.help.operatingCard3")} locale={locale} />
                  </div>
                  <div className="space-y-3 text-sm">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs uppercase text-primary/50">{t("salariesPayroll.operatingPlatform")}</span>
                      {d.employee?.assigned_platform ? (
                        <PlatformIcon platform={d.employee.assigned_platform} />
                      ) : (
                        <span className="font-semibold">—</span>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                      <span className="text-xs uppercase text-primary/50">{t("salariesPayroll.platformId")}</span>
                      <span className="font-semibold text-primary">{d.employee?.platform_user_no ?? "—"}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div
            className={`mt-2 flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700 ${locale === "ar" ? "justify-start" : "justify-end"
              }`}
          >
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-primary shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              <Printer className="h-4 w-4 shrink-0" />
              {t("common.print")}
            </button>
            {d.status === "NOT_PAID" && (
              <button
                type="button"
                onClick={onAddReceipt}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary shadow-sm transition hover:bg-primary/15 dark:border-primary/40 dark:bg-primary/15"
              >
                <Receipt className="h-4 w-4 shrink-0" />
                {t("salariesPayroll.addReceipt")}
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-primary shadow-sm transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              <X className="h-4 w-4 shrink-0" />
              {t("common.close")}
            </button>
          </div>

        </div>
      </div>

      {printToBody
        ? createPortal(
            <PayrollEnterprisePrintView
              d={d}
              month={month}
              locale={locale}
              tt={tt}
              targetTypeLabel={targetTypeLabel}
              formatAmount={formatAmount}
              loanRows={loanRows}
              otherDedRows={otherDedRowsDisplay}
              tipsRows={tipsRowsDisplay}
              cashCollected={cashCollected}
              cashReceived={cashReceived}
              cashDiff={cashDiff}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function AddReceiptForm({
  id,
  locale,
  month,
  onSave,
  onCancel,
}: {
  id: string | null;
  locale: string;
  month: string;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations();
  const { data: employee, loading: detailLoading } = useSalariesPayrollDetail(id);
  const { createReceipt, loading, error } = useCreateSalaryReceipt();

  const [amount, setAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"BANK_TRANSFER" | "CASH" | "OTHER">("BANK_TRANSFER");
  const [paymentDate, setPaymentDate] = useState(() => defaultPaymentDateInMonth(month));
  const [attachmentFileId, setAttachmentFileId] = useState<string | null>(null);
  const [differenceProcessing, setDifferenceProcessing] = useState<
    "DEFERRAL_TO_NEXT_MONTH" | "ADMIN_EXEMPTION" | "MANUAL" | ""
  >("");
  const [differenceManualDetail, setDifferenceManualDetail] = useState("");
  const [notes, setNotes] = useState("");

  const { minDate, maxDate } = monthDateBounds(month);

  useEffect(() => {
    if (employee) {
      setAmount(num(employee.salary_after_deductions));
    }
  }, [employee]);

  useEffect(() => {
    setPaymentDate((prev) => {
      if (prev >= minDate && prev <= maxDate) return prev;
      return defaultPaymentDateInMonth(month);
    });
  }, [month, minDate, maxDate]);

  const finalSal = employee ? num(employee.salary_after_deductions) : 0;
  const needsDiff = finalSal < 0 || Math.abs(amount - finalSal) > 0.009;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !employee) return;
    if (paymentDate < minDate || paymentDate > maxDate) return;
    try {
      await createReceipt(id, {
        amount,
        paymentMethod,
        paymentDate,
        attachmentUrl: attachmentFileId ?? undefined,
        differenceProcessing: needsDiff ? differenceProcessing || undefined : undefined,
        differenceManualDetail:
          needsDiff && differenceProcessing === "MANUAL" ? differenceManualDetail : undefined,
        notes: notes.trim() || undefined,
      });
      onSave();
    } catch {
      /* hook sets error */
    }
  };

  if (detailLoading || !employee) {
    return <div className="py-8 text-center">{t("common.loading")}</div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-2">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">{error}</div>
      )}

      <PayrollEmployeeInfoCard
        d={employee as SalariesPayrollDetailRow}
        locale={locale}
        month={month}
        showFinalSalary
      />

      <div className="space-y-1">
        <label className="text-sm font-medium text-primary">{t("salariesPayroll.receiptAmount")}</label>
        <input
          required
          type="number"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm shadow-sm [appearance:textfield] dark:border-zinc-700 dark:bg-zinc-900 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>

      {needsDiff && (
        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3 dark:border-amber-800 dark:bg-amber-950/20">
          <label className="text-sm font-medium text-primary">{t("salariesPayroll.differenceProcessing")}</label>
          <select
            required={needsDiff}
            value={differenceProcessing}
            onChange={(e) =>
              setDifferenceProcessing(
                e.target.value as "DEFERRAL_TO_NEXT_MONTH" | "ADMIN_EXEMPTION" | "MANUAL" | "",
              )
            }
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">{t("salariesPayroll.selectDifferenceProcessing")}</option>
            <option value="DEFERRAL_TO_NEXT_MONTH">{t("salariesPayroll.diff_deferral")}</option>
            <option value="ADMIN_EXEMPTION">{t("salariesPayroll.diff_admin_exemption")}</option>
            <option value="MANUAL">{t("salariesPayroll.diff_manual")}</option>
          </select>
          {differenceProcessing === "MANUAL" && (
            <textarea
              required
              value={differenceManualDetail}
              onChange={(e) => setDifferenceManualDetail(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              placeholder={t("salariesPayroll.differenceManualPlaceholder")}
            />
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-primary">{t("salariesPayroll.paymentMethod")}</label>
          <select
            required
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="BANK_TRANSFER">{t("salariesPayroll.method_BANK_TRANSFER")}</option>
            <option value="CASH">{t("salariesPayroll.method_CASH")}</option>
            <option value="OTHER">{t("salariesPayroll.method_OTHER")}</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-primary">{t("salariesPayroll.paymentDate")}</label>
          <p className="text-xs text-primary/50">{t("salariesPayroll.paymentDateMonthOnlyHint", { month })}</p>
          <input
            required
            type="date"
            min={minDate}
            max={maxDate}
            value={paymentDate}
            onChange={(e) => {
              const v = e.target.value;
              if (v >= minDate && v <= maxDate) setPaymentDate(v);
            }}
            className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-primary">{t("salariesPayroll.receiptAttachment")}</span>
        <FileUpload
          purpose_code="PAYROLL_SALARY_RECEIPT"
          label={t("salariesPayroll.receiptAttachment")}
          fileId={attachmentFileId}
          onFileIdChange={setAttachmentFileId}
          accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
          variant="iconButton"
          maxSizeBytes={5 * 1024 * 1024}
        />
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-primary">{t("salariesPayroll.receiptNotes")}</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} disabled={loading} className="px-4 py-2 text-sm text-primary/60">
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={loading || (needsDiff && !differenceProcessing)}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? t("common.saving") : t("salariesPayroll.saveReceipt")}
        </button>
      </div>
    </form>
  );
}
