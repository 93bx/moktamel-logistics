"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Modal } from "./Modal";
import { FileUpload } from "./FileUpload";
import { EmployeeSearchBox } from "./EmployeeSearchBox";

type EmployeeRow = {
  id: string;
  employee_no: string | null;
  full_name_ar: string;
  full_name_en: string;
  total_revenue: number;
  total_cash_collected: number;
  total_cash_not_collected: number;
  total_loans: number;
  total_deductions: number;
  status: "BALANCED" | "UNBALANCED";
};

type StatsResponse = {
  myWallet: number;
  cashNotCollected: number;
  totalLoans: number;
  cashCollected: number;
};

type TransactionItem = {
  id: string;
  date: string;
  type: string;
  status: string;
  amount: number;
  balance_after: number | null;
  receipt_no: string | null;
  description?: string | null;
};

type EmployeeDetail = {
  employee: { id: string; employee_no: string | null; recruitment_candidate?: { full_name_ar: string; full_name_en: string | null } | null };
  summary: { total_revenue: number; total_cash: number; total_loan: number; total_deductions: number; cash_not_collected?: number };
  transactions: TransactionItem[];
};

type EmployeeOption = {
  id: string;
  employee_no: string | null;
  recruitment_candidate?: { full_name_ar: string; full_name_en: string | null } | null;
};

type Props = {
  locale: string;
  list: { items: EmployeeRow[]; total: number; page: number; page_size: number };
  stats: StatsResponse;
  searchParams: { q?: string; status?: string; date_from?: string; date_to?: string };
  page: number;
  defaultDateFrom: string;
  defaultDateTo: string;
};

