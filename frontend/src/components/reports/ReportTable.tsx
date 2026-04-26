"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ReportColumn, ReportDataResponse } from "@/lib/types/reports";
import { CurrencyWithRiyal } from "@/components/CurrencyWithRiyal";

export function ReportTable({
  data,
  columns,
}: {
  data: ReportDataResponse | null;
  columns?: ReportColumn[];
}) {
  const t = useTranslations();
  const translate = (key: string) => t(key as Parameters<typeof t>[0]);
  if (!data) return <div className="text-sm text-primary/60">{t("common.loading")}</div>;
  const visibleColumns = dedupeColumns(columns ?? data.columns);
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-700">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 dark:bg-zinc-800">
          <tr>
            {visibleColumns.map((c) => (
              <th key={c.key} className="px-3 py-2 text-left font-semibold">
                {translate(c.label_code)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, idx) => (
            <tr key={idx} className="border-t border-zinc-100 dark:border-zinc-700">
              {visibleColumns.map((c) => (
                <td key={c.key} className="px-3 py-2">
                  {formatCell(row[c.key], c.key, translate)}
                </td>
              ))}
            </tr>
          ))}
          {data.rows.length === 0 ? (
            <tr>
              <td colSpan={visibleColumns.length} className="px-3 py-6 text-center text-primary/60">
                {t("common.noResults")}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(
  value: string | number | boolean | null | undefined,
  key: string,
  translate: (key: string) => string,
): ReactNode {
  if (value === null || value === undefined) return "-";
  
  if (typeof value === "boolean") return value ? translate("common.yes") : translate("common.no");
  
  if (typeof value === "number") {
    if (key.includes("amount") || key.includes("revenue") || key.includes("salary") || key.includes("cost")) {
      return (
        <CurrencyWithRiyal
          amount={value}
          formattedAmount={value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          symbolSize="sm"
        />
      );
    }
    return value.toLocaleString();
  }
  
  const str = String(value);
  
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  
  if (/^[A-Z_]+$/.test(str) && str.length > 3) {
    return translate(str);
  }
  
  return str;
}

function dedupeColumns(columns: ReportColumn[]) {
  const seen = new Set<string>();
  return columns.filter((column) => {
    if (seen.has(column.key)) return false;
    seen.add(column.key);
    return true;
  });
}
