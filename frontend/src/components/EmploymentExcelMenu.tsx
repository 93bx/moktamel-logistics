"use client";

import { useTranslations } from "next-intl";
import { ChevronDown, Download, FileSpreadsheet, Upload } from "lucide-react";

/** Excel menu matching Recruitment styling; import/export wiring comes later. */
export function EmploymentExcelMenu() {
  const t = useTranslations();

  return (
    <details className="relative">
      <summary className="inline-flex list-none cursor-pointer items-center gap-2 rounded-md border border-[#0E5C2F] bg-[#107C41] px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#185C37] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#107C41]/40 dark:border-[#21A366] dark:bg-[#107C41] dark:hover:bg-[#185C37] [&::-webkit-details-marker]:hidden">
        <FileSpreadsheet className="h-4 w-4" />
        {t("common.excel")}
        <ChevronDown className="h-4 w-4" />
      </summary>
      <div className="absolute end-0 z-20 mt-2 min-w-40 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-primary opacity-60 hover:bg-zinc-50 dark:hover:bg-zinc-700"
          disabled
        >
          <Upload className="h-4 w-4 shrink-0" />
          {t("common.import")}
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm text-primary opacity-60 hover:bg-zinc-50 dark:hover:bg-zinc-700"
          disabled
        >
          <Download className="h-4 w-4 shrink-0" />
          {t("common.export")}
        </button>
      </div>
    </details>
  );
}
