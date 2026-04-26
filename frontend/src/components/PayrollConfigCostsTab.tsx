"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "./Modal";
import { CurrencyWithRiyal } from "./CurrencyWithRiyal";

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

export function PayrollConfigCostsTab({
  locale,
  onChanged,
  onToast,
}: {
  locale: string;
  onChanged: () => void;
  onToast?: (message: string, variant: "success" | "error") => void;
}) {
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
      onToast?.(t("payrollConfig.toastCostDeleted"), "success");
    } else {
      const data = await res.json().catch(() => null);
      onToast?.(data?.message ?? t("payrollConfig.toastCostSaveError"), "error");
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-3">
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
            className="min-w-[12rem] max-w-sm flex-1 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingItem(null);
            setIsModalOpen(true);
          }}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          {t("costs.addCost")}
        </button>
      </div>

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
                    <td className="px-4 py-3 text-right">
                      <CurrencyWithRiyal amount={item.amount_input} formattedAmount={item.amount_input.toLocaleString()} symbolSize="sm" />
                    </td>
                    <td className="px-4 py-3 text-right text-primary/60">
                      {item.vat_included ? (
                        <CurrencyWithRiyal amount={item.vat_amount} formattedAmount={item.vat_amount.toLocaleString()} symbolSize="sm" />
                      ) : "-"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      <CurrencyWithRiyal amount={item.net_amount} formattedAmount={item.net_amount.toLocaleString()} symbolSize="sm" />
                    </td>
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
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setIsModalOpen(true);
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          type="button"
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
        <CostForm
          item={editingItem}
          onSave={handleSave}
          onCancel={() => setIsModalOpen(false)}
          onToast={onToast}
        />
      </Modal>
    </div>
  );
}

function CostForm({
  item,
  onSave,
  onCancel,
  onToast,
}: {
  item: CostItem | null;
  onSave: () => void;
  onCancel: () => void;
  onToast?: (message: string, variant: "success" | "error") => void;
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
        one_time_date:
          formData.recurrence_code === "ONE_TIME" && formData.one_time_date
            ? new Date(formData.one_time_date).toISOString()
            : null,
      };

      const res = await fetch(item ? `/api/costs/${item.id}` : "/api/costs", {
        method: item ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = data.message || t("payrollConfig.toastCostSaveError");
        onToast?.(msg, "error");
        setError(msg);
        return;
      }

      onToast?.(t("payrollConfig.toastCostSaved"), "success");
      onSave();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("payrollConfig.toastCostSaveError");
      onToast?.(msg, "error");
      setError(msg);
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
            onChange={(e) => setFormData((p) => ({ ...p, type_code: e.target.value as CostTypeCode }))}
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
            onChange={(e) => setFormData((p) => ({ ...p, recurrence_code: e.target.value as CostRecurrenceCode }))}
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
          className="h-20 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
