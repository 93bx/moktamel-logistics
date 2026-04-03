"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Modal } from "./Modal";
import { InfoTooltip } from "./InfoTooltip";
import { PayrollConfigCostsTab } from "./PayrollConfigCostsTab";
import Tooltip from "@mui/material/Tooltip";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import {
  ChevronDown,
  ChevronUp,
  Settings,
  DollarSign,
  TrendingDown,
  TrendingUp,
  CheckCircle,
  AlertCircle,
  Info,
  Pencil,
  Check,
  X,
} from "lucide-react";

type DeductionTier = {
  from: number;
  to: number;
  deduction: number;
};

type PayrollConfigData = {
  minimum_salary?: number | null;
  tip_recipient?: string | null;
  count_bonus_enabled?: boolean | null;
  count_bonus_amount?: number | null;
  revenue_bonus_enabled?: boolean | null;
  revenue_bonus_amount?: number | null;
  deduction_per_order?: number | null;
  orders_deduction_tiers?: DeductionTier[] | null;
  revenue_deduction_tiers?: DeductionTier[] | null;
  revenue_unit_amount?: number | null;
  metadata?: {
    source?: string;
    isReadOnly?: boolean;
    runLockedForMonth?: boolean;
    currentMonthLocked?: boolean;
    warningAppliesNextMonth?: boolean;
    daysUntilMonthEnd?: number;
    payrollApprovalDeadlineWarning?: boolean;
    configurationStatus?: {
      general: "COMPLETE" | "INCOMPLETE";
      fixed: "COMPLETE" | "INCOMPLETE";
      ordersTiers: "COMPLETE" | "INCOMPLETE";
      revenueTiers: "COMPLETE" | "INCOMPLETE";
    };
  };
};

type PayrollStatsData = {
  activeEmployees: number;
  totalCosts: number;
  averageCost: number;
};

type PayrollConfigPageClientProps = {
  locale: string;
  initialConfig: PayrollConfigData;
  initialStats: PayrollStatsData;
  initialYear: number;
  initialMonth: number;
};

const ORDERS_TIER_RANGES = [
  { from: 1, to: 50 },
  { from: 51, to: 100 },
  { from: 101, to: 150 },
  { from: 151, to: 200 },
  { from: 201, to: 250 },
];

function normalizeOrdersTiers(tiers: DeductionTier[] | null | undefined): DeductionTier[] {
  return ORDERS_TIER_RANGES.map((range, i) => ({
    ...range,
    deduction: tiers?.[i]?.deduction ?? 0,
  }));
}

const REVENUE_TIER_COUNT = 9;

function normalizeRevenueTiers(
  tiers: DeductionTier[] | null | undefined,
  unitAmount: number,
): DeductionTier[] {
  if (!unitAmount || unitAmount <= 0) {
    return [];
  }
  return Array.from({ length: REVENUE_TIER_COUNT }, (_, i) => ({
    from: i * unitAmount + 1,
    to: (i + 1) * unitAmount,
    deduction: tiers?.[i]?.deduction ?? 0,
  }));
}

function filterPositiveDecimalRaw(raw: string): string {
  let s = raw.replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) {
    s = s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
  }
  return s;
}

function parseOptionalPositiveNumber(s: string): number | null {
  if (s === "" || s === ".") return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

function computeProgressiveTotal(deficit: number, tiers: DeductionTier[]): number {
  if (deficit <= 0 || tiers.length === 0) return 0;
  let remaining = deficit;
  let total = 0;
  for (const tier of tiers) {
    if (remaining <= 0) break;
    const width = tier.to - tier.from + 1;
    const take = Math.min(remaining, width);
    total += take * tier.deduction;
    remaining -= take;
  }
  if (remaining > 0 && tiers.length > 0) {
    const last = tiers[tiers.length - 1];
    total += remaining * last.deduction;
  }
  return total;
}

type ProgressiveLine =
  | { kind: "tier"; from: number; to: number; take: number; rate: number; subtotal: number }
  | { kind: "beyond"; take: number; rate: number; subtotal: number };

function computeProgressiveBreakdown(deficit: number, tiers: DeductionTier[]): ProgressiveLine[] {
  if (deficit <= 0 || tiers.length === 0) return [];
  let remaining = deficit;
  const lines: ProgressiveLine[] = [];
  for (const tier of tiers) {
    if (remaining <= 0) break;
    const width = tier.to - tier.from + 1;
    const take = Math.min(remaining, width);
    const subtotal = take * tier.deduction;
    lines.push({
      kind: "tier",
      from: tier.from,
      to: tier.to,
      take,
      rate: tier.deduction,
      subtotal,
    });
    remaining -= take;
  }
  if (remaining > 0 && tiers.length > 0) {
    const last = tiers[tiers.length - 1];
    lines.push({
      kind: "beyond",
      take: remaining,
      rate: last.deduction,
      subtotal: remaining * last.deduction,
    });
  }
  return lines;
}

type RevenueFlatBandLine = {
  from: number;
  to: number;
  flat: number;
  consumed: number;
  beyondDefined: boolean;
  bandWidth: number;
};

/** Matches backend: one flat SAR charge per deficit band crossed (then last tier flat per unit slice). */
function computeRevenueFlatBandLines(
  deficit: number,
  tiers: DeductionTier[],
  unitAmount: number,
): { total: number; lines: RevenueFlatBandLine[] } {
  if (deficit <= 0 || tiers.length === 0 || unitAmount <= 0) {
    return { total: 0, lines: [] };
  }
  let remaining = deficit;
  let total = 0;
  const lines: RevenueFlatBandLine[] = [];
  let tierIdx = 0;

  while (remaining > 0) {
    const tier = tierIdx < tiers.length ? tiers[tierIdx] : tiers[tiers.length - 1];
    const bandWidth =
      tierIdx < tiers.length ? tier.to - tier.from + 1 : unitAmount;
    const consumed = Math.min(remaining, bandWidth);

    total += tier.deduction;
    lines.push({
      from: tier.from,
      to: tier.to,
      flat: tier.deduction,
      consumed,
      beyondDefined: tierIdx >= tiers.length,
      bandWidth,
    });

    remaining -= consumed;
    tierIdx++;
  }

  return { total, lines };
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="text-sm text-primary/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-primary">{value}</div>
    </div>
  );
}