const formatAmount = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CashLoansPageClient({ locale, list, stats, searchParams, page, defaultDateFrom, defaultDateTo }: Props) {
  const t = useTranslations();
  const [viewing, setViewing] = useState<EmployeeRow | null>(null);
  const [viewData, setViewData] = useState<EmployeeDetail | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [receiveTarget, setReceiveTarget] = useState<EmployeeRow | null>(null);
  const [loanTarget, setLoanTarget] = useState<EmployeeRow | null>(null);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!viewing) return;
      setViewLoading(true);
      try {
        const res = await fetch(
          `/api/cash-loans/employees/${viewing.id}?date_from=${encodeURIComponent(searchParams.date_from ?? defaultDateFrom)}&date_to=${encodeURIComponent(searchParams.date_to ?? defaultDateTo)}`,
        );
        if (!res.ok) throw new Error("Failed");
        const data = (await res.json()) as EmployeeDetail;
        setViewData(data);
      } catch {
        setViewData(null);
      } finally {
        setViewLoading(false);
      }
    };
    fetchDetail();
  }, [viewing, searchParams.date_from, searchParams.date_to, defaultDateFrom, defaultDateTo]);

  const activeDateFrom = (searchParams.date_from ?? defaultDateFrom).slice(0, 10);
  const activeDateTo = (searchParams.date_to ?? defaultDateTo).slice(0, 10);

  return (
    <>
      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("cashLoans.stats.myWallet")} value={formatAmount(stats.myWallet)} />
        <StatCard label={t("cashLoans.stats.cashNotCollected")} value={formatAmount(stats.cashNotCollected)} />
        <StatCard label={t("cashLoans.stats.totalLoans")} value={formatAmount(stats.totalLoans)} />
        <StatCard label={t("cashLoans.stats.cashCollected")} value={formatAmount(stats.cashCollected)} />
      </div>

      {/* Controls */}
      <form className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" action={`/${locale}/cash-loans`} method="get">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder={t("cashLoans.searchPlaceholder")}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-800"
          />
          <select
            name="status"
            defaultValue={searchParams.status ?? ""}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800 sm:w-44"
          >
            <option value="">{t("cashLoans.statusAll")}</option>
            <option value="balanced">{t("cashLoans.statusBalanced")}</option>
            <option value="unbalanced">{t("cashLoans.statusUnbalanced")}</option>
          </select>
          <input
            type="date"
            name="date_from"
            max={today}
            defaultValue={activeDateFrom}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800 sm:w-40"
            aria-label={t("cashLoans.dateFrom")}
          />
          <input
            type="date"
            name="date_to"
            max={today}
            defaultValue={activeDateTo}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800 sm:w-40"
            aria-label={t("cashLoans.dateTo")}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            {t("common.filter")}
          </button>
          <button
            type="button"
            onClick={() => setHandoverOpen(true)}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow hover:bg-primary/90"
          >
            {t("cashLoans.handoverButton")}
          </button>
        </div>
      </form>

      {/* Table */}
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-primary">
            <thead className="border-b border-zinc-200 dark:border-zinc-700">
              <tr className={locale === "ar" ? "text-right" : "text-left"}>
                <th className="px-3 py-2">{t("cashLoans.colEmployee")}</th>
                <th className="px-3 py-2">{t("cashLoans.colCode")}</th>
                <th className="px-3 py-2">{t("cashLoans.colStatus")}</th>
                <th className="px-3 py-2">{t("cashLoans.colRevenue")}</th>
                <th className="px-3 py-2">{t("cashLoans.colCollected")}</th>
                <th className="px-3 py-2">{t("cashLoans.colNotCollected")}</th>
                <th className="px-3 py-2">{t("cashLoans.colLoans")}</th>
                <th className="px-3 py-2">{t("cashLoans.colDeductions")}</th>
                <th className="px-3 py-2 text-right">{t("cashLoans.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100 dark:border-zinc-700">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                        {(row.full_name_ar || row.full_name_en || "?").charAt(0)}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium">{row.full_name_ar}</span>
                        <span className="text-xs text-primary/60">{row.full_name_en}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{row.employee_no ?? "-"}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                        row.status === "BALANCED"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-amber-300 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {row.status === "BALANCED" ? t("cashLoans.statusBalanced") : t("cashLoans.statusUnbalanced")}
                    </span>
                  </td>
                  <td className="px-3 py-2">{formatAmount(row.total_revenue)}</td>
                  <td className="px-3 py-2">{formatAmount(row.total_cash_collected)}</td>
                  <td className="px-3 py-2">{formatAmount(row.total_cash_not_collected)}</td>
                  <td className="px-3 py-2">{formatAmount(row.total_loans)}</td>
                  <td className="px-3 py-2">{formatAmount(row.total_deductions)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-md border border-zinc-200 px-3 py-1 text-xs text-primary hover:bg-primary/5 dark:border-zinc-700"
                        onClick={() => setViewing(row)}
                      >
                        {t("common.view")}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-zinc-200 px-3 py-1 text-xs text-primary hover:bg-primary/5 dark:border-zinc-700"
                        onClick={() => setReceiveTarget(row)}
                      >
                        {t("cashLoans.receiveAction")}
                      </button>
                      <button
                        type="button"
                        className="rounded-md border border-zinc-200 px-3 py-1 text-xs text-primary hover:bg-primary/5 dark:border-zinc-700"
                        onClick={() => setLoanTarget(row)}
                      >
                        {t("cashLoans.loanAction")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.items.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-primary/60" colSpan={9}>
                    {t("common.noResults")}
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
          {t("common.total")}: {list.total} ({t("common.page")} {list.page})
        </div>
        <div className="flex gap-2">
          <Link
            className={`rounded-md border border-zinc-200 px-3 py-1 text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
            href={`/${locale}/cash-loans?q=${encodeURIComponent(searchParams.q ?? "")}&status=${encodeURIComponent(searchParams.status ?? "")}&date_from=${encodeURIComponent(
              searchParams.date_from ?? ""
            )}&date_to=${encodeURIComponent(searchParams.date_to ?? "")}&page=${page - 1}`}
          >
            {t("common.prev")}
          </Link>
          <Link
            className={`rounded-md border border-zinc-200 px-3 py-1 text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 ${page * list.page_size >= list.total ? "pointer-events-none opacity-50" : ""}`}
            href={`/${locale}/cash-loans?q=${encodeURIComponent(searchParams.q ?? "")}&status=${encodeURIComponent(searchParams.status ?? "")}&date_from=${encodeURIComponent(
              searchParams.date_from ?? ""
            )}&date_to=${encodeURIComponent(searchParams.date_to ?? "")}&page=${page + 1}`}
          >
            {t("common.next")}
          </Link>
        </div>
      </div>

      <ViewModal
        isOpen={!!viewing}
        loading={viewLoading}
        data={viewData}
        onClose={() => {
          setViewing(null);
          setViewData(null);
        }}
      />
      <ReceiveCashModal isOpen={!!receiveTarget} onClose={() => setReceiveTarget(null)} employee={receiveTarget} defaultDate={today} />
      <LoanModal isOpen={!!loanTarget} onClose={() => setLoanTarget(null)} employee={loanTarget} defaultDate={today} />
      <HandoverModal isOpen={handoverOpen} onClose={() => setHandoverOpen(false)} wallet={stats.myWallet} defaultDate={today} />
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

function ViewModal({ isOpen, onClose, data, loading }: { isOpen: boolean; onClose: () => void; data: EmployeeDetail | null; loading: boolean }) {
  const t = useTranslations();
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("cashLoans.viewTitle")} maxWidth="4xl">
      {loading ? (
        <div className="py-6 text-center text-primary/60">{t("common.loading")}</div>
      ) : data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <SummaryItem label={t("cashLoans.summaryRevenue")} value={formatAmount(data.summary.total_revenue)} />
            <SummaryItem label={t("cashLoans.summaryCash")} value={formatAmount(data.summary.total_cash)} />
            <SummaryItem label={t("cashLoans.summaryLoan")} value={formatAmount(data.summary.total_loan)} />
            <SummaryItem label={t("cashLoans.summaryDeductions")} value={formatAmount(data.summary.total_deductions)} />
          </div>
          <div className="max-h-80 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-700">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-50 text-xs uppercase text-primary/60 dark:bg-zinc-800/60">
                <tr>
                  <th className="px-3 py-2 text-left">{t("cashLoans.txnDate")}</th>
                  <th className="px-3 py-2 text-left">{t("cashLoans.txnType")}</th>
                  <th className="px-3 py-2 text-left">{t("cashLoans.txnAmount")}</th>
                  <th className="px-3 py-2 text-left">{t("cashLoans.txnBalanceAfter")}</th>
                  <th className="px-3 py-2 text-left">{t("cashLoans.txnReceipt")}</th>
                </tr>
              </thead>
              <tbody>
                {data.transactions.map((trow) => (
                  <tr key={trow.id} className="border-t border-zinc-100 dark:border-zinc-700">
                    <td className="px-3 py-2">{new Date(trow.date).toLocaleDateString()}</td>
                    <td className="px-3 py-2">{trow.type}</td>
                    <td className="px-3 py-2">{formatAmount(trow.amount)}</td>
                    <td className="px-3 py-2">{trow.balance_after !== null ? formatAmount(trow.balance_after) : "-"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{trow.receipt_no ?? "-"}</td>
                  </tr>
                ))}
                {data.transactions.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-center text-primary/60" colSpan={5}>
                      {t("common.noResults")}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="py-6 text-center text-primary/60">{t("common.noResults")}</div>
      )}
    </Modal>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="text-xs text-primary/60">{label}</div>
      <div className="text-lg font-semibold text-primary">{value}</div>
    </div>
  );
}

function ReceiveCashModal({ isOpen, onClose, employee, defaultDate }: { isOpen: boolean; onClose: () => void; employee: EmployeeRow | null; defaultDate: string }) {
  const t = useTranslations();
  const [date, setDate] = useState(defaultDate);
  const [amount, setAmount] = useState("");
  const [fileId, setFileId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EmployeeOption | null>(null);
  const [totalDue, setTotalDue] = useState<number>(0);
  const [loadingDue, setLoadingDue] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setDate(defaultDate);
      setAmount("");
      setFileId(null);
      setError(null);
      setSaving(false);
      if (employee) {
        setSelected({
          id: employee.id,
          employee_no: employee.employee_no,
          recruitment_candidate: { full_name_ar: employee.full_name_ar, full_name_en: employee.full_name_en },
        });
        setTotalDue(employee.total_cash_not_collected);
      }
    }
  }, [isOpen, defaultDate, employee]);

  const fetchDue = async (id: string) => {
    setLoadingDue(true);
    try {
      const res = await fetch(`/api/cash-loans/employees/${id}`);
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as EmployeeDetail;
      setTotalDue(data.summary.cash_not_collected ?? 0);
    } catch {
      setTotalDue(0);
    } finally {
      setLoadingDue(false);
    }
  };

  const submit = async (action: "draft" | "approve") => {
    if (!selected) return;
    if (action === "approve" && !fileId) {
      setError(t("cashLoans.attachmentRequired"));
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError(t("cashLoans.amountRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/cash-loans/receipts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employment_record_id: selected.id,
          amount: Number(amount),
          date: new Date(`${date}T00:00:00.000Z`).toISOString(),
          attachment_file_id: fileId,
          submit_action: action,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? "Failed");
      }
      onClose();
      window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("cashLoans.receiveTitle")}>
      {selected ? (
        <div className="space-y-4 text-sm">
          <div className="text-primary font-semibold">
            {selected.recruitment_candidate?.full_name_ar} / {selected.recruitment_candidate?.full_name_en} ({selected.employee_no ?? "-"})
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-primary">{t("common.date")}</label>
              <input
                type="date"
                max={defaultDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="text-sm text-primary">{t("cashLoans.totalDue")}</label>
              <input
                disabled
                value={loadingDue ? t("common.loading") : formatAmount(totalDue)}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-primary disabled:text-primary/60 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-primary">{t("cashLoans.searchEmployee")}</label>
              <EmployeeSearchBox
                value={selected.id}
                onChange={(id) => setSelected((prev) => (id === null ? null : prev))}
                onSelectOption={(opt) => {
                  const option = opt as EmployeeOption;
                  setSelected(option);
                  fetchDue(option.id);
                }}
                searchPath="/api/cash-loans/employees/search"
                placeholder={t("cashLoans.searchPlaceholder")}
              />
            </div>
            <div>
              <label className="text-sm text-primary">{t("cashLoans.amountReceived")}</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <FileUpload purpose_code="CASH_RECEIPT" label={t("cashLoans.receiptUpload")} required fileId={fileId} onFileIdChange={setFileId} accept="image/*" />
            </div>
          </div>
          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => submit("draft")}
              disabled={saving}
              className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              {saving ? t("common.saving") : t("cashLoans.saveDraft")}
            </button>
            <button
              type="button"
              onClick={() => submit("approve")}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? t("common.saving") : t("cashLoans.saveApprove")}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function LoanModal({ isOpen, onClose, employee, defaultDate }: { isOpen: boolean; onClose: () => void; employee: EmployeeRow | null; defaultDate: string }) {
  const t = useTranslations();
  const [date, setDate] = useState(defaultDate);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EmployeeOption | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDate(defaultDate);
      setAmount("");
      setReason("");
      setSaving(false);
      setError(null);
      if (employee) {
        setSelected({
          id: employee.id,
          employee_no: employee.employee_no,
          recruitment_candidate: { full_name_ar: employee.full_name_ar, full_name_en: employee.full_name_en },
        });
      }
    }
  }, [isOpen, defaultDate, employee]);

  const submit = async (action: "draft" | "approve") => {
    if (!selected) return;
    if (!amount || Number(amount) <= 0) {
      setError(t("cashLoans.amountRequired"));
      return;
    }
    if (action === "approve" && !reason.trim()) {
      setError(t("cashLoans.reasonRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/cash-loans/loans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employment_record_id: selected.id,
          amount: Number(amount),
          reason: reason || undefined,
          date: new Date(`${date}T00:00:00.000Z`).toISOString(),
          submit_action: action,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? "Failed");
      }
      onClose();
      window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("cashLoans.loanTitle")}>
      {selected ? (
        <div className="space-y-4 text-sm">
          <div className="text-primary font-semibold">
            {selected.recruitment_candidate?.full_name_ar} / {selected.recruitment_candidate?.full_name_en} ({selected.employee_no ?? "-"})
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="text-sm text-primary">{t("common.date")}</label>
              <input
                type="date"
                max={defaultDate}
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-primary">{t("cashLoans.searchEmployee")}</label>
              <EmployeeSearchBox
                value={selected.id}
                onChange={(id) => setSelected((prev) => (id === null ? null : prev))}
                onSelectOption={(opt) => setSelected(opt as EmployeeOption)}
                searchPath="/api/cash-loans/employees/search"
                placeholder={t("cashLoans.searchPlaceholder")}
              />
            </div>
            <div>
              <label className="text-sm text-primary">{t("cashLoans.loanAmount")}</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-sm text-primary">{t("cashLoans.loanReason")}</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900"
                placeholder={t("cashLoans.loanReasonPlaceholder")}
              />
            </div>
          </div>
          {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => submit("draft")}
              disabled={saving}
              className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              {saving ? t("common.saving") : t("cashLoans.saveDraft")}
            </button>
            <button
              type="button"
              onClick={() => submit("approve")}
              disabled={saving}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? t("common.saving") : t("cashLoans.saveApprove")}
            </button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function HandoverModal({ isOpen, onClose, wallet, defaultDate }: { isOpen: boolean; onClose: () => void; wallet: number; defaultDate: string }) {
  const t = useTranslations();
  const [rows, setRows] = useState<Array<{ statement: string; amount: string; receipt_file_id: string | null }>>([
    { statement: "", amount: "", receipt_file_id: null },
  ]);
  const [date, setDate] = useState(defaultDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setRows([{ statement: "", amount: "", receipt_file_id: null }]);
      setDate(defaultDate);
      setSaving(false);
      setError(null);
    }
  }, [isOpen, defaultDate]);

  const expensesTotal = rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);
  const handedOver = Math.max(0, wallet - expensesTotal);

  const updateRow = (idx: number, patch: Partial<(typeof rows)[number]>) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRow = () => setRows((prev) => [...prev, { statement: "", amount: "", receipt_file_id: null }]);
  const removeRow = (idx: number) => setRows((prev) => prev.filter((_, i) => i !== idx));

  const submit = async (action: "draft" | "approve") => {
    if (rows.length === 0) {
      setError(t("cashLoans.expenseRequired"));
      return;
    }
    if (action === "approve") {
      for (const r of rows) {
        if (!r.statement.trim() || !r.amount || Number(r.amount) <= 0) {
          setError(t("cashLoans.expenseValidation"));
          return;
        }
        if (!r.receipt_file_id) {
          setError(t("cashLoans.attachmentRequired"));
          return;
        }
      }
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/cash-loans/handover", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: new Date(`${date}T00:00:00.000Z`).toISOString(),
          expenses: rows.map((r) => ({
            statement: r.statement,
            amount: Number(r.amount || 0),
            receipt_file_id: r.receipt_file_id,
          })),
          submit_action: action,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message ?? "Failed");
      }
      onClose();
      window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("cashLoans.handoverTitle")} maxWidth="4xl">
      <div className="space-y-4 text-sm">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="text-sm text-primary">{t("cashLoans.walletBalance")}</label>
            <input
              disabled
              value={formatAmount(wallet)}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-primary disabled:text-primary/60 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="text-sm text-primary">{t("common.date")}</label>
            <input
              type="date"
              max={defaultDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 dark:border-zinc-700">
          <table className="min-w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-primary/60 dark:bg-zinc-800/60">
              <tr>
                <th className="px-3 py-2 text-left">{t("cashLoans.expenseStatement")}</th>
                <th className="px-3 py-2 text-left">{t("cashLoans.expenseAmount")}</th>
                <th className="px-3 py-2 text-left">{t("cashLoans.expenseReceipt")}</th>
                <th className="px-3 py-2 text-right">{t("cashLoans.colActions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr key={idx} className="border-t border-zinc-100 align-top dark:border-zinc-700">
                  <td className="px-3 py-2">
                    <input
                      value={row.statement}
                      onChange={(e) => updateRow(idx, { statement: e.target.value })}
                      className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900"
                      placeholder={t("cashLoans.expenseStatement")}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={row.amount}
                      onChange={(e) => updateRow(idx, { amount: e.target.value })}
                      className="w-32 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <FileUpload
                      purpose_code={`HANDOVER_EXP_${idx}`}
                      label={t("cashLoans.expenseReceipt")}
                      required={false}
                      fileId={row.receipt_file_id}
                      onFileIdChange={(id) => updateRow(idx, { receipt_file_id: id })}
                      accept="image/*"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    {rows.length > 1 ? (
                      <button type="button" className="text-xs text-primary hover:underline" onClick={() => removeRow(idx)}>
                        {t("cashLoans.removeRow")}
                      </button>
                    ) : (
                      <span className="text-xs text-primary/40">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <button
            type="button"
            onClick={addRow}
            className="rounded-md border border-dashed border-primary px-3 py-2 text-sm text-primary hover:bg-primary/5"
          >
            {t("cashLoans.addExpense")}
          </button>
          <div className="flex flex-col gap-1 text-right">
            <div className="text-xs text-primary/60">{t("cashLoans.expensesTotal")}</div>
            <div className="text-lg font-semibold text-primary">{formatAmount(expensesTotal)}</div>
            <div className="text-xs text-primary/60">{t("cashLoans.handedOverAmount")}</div>
            <div className="text-lg font-semibold text-primary">{formatAmount(handedOver)}</div>
          </div>
        </div>

        {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div>}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => submit("draft")}
            disabled={saving}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            {saving ? t("common.saving") : t("cashLoans.saveDraft")}
          </button>
          <button
            type="button"
            onClick={() => submit("approve")}
            disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("cashLoans.saveApprove")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

