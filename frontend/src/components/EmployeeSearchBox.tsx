"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";

type EmployeeOption = {
  id: string;
  employee_no: string | null;
  assigned_platform?: string | null;
  status_code?: string | null;
  recruitment_candidate: { full_name_ar: string; full_name_en: string | null } | null;
};

export function EmployeeSearchBox({
  value,
  onChange,
  searchPath = "/api/assets/employees/search",
  placeholder,
  onSelectOption,
  disabled = false,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  searchPath?: string;
  placeholder?: string;
  onSelectOption?: (option: EmployeeOption) => void;
  disabled?: boolean;
}) {
  const t = useTranslations();
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useMemo(() => query, [query]);

  useEffect(() => {
    const controller = new AbortController();
    async function search() {
      if (!debouncedQuery) {
        setOptions([]);
        return;
      }
      setLoading(true);
      try {
        const res = await fetch(`${searchPath}?q=${encodeURIComponent(debouncedQuery)}`, {
          signal: controller.signal,
        });
        const data = await res.json().catch(() => []);
        if (!controller.signal.aborted) setOptions(Array.isArray(data) ? data : []);
      } catch {
        if (!controller.signal.aborted) setOptions([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    const timer = setTimeout(() => void search(), 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [debouncedQuery, searchPath]);

  return (
    <div className="space-y-1">
      <input
        disabled={disabled}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder ?? t("assets.searchEmployee")}
        className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 disabled:bg-zinc-100 disabled:text-primary/50 dark:border-zinc-700 dark:bg-zinc-800"
      />
      <div className="max-h-40 overflow-y-auto rounded-md border border-zinc-100 bg-white dark:border-zinc-700 dark:bg-zinc-900">
        {loading ? (
          <div className="px-3 py-2 text-sm text-primary/60">{t("common.loading")}</div>
        ) : options.length === 0 ? (
          <div className="px-3 py-2 text-sm text-primary/60">{t("common.noResults")}</div>
        ) : (
          options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                onChange(opt.id);
                onSelectOption?.(opt);
                setQuery(opt.recruitment_candidate?.full_name_ar ?? opt.employee_no ?? "");
              }}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-primary/5 ${
                value === opt.id ? "bg-primary/10" : ""
              }`}
            >
              <span>{opt.recruitment_candidate ? `${opt.recruitment_candidate.full_name_ar} ${opt.recruitment_candidate.full_name_en ? `(${opt.recruitment_candidate.full_name_en})` : ""}` : opt.employee_no ?? "-"}</span>
              <span className="text-xs text-primary/60">{opt.employee_no ?? ""}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}