function PositiveDecimalField({
  value,
  onChange,
  disabled,
  className,
  suffix,
  dir,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  disabled?: boolean;
  className?: string;
  suffix?: string;
  dir?: "ltr" | "rtl";
}) {
  const [text, setText] = useState(() =>
    value != null && Number.isFinite(value) ? String(value) : "",
  );

  const displayValue = disabled
    ? value != null && Number.isFinite(value)
      ? String(value)
      : ""
    : text;

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`} dir={dir}>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        disabled={disabled}
        value={displayValue}
        onChange={(e) => {
          const next = filterPositiveDecimalRaw(e.target.value);
          setText(next);
          onChange(parseOptionalPositiveNumber(next));
        }}
        onBlur={() => {
          const n = parseOptionalPositiveNumber(text);
          if (n == null) setText("");
          else setText(String(n));
        }}
        className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 disabled:bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-900"
      />
      {suffix ? <span className="shrink-0 text-xs text-zinc-500">{suffix}</span> : null}
    </div>
  );
}

function CollapsibleCard({
  title,
  description,
  icon: Icon,
  isConfigured,
  incompleteHint,
  isOpen,
  onToggle,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  isReadOnly,
  rootClassName = "",
  children,
}: {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isConfigured: boolean;
  incompleteHint: string;
  isOpen: boolean;
  onToggle: () => void;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  isReadOnly: boolean;
  rootClassName?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations();

  return (
    <div
      className={`rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800 ${rootClassName}`}
    >
      <div className="flex shrink-0 flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Icon className="h-5 w-5 shrink-0 text-primary" />
            <h3 className="font-semibold text-primary">{title}</h3>
            {isConfigured ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                {t("payrollConfig.configured")}
              </span>
            ) : (
              <Tooltip title={incompleteHint} arrow enterDelay={200}>
                <span className="inline-flex cursor-help items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  !
                </span>
              </Tooltip>
            )}
          </div>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
          {!isReadOnly && (
            <>
              {isEditing ? (
                <>
                  <button
                    type="button"
                    onClick={onCancel}
                    title={t("payrollConfig.ariaCancelEdit")}
                    aria-label={t("payrollConfig.ariaCancelEdit")}
                    className="rounded-md p-2 text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={onSave}
                    title={t("payrollConfig.ariaSaveCard")}
                    aria-label={t("payrollConfig.ariaSaveCard")}
                    className="rounded-md p-2 text-white bg-primary hover:bg-primary/90"
                  >
                    <Check className="h-5 w-5" />
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={onEdit}
                  title={t("payrollConfig.ariaEditCard")}
                  aria-label={t("payrollConfig.ariaEditCard")}
                  className="rounded-md border border-primary p-2 text-primary hover:bg-primary/5"
                >
                  <Pencil className="h-5 w-5" />
                </button>
              )}
            </>
          )}
          <button
            type="button"
            onClick={onToggle}
            title={t("payrollConfig.ariaToggleCard")}
            aria-label={t("payrollConfig.ariaToggleCard")}
            className="rounded-md p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700"
          >
            {isOpen ? (
              <ChevronUp className="h-5 w-5 text-primary" />
            ) : (
              <ChevronDown className="h-5 w-5 text-primary" />
            )}
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="min-h-0 flex-1 border-t border-zinc-200 p-4 dark:border-zinc-700">{children}</div>
      )}
    </div>
  );
}

export function PayrollConfigPageClient({
  locale,
  initialConfig,
  initialStats,
  initialYear,
  initialMonth,
}: PayrollConfigPageClientProps) {
  const t = useTranslations();
  const tDashboard = useTranslations("dashboard");
  const router = useRouter();

  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [config, setConfig] = useState<PayrollConfigData>(initialConfig);
  const [stats, setStats] = useState<{
    activeEmployees: number;
    totalCosts: number;
    averageCost: number;
  }>(initialStats);
  const [activeTab, setActiveTab] = useState<"payroll" | "costs">("payroll");

  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  // Card states
  const [openCards, setOpenCards] = useState({
    general: false,
    fixed: false,
    orders: false,
    revenue: false,
  });
  const [editingCards, setEditingCards] = useState({
    general: false,
    fixed: false,
    orders: false,
    revenue: false,
  });

  // Edit state
  const [editData, setEditData] = useState<Partial<PayrollConfigData>>({});
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);

  // Month picker
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const years = useMemo(() => {
    const y = [];
    for (let i = currentYear - 2; i <= currentYear + 1; i++) {
      y.push(i);
    }
    return y;
  }, [currentYear]);

  const visibleMonths = useMemo(() => {
    if (year < currentYear) return Array.from({ length: 12 }, (_, i) => i + 1);
    if (year === currentYear) return Array.from({ length: currentMonth }, (_, i) => i + 1);
    return [];
  }, [year, currentYear, currentMonth]);

  useEffect(() => {
    setStats(initialStats);
  }, [initialStats]);

  useEffect(() => {
    if (activeTab !== "costs") return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/payroll-config/stats?year=${year}&month=${month}`,
          { cache: "no-store" },
        );
        if (!cancelled && res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch {
        /* keep previous stats */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, year, month]);

  const pushToast = useCallback((message: string, severity: "success" | "error") => {
    setSnackbar({ open: true, message, severity });
  }, []);

  const refreshConfig = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/payroll-config/config?year=${year}&month=${month}`,
        { cache: "no-store" },
      );
      if (res.ok) {
        const full = (await res.json()) as PayrollConfigData;
        setConfig(full);
      }
    } catch {
      /* ignore */
    }
  }, [year, month]);

  const handleMonthChange = useCallback((newYear: number, newMonth: number) => {
    router.push(`/${locale}/payroll-config?year=${newYear}&month=${newMonth}`);
  }, [locale, router]);

  const handleApprove = useCallback(async () => {
    setApproving(true);
    try {
      const res = await fetch("/api/payroll-config/approve-month", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, month }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        throw new Error(errBody?.message ?? t("payrollConfig.toastApproveError"));
      }

      const monthLabel = `${year}-${String(month).padStart(2, "0")}`;
      pushToast(t("payrollConfig.toastApproveSuccess", { month: monthLabel }), "success");
      await refreshConfig();
      router.refresh();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : t("payrollConfig.toastApproveError"), "error");
    } finally {
      setApproving(false);
      setShowApproveDialog(false);
    }
  }, [year, month, t, router, pushToast, refreshConfig]);

  const buildPatchPayload = useCallback(
    (cardName: string): Record<string, unknown> => {
      switch (cardName) {
        case "general": {
          const countOn = editData.count_bonus_enabled ?? false;
          const revOn = editData.revenue_bonus_enabled ?? false;
          return {
            minimum_salary: editData.minimum_salary ?? null,
            tip_recipient: editData.tip_recipient ?? "REPRESENTATIVE",
            count_bonus_enabled: countOn,
            count_bonus_amount: countOn ? editData.count_bonus_amount ?? null : null,
            revenue_bonus_enabled: revOn,
            revenue_bonus_amount: revOn ? editData.revenue_bonus_amount ?? null : null,
          };
        }
        case "fixed":
          return { deduction_per_order: editData.deduction_per_order ?? null };
        case "orders":
          return {
            orders_deduction_tiers: normalizeOrdersTiers(editData.orders_deduction_tiers),
          };
        case "revenue": {
          const unit = editData.revenue_unit_amount;
          if (unit == null || unit <= 0) {
            return { revenue_unit_amount: null, revenue_deduction_tiers: null };
          }
          return {
            revenue_unit_amount: unit,
            revenue_deduction_tiers: normalizeRevenueTiers(editData.revenue_deduction_tiers, unit),
          };
        }
        default:
          return {};
      }
    },
    [editData],
  );

  const handleSaveCard = useCallback(
    async (cardName: string) => {
      try {
        const payload = buildPatchPayload(cardName);
        const res = await fetch("/api/payroll-config/config", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const errBody = await res.json().catch(() => null);
          throw new Error(errBody?.message ?? "Save failed");
        }

        await res.json();
        await refreshConfig();
        setEditingCards((prev) => ({ ...prev, [cardName]: false }));
        setEditData({});
        setShowSaveDialog(null);
        pushToast(t("payrollConfig.toastSaveSuccess"), "success");
        router.refresh();
      } catch (error) {
        const msg = error instanceof Error ? error.message : t("payrollConfig.toastSaveError");
        pushToast(msg, "error");
      }
    },
    [buildPatchPayload, t, router, refreshConfig, pushToast],
  );

  const startEdit = (cardName: keyof typeof editingCards) => {
    setOpenCards((prev) => ({ ...prev, [cardName]: true }));
    setEditingCards((prev) => ({ ...prev, [cardName]: true }));
    if (cardName === "general") {
      setEditData({
        minimum_salary: config.minimum_salary,
        tip_recipient: config.tip_recipient ?? "REPRESENTATIVE",
        count_bonus_enabled: config.count_bonus_enabled ?? false,
        count_bonus_amount: config.count_bonus_amount,
        revenue_bonus_enabled: config.revenue_bonus_enabled ?? false,
        revenue_bonus_amount: config.revenue_bonus_amount,
      });
    } else if (cardName === "fixed") {
      setEditData({ deduction_per_order: config.deduction_per_order });
    } else if (cardName === "orders") {
      setEditData({
        orders_deduction_tiers: normalizeOrdersTiers(config.orders_deduction_tiers),
      });
    } else if (cardName === "revenue") {
      const unit = config.revenue_unit_amount ?? 0;
      setEditData({
        revenue_unit_amount: config.revenue_unit_amount,
        revenue_deduction_tiers: normalizeRevenueTiers(config.revenue_deduction_tiers, unit),
      });
    }
  };

  const cancelEdit = (cardName: keyof typeof editingCards) => {
    setEditingCards((prev) => ({ ...prev, [cardName]: false }));
    setEditData({});
  };

  const isReadOnly = config.metadata?.isReadOnly || false;
  const configStatus = config.metadata?.configurationStatus;
  const canApprove = configStatus?.general === "COMPLETE" &&
    configStatus?.fixed === "COMPLETE" &&
    configStatus?.ordersTiers === "COMPLETE" &&
    configStatus?.revenueTiers === "COMPLETE";

  const getMissingConfig = () => {
    const missing = [];
    if (configStatus?.general !== "COMPLETE") missing.push(t("payrollConfig.generalSettings"));
    if (configStatus?.fixed !== "COMPLETE") missing.push(t("payrollConfig.fixedDeduction"));
    if (configStatus?.ordersTiers !== "COMPLETE") missing.push(t("payrollConfig.ordersDeductionTiersLabel"));
    if (configStatus?.revenueTiers !== "COMPLETE") missing.push(t("payrollConfig.revenueDeductionTiersLabel"));
    return missing;
  };

  const suffixSar = t("payrollConfig.suffixSar");
  const suffixOrders = t("payrollConfig.suffixOrders");
  const numDir: "ltr" | "rtl" = locale === "ar" ? "rtl" : "ltr";
  const incompleteHint = t("payrollConfig.badgeIncompleteHelp");

  const fixedRateForExample =
    editingCards.fixed ? editData.deduction_per_order : config.deduction_per_order;
  const exampleMissingOrders = 12;
  const fixedExampleTotal =
    fixedRateForExample != null && fixedRateForExample > 0
      ? exampleMissingOrders * fixedRateForExample
      : 0;

  const ordersTiersForExample = normalizeOrdersTiers(
    editingCards.orders ? editData.orders_deduction_tiers : config.orders_deduction_tiers,
  );
  const ordersDeficitExample = 165;
  const ordersExampleTotal = computeProgressiveTotal(ordersDeficitExample, ordersTiersForExample);

  const revenueUnitForExample =
    (editingCards.revenue ? editData.revenue_unit_amount : config.revenue_unit_amount) || 800;
  const revenueTiersForExample = normalizeRevenueTiers(
    editingCards.revenue ? editData.revenue_deduction_tiers : config.revenue_deduction_tiers,
    revenueUnitForExample,
  );
  const revenueDeficitExample = 3000;
  const revenueFlatExample = computeRevenueFlatBandLines(
    revenueDeficitExample,
    revenueTiersForExample,
    revenueUnitForExample,
  );
  const revenueExampleTotal = revenueFlatExample.total;

  const ordersExampleBreakdown = computeProgressiveBreakdown(
    ordersDeficitExample,
    ordersTiersForExample,
  );

  const fmtNum = (n: number) =>
    n.toLocaleString(locale === "ar" ? "ar-SA" : "en-US", { maximumFractionDigits: 2 });

  const formatMoney = (v: number) =>
    v.toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
        <nav
          className="flex flex-col divide-y divide-red-800 dark:divide-zinc-700 sm:flex-row sm:divide-x sm:divide-y-0"
          role="tablist"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "payroll"}
            onClick={() => setActiveTab("payroll")}
            className={`flex flex-1 flex-col items-stretch hover:bg-primary/40 px-4 py-3 transition ${activeTab === "payroll"
              ? "bg-primary/20 sm:border-b-2 sm:border-primary"
              : " dark:hover:bg-zinc-900/50 sm:border-b-2 sm:border-transparent"
              }`}
          >
            <span className="text-lg font-bold text-primary">
              {t("payrollConfig.tabPayrollManagement")}
            </span>
            <span className="mt-1 text-sm font-semibold leading-snug text-zinc-500 dark:text-zinc-400">
              {t("payrollConfig.tabDescPayroll")}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "costs"}
            onClick={() => setActiveTab("costs")}
            className={`flex flex-1 flex-col items-stretch hover:bg-primary/40 px-4 py-3 transition ${activeTab === "costs"
              ? "bg-primary/20 sm:border-b-2 sm:border-primary"
              : " dark:hover:bg-zinc-900/50 sm:border-b-2 sm:border-transparent"
              }`}
          >
            <span className="text-lg font-bold text-primary">
              {t("payrollConfig.tabCostsManagement")}
            </span>
            <span className="mt-1 text-sm font-semibold leading-snug text-zinc-500 dark:text-zinc-400">
              {t("payrollConfig.tabDescCosts")}
            </span>
          </button>
        </nav>
      </div>

      {activeTab === "payroll" ? (
        <>
          {/* Month picker + legal info + status (single card) */}
          <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-primary">{tDashboard("controls.year")}</label>
                <select
                  value={year}
                  onChange={(e) => {
                    const newYear = Number(e.target.value);
                    setYear(newYear);
                    handleMonthChange(newYear, month);
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
                    onClick={() => {
                      setMonth(m);
                      handleMonthChange(year, m);
                    }}
                    className={`min-w-[3.5rem] rounded-xl px-3 py-2 text-sm font-semibold transition-all ${month === m
                      ? "bg-primary-600 text-white shadow-md"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-zinc-700 dark:text-slate-300"
                      }`}
                  >
                    {tDashboard(`controls.month${m}` as "controls.month1")}
                  </button>
                ))}
              </div>
              {!isReadOnly && !config.metadata?.runLockedForMonth && (
                <button
                  onClick={() => setShowApproveDialog(true)}
                  disabled={!canApprove}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:bg-zinc-300 disabled:cursor-not-allowed"
                >
                  {t("payrollConfig.approve")}
                </button>
              )}
            </div>

            <div className="border-t border-zinc-200 pt-4 dark:border-zinc-600">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    <Info className="inline h-4 w-4 mr-1" />
                    {t("payrollConfig.infoLegalText")}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  {canApprove ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <CheckCircle className="h-4 w-4" />
                      {t("payrollConfig.configStatusAllComplete")}
                    </span>
                  ) : (
                    <span
                      className="flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 cursor-help"
                      title={t("payrollConfig.configStatusMissingDetails", { items: getMissingConfig().join(", ") })}
                    >
                      <AlertCircle className="h-4 w-4" />
                      {t("payrollConfig.configStatusMissing")}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {config.metadata?.payrollApprovalDeadlineWarning &&
              config.metadata?.daysUntilMonthEnd != null && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                    <p>
                      {t("payrollConfig.payrollApprovalDeadlineWarning", {
                        days: config.metadata.daysUntilMonthEnd,
                      })}
                    </p>
                  </div>
                </div>
              )}

            {config.metadata?.warningAppliesNextMonth && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <p>{t("payrollConfig.warningAppliesNextMonth")}</p>
                </div>
              </div>
            )}
          </div>

          {/* Cards: general + fixed side by side on large screens */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
            {/* General Settings Card */}
            <CollapsibleCard
              rootClassName="h-full min-h-0 flex flex-col"
              title={t("payrollConfig.generalSettings")}
              description={t("payrollConfig.generalSettingsDesc")}
              icon={Settings}
              isConfigured={configStatus?.general === "COMPLETE"}
              incompleteHint={incompleteHint}
              isOpen={openCards.general}
              onToggle={() => setOpenCards({ ...openCards, general: !openCards.general })}
              isEditing={editingCards.general}
              onEdit={() => startEdit("general")}
              onSave={() => setShowSaveDialog("general")}
              onCancel={() => cancelEdit("general")}
              isReadOnly={isReadOnly}
            >
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-md border border-zinc-100 p-3 dark:border-zinc-700/80">
                  <h4 className="mb-2 flex items-center gap-2 font-medium text-primary">
                    {t("payrollConfig.sectionGeneral")}
                    <InfoTooltip content={t("payrollConfig.helpMinimumSalary")} />
                  </h4>
                  <label className="text-sm text-zinc-600 dark:text-zinc-400">{t("payrollConfig.minimumSalary")}</label>
                  <PositiveDecimalField
                    key={`min-sal-${editingCards.general}`}
                    className="mt-1"
                    dir={numDir}
                    suffix={suffixSar}
                    disabled={!editingCards.general}
                    value={editingCards.general ? editData.minimum_salary : config.minimum_salary}
                    onChange={(v) => setEditData((prev) => ({ ...prev, minimum_salary: v ?? undefined }))}
                  />
                </div>

                <div className="rounded-md border border-zinc-100 p-3 dark:border-zinc-700/80">
                  <h4 className="mb-2 flex items-center gap-2 font-medium text-primary">
                    {t("payrollConfig.sectionTips")}
                    <InfoTooltip content={t("payrollConfig.helpTipRecipient")} />
                  </h4>
                  <label className="text-sm text-zinc-600 dark:text-zinc-400">{t("payrollConfig.tipRecipient")}</label>
                  <div className="mt-2 space-y-2">
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        value="REPRESENTATIVE"
                        checked={
                          (editingCards.general ? editData.tip_recipient : config.tip_recipient) ===
                          "REPRESENTATIVE"
                        }
                        onChange={(e) => setEditData({ ...editData, tip_recipient: e.target.value })}
                        disabled={!editingCards.general}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">{t("payrollConfig.tipRecipientRepresentative")}</div>
                        <div className="text-xs text-zinc-600">{t("payrollConfig.tipRecipientRepresentativeDesc")}</div>
                      </div>
                    </label>
                    <label className="flex items-start gap-2">
                      <input
                        type="radio"
                        value="COMPANY"
                        checked={
                          (editingCards.general ? editData.tip_recipient : config.tip_recipient) === "COMPANY"
                        }
                        onChange={(e) => setEditData({ ...editData, tip_recipient: e.target.value })}
                        disabled={!editingCards.general}
                        className="mt-1"
                      />
                      <div>
                        <div className="font-medium">{t("payrollConfig.tipRecipientCompany")}</div>
                        <div className="text-xs text-zinc-600">{t("payrollConfig.tipRecipientCompanyDesc")}</div>
                      </div>
                    </label>
                  </div>
                </div>

                <div className="rounded-md border border-zinc-100 p-3 dark:border-zinc-700/80">
                  <h4 className="mb-2 flex items-center gap-2 font-medium text-primary">
                    {t("payrollConfig.sectionCountBonus")}
                    <InfoTooltip content={t("payrollConfig.helpCountBonus")} />
                  </h4>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        editingCards.general ? !!editData.count_bonus_enabled : !!config.count_bonus_enabled
                      }
                      onChange={(e) => setEditData({ ...editData, count_bonus_enabled: e.target.checked })}
                      disabled={!editingCards.general}
                    />
                    <span className="text-sm">{t("payrollConfig.countBonusEnabled")}</span>
                  </label>
                  {(editingCards.general ? editData.count_bonus_enabled : config.count_bonus_enabled) && (
                    <div className="mt-2">
                      <label className="text-xs text-zinc-600">{t("payrollConfig.countBonusAmount")}</label>
                      <PositiveDecimalField
                        key={`cnt-bonus-${editingCards.general}`}
                        className="mt-1"
                        dir={numDir}
                        suffix={suffixSar}
                        disabled={!editingCards.general}
                        value={editingCards.general ? editData.count_bonus_amount : config.count_bonus_amount}
                        onChange={(v) => setEditData((prev) => ({ ...prev, count_bonus_amount: v ?? undefined }))}
                      />
                    </div>
                  )}
                </div>

                <div className="rounded-md border border-zinc-100 p-3 dark:border-zinc-700/80">
                  <h4 className="mb-2 flex items-center gap-2 font-medium text-primary">
                    {t("payrollConfig.sectionRevenueBonus")}
                    <InfoTooltip content={t("payrollConfig.helpRevenueBonus")} />
                  </h4>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        editingCards.general
                          ? !!editData.revenue_bonus_enabled
                          : !!config.revenue_bonus_enabled
                      }
                      onChange={(e) => setEditData({ ...editData, revenue_bonus_enabled: e.target.checked })}
                      disabled={!editingCards.general}
                    />
                    <span className="text-sm">{t("payrollConfig.revenueBonusEnabled")}</span>
                  </label>
                  {(editingCards.general ? editData.revenue_bonus_enabled : config.revenue_bonus_enabled) && (
                    <div className="mt-2">
                      <label className="text-xs text-zinc-600">{t("payrollConfig.revenueBonusAmount")}</label>
                      <PositiveDecimalField
                        key={`rev-bonus-${editingCards.general}`}
                        className="mt-1"
                        dir={numDir}
                        suffix={suffixSar}
                        disabled={!editingCards.general}
                        value={
                          editingCards.general ? editData.revenue_bonus_amount : config.revenue_bonus_amount
                        }
                        onChange={(v) =>
                          setEditData((prev) => ({ ...prev, revenue_bonus_amount: v ?? undefined }))
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            </CollapsibleCard>

            {/* Fixed Deduction Card */}
            <CollapsibleCard
              rootClassName="h-full min-h-0 flex flex-col"
              title={t("payrollConfig.fixedDeduction")}
              description={t("payrollConfig.fixedDeductionDesc")}
              icon={DollarSign}
              isConfigured={configStatus?.fixed === "COMPLETE"}
              incompleteHint={incompleteHint}
              isOpen={openCards.fixed}
              onToggle={() => setOpenCards({ ...openCards, fixed: !openCards.fixed })}
              isEditing={editingCards.fixed}
              onEdit={() => startEdit("fixed")}
              onSave={() => setShowSaveDialog("fixed")}
              onCancel={() => cancelEdit("fixed")}
              isReadOnly={isReadOnly}
            >
              <div className="space-y-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("payrollConfig.fixedDeductionHelp")}</p>
                <div>
                  <label className="text-sm font-medium">{t("payrollConfig.deductionAmount")}</label>
                  <PositiveDecimalField
                    key={`fixed-ded-${editingCards.fixed}`}
                    className="mt-1 max-w-md"
                    dir={numDir}
                    suffix={suffixSar}
                    disabled={!editingCards.fixed}
                    value={editingCards.fixed ? editData.deduction_per_order : config.deduction_per_order}
                    onChange={(v) => setEditData((prev) => ({ ...prev, deduction_per_order: v ?? undefined }))}
                  />
                  <p className="mt-1 text-xs text-zinc-500">{t("payrollConfig.tierDeductionUnit", { unit: suffixOrders })}</p>
                </div>
                <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
                  <div className="font-medium text-primary">{t("payrollConfig.calcExampleTitle")}</div>
                  <p className="mt-1">
                    {t("payrollConfig.calcExampleFixed", {
                      missing: exampleMissingOrders,
                      rate: fixedRateForExample ?? "—",
                      total:
                        fixedExampleTotal > 0
                          ? fixedExampleTotal.toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
                            maximumFractionDigits: 2,
                          })
                          : "—",
                    })}
                  </p>
                </div>
              </div>
            </CollapsibleCard>
          </div>

          <div className="space-y-4">
            {/* Orders Tiers Card */}
            <CollapsibleCard
              title={t("payrollConfig.ordersDeductionTiersLabel")}
              description={t("payrollConfig.ordersDeductionTiersDesc")}
              icon={TrendingDown}
              isConfigured={configStatus?.ordersTiers === "COMPLETE"}
              incompleteHint={incompleteHint}
              isOpen={openCards.orders}
              onToggle={() => setOpenCards({ ...openCards, orders: !openCards.orders })}
              isEditing={editingCards.orders}
              onEdit={() => startEdit("orders")}
              onSave={() => setShowSaveDialog("orders")}
              onCancel={() => cancelEdit("orders")}
              isReadOnly={isReadOnly}
            >
              <div className="space-y-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("payrollConfig.ordersTiersDescription")}</p>
                <table className="w-full border-collapse ">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 ltr:text-left rtl:text-right text-sm font-semibold ">{t("payrollConfig.tierRange")}</th>
                      <th className="p-2 ltr:text-left rtl:text-right text-sm font-semibold ">{t("payrollConfig.tierDeductionRate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ORDERS_TIER_RANGES.map((range, idx) => {
                      const tiers = normalizeOrdersTiers(
                        editingCards.orders ? editData.orders_deduction_tiers : config.orders_deduction_tiers,
                      );
                      const tier = tiers[idx];
                      return (
                        <tr key={idx} className="border-b">
                          <td className="p-2 text-sm font-semibold">{range.from} - {range.to} {t("payrollConfig.suffixOrders")}</td>
                          <td className="p-2">
                            <PositiveDecimalField
                              key={`ord-tier-${idx}-${editingCards.orders}`}
                              className="max-w-xs"
                              dir={numDir}
                              suffix={suffixSar}
                              disabled={!editingCards.orders}
                              value={tier?.deduction}
                              onChange={(v) => {
                                const next = [...tiers];
                                next[idx] = { ...range, deduction: v ?? 0 };
                                setEditData((prev) => ({ ...prev, orders_deduction_tiers: next }));
                              }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
                  <div className="font-medium text-primary">{t("payrollConfig.calcExampleTitle")}</div>
                  <p className="mt-2">
                    {t("payrollConfig.calcBreakdownIntroOrders", { deficit: ordersDeficitExample })}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 ps-5" dir={numDir}>
                    {ordersExampleBreakdown.map((line, i) => (
                      <li key={i}>
                        {line.kind === "tier"
                          ? t("payrollConfig.calcTierStepOrders", {
                            from: line.from,
                            to: line.to,
                            take: line.take,
                            rate: fmtNum(line.rate),
                            subtotal: fmtNum(line.subtotal),
                            curr: suffixSar,
                          })
                          : t("payrollConfig.calcTierBeyond", {
                            take: fmtNum(line.take),
                            rate: fmtNum(line.rate),
                            subtotal: fmtNum(line.subtotal),
                            curr: suffixSar,
                          })}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 font-medium">
                    {t("payrollConfig.calcBreakdownTotal", {
                      total: fmtNum(ordersExampleTotal),
                      curr: suffixSar,
                    })}
                  </p>
                </div>
              </div>
            </CollapsibleCard>

            {/* Revenue Tiers Card */}
            <CollapsibleCard
              title={t("payrollConfig.revenueDeductionTiersLabel")}
              description={t("payrollConfig.revenueDeductionTiersDesc")}
              icon={TrendingUp}
              isConfigured={configStatus?.revenueTiers === "COMPLETE"}
              incompleteHint={incompleteHint}
              isOpen={openCards.revenue}
              onToggle={() => setOpenCards({ ...openCards, revenue: !openCards.revenue })}
              isEditing={editingCards.revenue}
              onEdit={() => startEdit("revenue")}
              onSave={() => setShowSaveDialog("revenue")}
              onCancel={() => cancelEdit("revenue")}
              isReadOnly={isReadOnly}
            >
              <div className="space-y-3">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("payrollConfig.revenueTiersDescription")}</p>
                <div>
                  <label className="text-sm font-medium">{t("payrollConfig.revenueUnitAmount")}</label>
                  <PositiveDecimalField
                    key={`rev-unit-${editingCards.revenue}`}
                    className="mt-1 max-w-md"
                    dir={numDir}
                    suffix={suffixSar}
                    disabled={!editingCards.revenue}
                    value={editingCards.revenue ? editData.revenue_unit_amount : config.revenue_unit_amount}
                    onChange={(v) => {
                      setEditData((prev) => {
                        const u = v ?? 0;
                        return {
                          ...prev,
                          revenue_unit_amount: v ?? undefined,
                          revenue_deduction_tiers:
                            u > 0 ? normalizeRevenueTiers(prev.revenue_deduction_tiers, u) : [],
                        };
                      });
                    }}
                  />
                </div>
                {(() => {
                  const unit =
                    (editingCards.revenue ? editData.revenue_unit_amount : config.revenue_unit_amount) || 0;
                  if (!unit || unit <= 0) return null;
                  const tiers = normalizeRevenueTiers(
                    editingCards.revenue ? editData.revenue_deduction_tiers : config.revenue_deduction_tiers,
                    unit,
                  );
                  return (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="p-2 ltr:text-left rtl:text-right text-sm font-semibold">{t("payrollConfig.tierRange")}</th>
                          <th className="p-2 ltr:text-left rtl:text-right text-sm font-semibold">
                            {t("payrollConfig.tierDeductionFlatPerBand")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {tiers.map((row, idx) => (
                          <tr key={idx} className="border-b">
                            <td className="p-2 text-sm font-semibold">
                              {row.from} - {row.to} {t("payrollConfig.suffixSar")}
                            </td>
                            <td className="p-2">
                              <PositiveDecimalField
                                key={`rev-tier-${idx}-${editingCards.revenue}-${unit}`}
                                className="max-w-xs"
                                dir={numDir}
                                suffix={suffixSar}
                                disabled={!editingCards.revenue}
                                value={row.deduction}
                                onChange={(v) => {
                                  const next = [...tiers];
                                  next[idx] = { ...row, deduction: v ?? 0 };
                                  setEditData((prev) => ({ ...prev, revenue_deduction_tiers: next }));
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
                <div className="rounded-md bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
                  <div className="font-medium text-primary">{t("payrollConfig.calcExampleTitle")}</div>
                  <p className="mt-2">
                    {t("payrollConfig.calcBreakdownIntroRevenue", {
                      deficit: revenueDeficitExample,
                      unit: fmtNum(revenueUnitForExample),
                    })}
                  </p>
                  <ul className="mt-2 list-disc space-y-1 ps-5" dir={numDir}>
                    {revenueFlatExample.lines.map((line, i) => (
                      <li key={i}>
                        {line.beyondDefined
                          ? t("payrollConfig.calcRevenueFlatBandBeyond", {
                              consumed: fmtNum(line.consumed),
                              width: fmtNum(line.bandWidth),
                              flat: fmtNum(line.flat),
                              curr: suffixSar,
                            })
                          : t("payrollConfig.calcRevenueFlatBandRow", {
                              from: line.from,
                              to: line.to,
                              consumed: fmtNum(line.consumed),
                              flat: fmtNum(line.flat),
                              curr: suffixSar,
                            })}
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 font-medium">
                    {t("payrollConfig.calcBreakdownTotal", {
                      total: fmtNum(revenueExampleTotal),
                      curr: suffixSar,
                    })}
                  </p>
                </div>
              </div>
            </CollapsibleCard>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              label={t("payrollConfig.totalEmployees")}
              value={(stats?.activeEmployees ?? 0).toLocaleString(
                locale === "ar" ? "ar-SA" : "en-US",
              )}
            />
            <StatCard label={t("payrollConfig.totalCosts")} value={formatMoney(stats?.totalCosts ?? 0)} />
            <StatCard label={t("payrollConfig.averageCost")} value={formatMoney(stats?.averageCost ?? 0)} />
          </div>
          <PayrollConfigCostsTab
            locale={locale}
            onChanged={() => router.refresh()}
            onToast={pushToast}
          />
        </>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Approve Dialog */}
      {showApproveDialog && (
        <Modal
          isOpen={showApproveDialog}
          onClose={() => setShowApproveDialog(false)}
          title={t("payrollConfig.approveConfirmTitle")}
        >
          <div className="space-y-4">
            <p>{t("payrollConfig.approveConfirmMessage", { month: `${year}-${String(month).padStart(2, "0")}` })}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowApproveDialog(false)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm"
              >
                {t("payrollConfig.cancel")}
              </button>
              <button
                onClick={handleApprove}
                disabled={approving}
                className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:bg-zinc-300"
              >
                {approving ? t("payrollConfig.saving") : t("payrollConfig.approve")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Save Dialog */}
      {showSaveDialog && (
        <Modal
          isOpen={!!showSaveDialog}
          onClose={() => setShowSaveDialog(null)}
          title={t("payrollConfig.saveConfirmTitle")}
        >
          <div className="space-y-4">
            <p>{t("payrollConfig.saveConfirmMessage")}</p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowSaveDialog(null)}
                className="rounded-md border border-zinc-300 px-4 py-2 text-sm"
              >
                {t("payrollConfig.cancel")}
              </button>
              <button
                onClick={() => handleSaveCard(showSaveDialog)}
                className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
              >
                {t("payrollConfig.save")}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
