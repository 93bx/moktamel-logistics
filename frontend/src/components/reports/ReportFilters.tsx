"use client";

import { useTranslations } from "next-intl";
import type { ReportFilter } from "@/lib/types/reports";
import { ReportDateRangePicker } from "./ReportDateRangePicker";

export function ReportFilters({
  filters,
  values,
  onChange,
}: {
  filters: ReportFilter[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
}) {
  const t = useTranslations();
  const translate = (key: string) => t(key as Parameters<typeof t>[0]);
  if (!filters.length) return null;
  const hasDateRange = filters.some((f) => f.key === "date_from") || filters.some((f) => f.key === "date_to");
  const fieldFilters = filters.filter((f) => f.key !== "date_from" && f.key !== "date_to");

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {hasDateRange ? (
        <ReportDateRangePicker
          label={t("reports.filter.dateRange")}
          description={t("reports.filter.dateRangeHelp")}
          startValue={values.date_from}
          endValue={values.date_to}
          onChange={onChange}
          clearLabel={t("reports.filter.clearDateRange")}
        />
      ) : null}
      {fieldFilters.map((f) => (
        <div key={f.key}>
          <label className="text-xs text-primary/70">{translate(`reports.filter.${f.key}`)}</label>
          {f.type === "select" ? (
            <select
              value={values[f.key] ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">{t("common.allStatuses")}</option>
              {(f.options ?? []).map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {translate(opt.label_code)}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={f.type === "date" ? "date" : "text"}
              value={values[f.key] ?? ""}
              onChange={(e) => onChange(f.key, e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          )}
        </div>
      ))}
    </div>
  );
}
