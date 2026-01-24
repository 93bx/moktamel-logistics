"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Modal } from "./Modal";

type PayrollConfigData = {
  calculation_method: 'ORDERS_COUNT' | 'REVENUE' | 'FIXED_DEDUCTION';
  monthly_target?: number | null;
  monthly_target_amount?: number | null;
  bonus_per_order?: number | null;
  minimum_salary?: number | null;
  unit_amount?: number | null;
  deduction_per_order?: number | null;
  deduction_tiers?: Array<{ from: number; to: number; deduction: number }> | null;
};

type PayrollStatsData = {
  activeEmployees: number;
  totalCosts: number;
  averageCost: number;
};

type CostTypeCode =
  | "COST_TYPE_EMPLOYEE_SALARIES"
  | "COST_TYPE_HOUSING"
  | "COST_TYPE_FUEL"
  | "COST_TYPE_MAINTENANCE"
  | "COST_TYPE_ADMIN_SALARIES"
  | "COST_TYPE_GOVERNMENT_EXPENSES";

type CostRecurrenceCode = "ONE_TIME" | "MONTHLY" | "YEARLY";

type CostItem = {
  id: string;
  name: string;
  type_code: CostTypeCode;
  amount_input: number;
  vat_included: boolean;
  vat_rate: number;
  vat_amount: number;
  net_amount: number;
  recurrence_code: CostRecurrenceCode;
  one_time_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type CostListResponse = {
  items: CostItem[];
  total: number;
  page: number;
  page_size: number;
};

type PayrollConfigPageClientProps = {
  locale: string;
  initialConfig: PayrollConfigData;
  initialStats: PayrollStatsData;
  initialYear: number;
  initialMonth: number;
};

type DeductionTier = {
  from: number;
  to: number;
  deduction: number;
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="text-sm text-primary/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-primary">{value}</div>
    </div>
  );
}

function EditableCard({
  label,
  value,
  type = "number",
  min,
  step,
  onChange,
  saving,
  saved,
  error,
  t,
}: {
  label: string;
  value: number | null | undefined;
  type?: "number" | "text";
  min?: number;
  step?: number | string;
  onChange: (val: number | null) => void;
  saving: boolean;
  saved: boolean;
  error?: string | null;
  t: (key: string, values?: Record<string, any>) => string;
}) {
  const [localValue, setLocalValue] = useState<string>(value?.toString() ?? "");
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setLocalValue(value?.toString() ?? "");
  }, [value]);

  const handleBlur = () => {
    setIsEditing(false);
    const num = localValue === "" ? null : Number(localValue);
    if (num !== null && min !== undefined && num < min) {
      setLocalValue(value?.toString() ?? "");
      return;
    }
    onChange(num);
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="text-sm text-primary/60">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        {isEditing ? (
          <input
            type={type}
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleBlur();
              }
            }}
            min={min}
            step={step}
            className="w-32 rounded-md border border-zinc-200 bg-white px-2 py-1 text-lg font-semibold text-primary dark:border-zinc-700 dark:bg-zinc-900"
            autoFocus
          />
        ) : (
          <div
            onClick={() => setIsEditing(true)}
            className="cursor-pointer text-lg font-semibold text-primary hover:underline"
          >
            {value?.toLocaleString() ?? "-"}
          </div>
        )}
        {saving && <span className="text-xs text-primary/60">{saving ? t("payrollConfig.saving") : ""}</span>}
        {saved && !saving && <span className="text-xs text-emerald-600">{t("payrollConfig.saved")}</span>}
      </div>
      {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
    </div>
  );
}

function validateDeductionTiers(tiers: DeductionTier[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (tiers.length === 0) {
    return { valid: true, errors: [] };
  }

  // Sort tiers by 'from' value
  const sorted = [...tiers].sort((a, b) => a.from - b.from);

  // Check each tier
  for (const tier of sorted) {
    if (tier.from > tier.to) {
      errors.push("From must be <= To");
    }
    if (tier.from < 0 || tier.to < 0) {
      errors.push("Range values must be positive");
    }
    if (tier.deduction < 0) {
      errors.push("Deduction must be positive");
    }
  }

  // Check for gaps
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].to + 1 !== sorted[i + 1].from) {
      errors.push("Ranges must be continuous (no gaps)");
      break;
    }
  }

  // Check for overlaps
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].to >= sorted[i + 1].from) {
      errors.push("Ranges cannot overlap");
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}

export function PayrollConfigPageClient({
  locale,
  initialConfig,
  initialStats,
  initialYear,
  initialMonth,
}: PayrollConfigPageClientProps) {
  const t = useTranslations();
  const router = useRouter();
  const [config, setConfig] = useState<PayrollConfigData>(initialConfig);
  const [stats, setStats] = useState<PayrollStatsData>(initialStats);
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [savingFields, setSavingFields] = useState<Set<string>>(new Set());
  const [savedFields, setSavedFields] = useState<Set<string>>(new Set());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [tierErrors, setTierErrors] = useState<string[]>([]);
  const saveTimeouts = useRef<Record<string, NodeJS.Timeout>>({});
  const [activeTab, setActiveTab] = useState<"payroll" | "costs">("payroll");

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/payroll-config/stats?year=${year}&month=${month}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data: PayrollStatsData = await res.json();
      setStats(data);
    } catch {
      // keep previous stats on failure
    }
  }, [year, month]);

  // Debounced save function
  const saveConfig = useCallback(
    async (field: string, data: Partial<PayrollConfigData>) => {
      // Clear existing timeout for this field
      if (saveTimeouts.current[field]) {
        clearTimeout(saveTimeouts.current[field]);
      }

      // Set saving state
      setSavingFields((prev) => new Set(prev).add(field));
      setSavedFields((prev) => {
        const next = new Set(prev);
        next.delete(field);
        return next;
      });
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });

      // Debounce the save
      saveTimeouts.current[field] = setTimeout(async () => {
        try {
          const res = await fetch("/api/payroll-config/config", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              ...config,
              ...data,
            }),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => null);
            throw new Error(errorData?.message ?? "Failed to save");
          }

          const updated = await res.json();
          setConfig(updated);
          setSavingFields((prev) => {
            const next = new Set(prev);
            next.delete(field);
            return next;
          });
          setSavedFields((prev) => new Set(prev).add(field));
          setTimeout(() => {
            setSavedFields((prev) => {
              const next = new Set(prev);
              next.delete(field);
              return next;
            });
          }, 2000);
        } catch (error) {
          setSavingFields((prev) => {
            const next = new Set(prev);
            next.delete(field);
            return next;
          });
          setFieldErrors((prev) => ({
            ...prev,
            [field]: error instanceof Error ? error.message : "Failed to save",
          }));
        }
      }, 500);
    },
    [config]
  );

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [y, m] = e.target.value.split("-").map(Number);
    setYear(y);
    setMonth(m);
    router.push(`/${locale}/payroll-config?year=${y}&month=${m}`);
  };

  const handleMethodChange = (method: 'ORDERS_COUNT' | 'REVENUE' | 'FIXED_DEDUCTION') => {
    saveConfig("calculation_method", { calculation_method: method });
  };

  const handleFieldChange = (field: keyof PayrollConfigData, value: number | null) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    saveConfig(field, { [field]: value });
  };

  const handleTiersChange = (tiers: DeductionTier[]) => {
    const validation = validateDeductionTiers(tiers);
    setTierErrors(validation.errors);
    if (validation.valid) {
      setConfig((prev) => ({ ...prev, deduction_tiers: tiers }));
      saveConfig("deduction_tiers", { deduction_tiers: tiers });
    }
  };

  const addTier = () => {
    const currentTiers = config.deduction_tiers ?? [];
    const lastTier = currentTiers.length > 0 ? currentTiers[currentTiers.length - 1] : null;
    const newTier: DeductionTier = {
      from: lastTier ? lastTier.to + 1 : 1,
      to: lastTier ? lastTier.to + 50 : 50,
      deduction: 0,
    };
    handleTiersChange([...currentTiers, newTier]);
  };

  const removeTier = (index: number) => {
    const currentTiers = config.deduction_tiers ?? [];
    handleTiersChange(currentTiers.filter((_, i) => i !== index));
  };

  const updateTier = (index: number, field: keyof DeductionTier, value: number) => {
    const currentTiers = config.deduction_tiers ?? [];
    const updated = currentTiers.map((tier, i) =>
      i === index ? { ...tier, [field]: value } : tier
    );
    handleTiersChange(updated);
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(saveTimeouts.current).forEach((timeout) => clearTimeout(timeout));
    };
  }, []);

  const currentMonthString = useMemo(() => {
    return `${year}-${String(month).padStart(2, "0")}`;
  }, [year, month]);

  const formatAmount = (v: number) => v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("payrollConfig.totalEmployees")} value={stats.activeEmployees.toLocaleString()} />
        <StatCard label={t("payrollConfig.totalCosts")} value={formatAmount(stats.totalCosts)} />
        <StatCard label={t("payrollConfig.averageCost")} value={formatAmount(stats.averageCost)} />
      </div>

      {/* Tabs header */}
      <div className="border-b border-zinc-200 dark:border-zinc-700">
        <nav className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("payroll")}
            className={`px-3 py-2 text-sm font-medium ${
              activeTab === "payroll"
                ? "border-b-2 border-primary text-primary"
                : "text-primary/60 hover:text-primary"
            }`}
          >
            {t("payrollConfig.tabPayrollManagement")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("costs")}
            className={`px-3 py-2 text-sm font-medium ${
              activeTab === "costs"
                ? "border-b-2 border-primary text-primary"
                : "text-primary/60 hover:text-primary"
            }`}
          >
            {t("payrollConfig.tabCostsManagement")}
          </button>
        </nav>
      </div>

      {activeTab === "payroll" ? (
        <>
          {/* Controls Row */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <label className="text-sm text-primary/60">{t("payrollConfig.dateFilter")}:</label>
              <select
                value={year}
                onChange={(e) => {
                  const newYear = Number(e.target.value) || year;
                  setYear(newYear);
                  router.push(`/${locale}/payroll-config?year=${newYear}&month=${month}`);
                }}
                className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800"
              >
                {Array.from({ length: 5 }).map((_, idx) => {
                  const y = new Date().getFullYear() - 2 + idx;
                  return (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  );
                })}
              </select>
              <select
                value={month}
                onChange={(e) => {
                  const newMonth = Number(e.target.value) || month;
                  setMonth(newMonth);
                  router.push(`/${locale}/payroll-config?year=${year}&month=${newMonth}`);
                }}
                className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800"
              >
                {Array.from({ length: 12 }).map((_, idx) => {
                  const m = idx + 1;
                  const date = new Date(2000, m - 1, 1);
                  const label = date.toLocaleString(locale === "ar" ? "ar" : "en", { month: "long" });
                  return (
                    <option key={m} value={m}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-sm text-primary/60">{t("payrollConfig.calculationMethod")}:</div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700">
                  <input
                    type="radio"
                    name="calculation_method"
                    checked={config.calculation_method === "ORDERS_COUNT"}
                    onChange={() => handleMethodChange("ORDERS_COUNT")}
                    className="h-4 w-4"
                  />
                  <span>{t("payrollConfig.methodOrders")}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700">
                  <input
                    type="radio"
                    name="calculation_method"
                    checked={config.calculation_method === "REVENUE"}
                    onChange={() => handleMethodChange("REVENUE")}
                    className="h-4 w-4"
                  />
                  <span>{t("payrollConfig.methodRevenue")}</span>
                </label>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-zinc-200 bg-white px-4 py-3 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700">
                  <input
                    type="radio"
                    name="calculation_method"
                    checked={config.calculation_method === "FIXED_DEDUCTION"}
                    onChange={() => handleMethodChange("FIXED_DEDUCTION")}
                    className="h-4 w-4"
                  />
                  <span>{t("payrollConfig.methodFixed")}</span>
                </label>
              </div>
            </div>
          </div>

          {/* Config Section based on method */}
          {config.calculation_method === "ORDERS_COUNT" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <EditableCard
                  label={t("payrollConfig.monthlyTargetOrders")}
                  t={t}
                  value={config.monthly_target}
                  type="number"
                  min={1}
                  step={1}
                  onChange={(val) => handleFieldChange("monthly_target", val)}
                  saving={savingFields.has("monthly_target")}
                  saved={savedFields.has("monthly_target")}
                  error={fieldErrors.monthly_target}
                />
                <EditableCard
                  label={t("payrollConfig.minimumSalary")}
                  t={t}
                  value={config.minimum_salary}
                  type="number"
                  min={0}
                  step={0.01}
                  onChange={(val) => handleFieldChange("minimum_salary", val)}
                  saving={savingFields.has("minimum_salary")}
                  saved={savedFields.has("minimum_salary")}
                  error={fieldErrors.minimum_salary}
                />
                <EditableCard
                  label={t("payrollConfig.bonusPerOrder")}
                  t={t}
                  value={config.bonus_per_order}
                  type="number"
                  min={0}
                  step={0.01}
                  onChange={(val) => handleFieldChange("bonus_per_order", val)}
                  saving={savingFields.has("bonus_per_order")}
                  saved={savedFields.has("bonus_per_order")}
                  error={fieldErrors.bonus_per_order}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-primary">{t("payrollConfig.deductionTiers")}</h3>
                  <button
                    type="button"
                    onClick={addTier}
                    className="rounded-md bg-primary px-3 py-1 text-sm text-white hover:bg-primary/90"
                  >
                    {t("payrollConfig.addTier")}
                  </button>
                </div>
                {tierErrors.length > 0 && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                    {tierErrors.map((err, i) => (
                      <div key={i}>{err}</div>
                    ))}
                  </div>
                )}
                <div className="rounded-md border border-zinc-200 dark:border-zinc-700">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase text-primary/60 dark:bg-zinc-800/60">
                      <tr>
                        <th className="px-3 py-2 text-left">{t("payrollConfig.tierFrom")}</th>
                        <th className="px-3 py-2 text-left">{t("payrollConfig.tierTo")}</th>
                        <th className="px-3 py-2 text-left">{t("payrollConfig.tierDeduction")}</th>
                        <th className="px-3 py-2 text-right">{t("common.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(config.deduction_tiers ?? []).map((tier, idx) => (
                        <tr key={idx} className="border-t border-zinc-100 dark:border-zinc-700">
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={tier.from}
                              onChange={(e) => updateTier(idx, "from", parseInt(e.target.value, 10) || 0)}
                              className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={tier.to}
                              onChange={(e) => updateTier(idx, "to", parseInt(e.target.value, 10) || 0)}
                              className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={tier.deduction}
                              onChange={(e) => updateTier(idx, "deduction", parseFloat(e.target.value) || 0)}
                              className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeTier(idx)}
                              className="text-xs text-primary hover:underline"
                            >
                              {t("payrollConfig.removeTier")}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!config.deduction_tiers || config.deduction_tiers.length === 0) && (
                        <tr>
                          <td colSpan={4} className="px-3 py-4 text-center text-sm text-primary/60">
                            {t("common.noResults")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {config.calculation_method === "REVENUE" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <EditableCard
                  label={t("payrollConfig.monthlyTargetAmount")}
                  t={t}
                  value={config.monthly_target_amount}
                  type="number"
                  min={0.01}
                  step={0.01}
                  onChange={(val) => handleFieldChange("monthly_target_amount", val)}
                  saving={savingFields.has("monthly_target_amount")}
                  saved={savedFields.has("monthly_target_amount")}
                  error={fieldErrors.monthly_target_amount}
                />
                <EditableCard
                  label={t("payrollConfig.unitAmount")}
                  t={t}
                  value={config.unit_amount}
                  type="number"
                  min={0.01}
                  step={0.01}
                  onChange={(val) => handleFieldChange("unit_amount", val)}
                  saving={savingFields.has("unit_amount")}
                  saved={savedFields.has("unit_amount")}
                  error={fieldErrors.unit_amount}
                />
                <EditableCard
                  label={t("payrollConfig.bonusPerOrder")}
                  t={t}
                  value={config.bonus_per_order}
                  type="number"
                  min={0}
                  step={0.01}
                  onChange={(val) => handleFieldChange("bonus_per_order", val)}
                  saving={savingFields.has("bonus_per_order")}
                  saved={savedFields.has("bonus_per_order")}
                  error={fieldErrors.bonus_per_order}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-primary">
                    {t("payrollConfig.deductionTiers")} ({t("payrollConfig.tierDeductionUnit", { unit: config.unit_amount ?? 0 })})
                  </h3>
                  <button
                    type="button"
                    onClick={addTier}
                    className="rounded-md bg-primary px-3 py-1 text-sm text-white hover:bg-primary/90"
                  >
                    {t("payrollConfig.addTier")}
                  </button>
                </div>
                {tierErrors.length > 0 && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
                    {tierErrors.map((err, i) => (
                      <div key={i}>{err}</div>
                    ))}
                  </div>
                )}
                <div className="rounded-md border border-zinc-200 dark:border-zinc-700">
                  <table className="min-w-full text-sm">
                    <thead className="bg-zinc-50 text-xs uppercase text-primary/60 dark:bg-zinc-800/60">
                      <tr>
                        <th className="px-3 py-2 text-left">{t("payrollConfig.tierFrom")}</th>
                        <th className="px-3 py-2 text-left">{t("payrollConfig.tierTo")}</th>
                        <th className="px-3 py-2 text-left">
                          {t("payrollConfig.tierDeductionUnit", { unit: config.unit_amount ?? 0 })}
                        </th>
                        <th className="px-3 py-2 text-right">{t("common.actions")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(config.deduction_tiers ?? []).map((tier, idx) => (
                        <tr key={idx} className="border-t border-zinc-100 dark:border-zinc-700">
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={tier.from}
                              onChange={(e) => updateTier(idx, "from", parseFloat(e.target.value) || 0)}
                              className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={tier.to}
                              onChange={(e) => updateTier(idx, "to", parseFloat(e.target.value) || 0)}
                              className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              step={0.01}
                              value={tier.deduction}
                              onChange={(e) => updateTier(idx, "deduction", parseFloat(e.target.value) || 0)}
                              className="w-full rounded-md border border-zinc-200 bg-white px-2 py-1 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeTier(idx)}
                              className="text-xs text-primary hover:underline"
                            >
                              {t("payrollConfig.removeTier")}
                            </button>
                          </td>
                        </tr>
                      ))}
                      {(!config.deduction_tiers || config.deduction_tiers.length === 0) && (
                        <tr>
                          <td colSpan={4} className="px-3 py-4 text-center text-sm text-primary/60">
                            {t("common.noResults")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {config.calculation_method === "FIXED_DEDUCTION" && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <EditableCard
                  label={t("payrollConfig.monthlyTarget")}
                  t={t}
                  value={config.monthly_target}
                  type="number"
                  min={1}
                  step={1}
                  onChange={(val) => handleFieldChange("monthly_target", val)}
                  saving={savingFields.has("monthly_target")}
                  saved={savedFields.has("monthly_target")}
                  error={fieldErrors.monthly_target}
                />
                <EditableCard
                  label={t("payrollConfig.deductionPerOrder")}
                  t={t}
                  value={config.deduction_per_order}
                  type="number"
                  min={0}
                  step={0.01}
                  onChange={(val) => handleFieldChange("deduction_per_order", val)}
                  saving={savingFields.has("deduction_per_order")}
                  saved={savedFields.has("deduction_per_order")}
                  error={fieldErrors.deduction_per_order}
                />
                <EditableCard
                  label={t("payrollConfig.minimumSalary")}
                  t={t}
                  value={config.minimum_salary}
                  type="number"
                  min={0}
                  step={0.01}
                  onChange={(val) => handleFieldChange("minimum_salary", val)}
                  saving={savingFields.has("minimum_salary")}
                  saved={savedFields.has("minimum_salary")}
                  error={fieldErrors.minimum_salary}
                />
                <EditableCard
                  label={t("payrollConfig.bonusPerOrder")}
                  t={t}
                  value={config.bonus_per_order}
                  type="number"
                  min={0}
                  step={0.01}
                  onChange={(val) => handleFieldChange("bonus_per_order", val)}
                  saving={savingFields.has("bonus_per_order")}
                  saved={savedFields.has("bonus_per_order")}
                  error={fieldErrors.bonus_per_order}
                />
              </div>
            </div>
          )}
        </>
      ) : (
        <CostsManagementTab locale={locale} onChanged={refreshStats} />
      )}
    </div>
  );
}

function CostsManagementTab({ locale, onChanged }: { locale: string; onChanged: () => void }) {
  const t = useTranslations();
  const [data, setData] = useState<CostListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CostItem | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        page_size: "25",
        ...(query ? { q: query } : {}),
        ...(typeFilter ? { type_code: typeFilter } : {}),
      });
      const res = await fetch(`/api/costs?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [page, query, typeFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (id: string) => {
    if (!confirm(t("common.confirmDelete"))) return;
    const res = await fetch(`/api/costs/${id}`, { method: "DELETE" });
    if (res.ok) {
      fetchData();
      onChanged();
    }
  };

  const handleSave = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    fetchData();
    onChanged();
  };

  return (
    <div className="space-y-4">
      {/* Controls Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setPage(1);
            }}
            className="w-48 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">{t("costs.allTypes")}</option>
            <option value="COST_TYPE_EMPLOYEE_SALARIES">{t("costs.type_EMPLOYEE_SALARIES")}</option>
            <option value="COST_TYPE_HOUSING">{t("costs.type_HOUSING")}</option>
            <option value="COST_TYPE_FUEL">{t("costs.type_FUEL")}</option>
            <option value="COST_TYPE_MAINTENANCE">{t("costs.type_MAINTENANCE")}</option>
            <option value="COST_TYPE_ADMIN_SALARIES">{t("costs.type_ADMIN_SALARIES")}</option>
            <option value="COST_TYPE_GOVERNMENT_EXPENSES">{t("costs.type_GOVERNMENT_EXPENSES")}</option>
          </select>
          <input
            type="text"
            placeholder={t("costs.searchPlaceholder")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="flex-1 max-w-sm rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingItem(null);
            setIsModalOpen(true);
          }}
          className="rounded-md bg-primary px-4 py-2 text-sm text-white hover:bg-primary/90"
        >
          {t("costs.addCost")}
        </button>
      </div>

      {/* Table */}
      <div className="rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-primary/60 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 text-left">{t("costs.colName")}</th>
                <th className="px-4 py-3 text-left">{t("costs.colType")}</th>
                <th className="px-4 py-3 text-right">{t("costs.colAmount")}</th>
                <th className="px-4 py-3 text-right">{t("costs.colVat")}</th>
                <th className="px-4 py-3 text-right">{t("costs.colNet")}</th>
                <th className="px-4 py-3 text-left">{t("costs.colRecurrence")}</th>
                <th className="px-4 py-3 text-right">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-primary/60">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-primary/60">
                    {t("common.noResults")}
                  </td>
                </tr>
              ) : (
                data?.items.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                    <td className="px-4 py-3 font-medium text-primary">{item.name}</td>
                    <td className="px-4 py-3">{t(`costs.type_${item.type_code.replace("COST_TYPE_", "")}`)}</td>
                    <td className="px-4 py-3 text-right">{item.amount_input.toLocaleString()}</td>
                    <td className="px-4 py-3 text-right text-primary/60">
                      {item.vat_included ? item.vat_amount.toLocaleString() : "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{item.net_amount.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      {t(`costs.recurrence_${item.recurrence_code}`)}
                      {item.recurrence_code === "ONE_TIME" && item.one_time_date && (
                        <div className="text-xs text-primary/40">
                          {new Date(item.one_time_date).toLocaleDateString(locale === "ar" ? "ar" : "en")}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setIsModalOpen(true);
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingItem(null);
        }}
        title={editingItem ? t("costs.editCost") : t("costs.addCost")}
      >
        <CostForm item={editingItem} onSave={handleSave} onCancel={() => setIsModalOpen(false)} />
      </Modal>
    </div>
  );
}

function CostForm({
  item,
  onSave,
  onCancel,
}: {
  item: CostItem | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: item?.name ?? "",
    type_code: item?.type_code ?? "COST_TYPE_EMPLOYEE_SALARIES",
    amount_input: item?.amount_input ?? 0,
    vat_included: item?.vat_included ?? false,
    recurrence_code: item?.recurrence_code ?? "MONTHLY",
    one_time_date: item?.one_time_date ? item.one_time_date.split("T")[0] : "",
    notes: item?.notes ?? "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        ...formData,
        amount_input: Number(formData.amount_input),
        one_time_date: formData.recurrence_code === "ONE_TIME" && formData.one_time_date 
          ? new Date(formData.one_time_date).toISOString() 
          : null,
      };

      const res = await fetch(item ? `/api/costs/${item.id}` : "/api/costs", {
        method: item ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to save");
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pt-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-sm font-medium text-primary">{t("costs.formName")}</label>
        <input
          required
          type="text"
          value={formData.name}
          onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-primary">{t("costs.formType")}</label>
          <select
            required
            value={formData.type_code}
            onChange={(e) => setFormData((p) => ({ ...p, type_code: e.target.value as any }))}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="COST_TYPE_EMPLOYEE_SALARIES">{t("costs.type_EMPLOYEE_SALARIES")}</option>
            <option value="COST_TYPE_HOUSING">{t("costs.type_HOUSING")}</option>
            <option value="COST_TYPE_FUEL">{t("costs.type_FUEL")}</option>
            <option value="COST_TYPE_MAINTENANCE">{t("costs.type_MAINTENANCE")}</option>
            <option value="COST_TYPE_ADMIN_SALARIES">{t("costs.type_ADMIN_SALARIES")}</option>
            <option value="COST_TYPE_GOVERNMENT_EXPENSES">{t("costs.type_GOVERNMENT_EXPENSES")}</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-primary">{t("costs.formAmount")}</label>
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={formData.amount_input}
            onChange={(e) => setFormData((p) => ({ ...p, amount_input: Number(e.target.value) }))}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="vat_included"
          checked={formData.vat_included}
          onChange={(e) => setFormData((p) => ({ ...p, vat_included: e.target.checked }))}
          className="h-4 w-4"
        />
        <label htmlFor="vat_included" className="text-sm text-primary/80">
          {t("costs.formVatIncluded")}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-primary">{t("costs.formRecurrence")}</label>
          <select
            required
            value={formData.recurrence_code}
            onChange={(e) => setFormData((p) => ({ ...p, recurrence_code: e.target.value as any }))}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="ONE_TIME">{t("costs.recurrence_ONE_TIME")}</option>
            <option value="MONTHLY">{t("costs.recurrence_MONTHLY")}</option>
            <option value="YEARLY">{t("costs.recurrence_YEARLY")}</option>
          </select>
        </div>

        {formData.recurrence_code === "ONE_TIME" && (
          <div className="space-y-1">
            <label className="text-sm font-medium text-primary">{t("costs.formDate")}</label>
            <input
              required
              type="date"
              value={formData.one_time_date}
              onChange={(e) => setFormData((p) => ({ ...p, one_time_date: e.target.value }))}
              className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-primary">{t("costs.formNotes")}</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
          className="w-full h-20 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-primary/60 hover:text-primary"
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </form>
  );
}


