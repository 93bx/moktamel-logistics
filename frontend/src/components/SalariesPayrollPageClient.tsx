"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useSalariesPayroll, useSalariesPayrollDetail, useCreateSalaryReceipt } from "@/hooks/use-salaries-payroll";
import { Modal } from "./Modal";
import { PlatformIcon } from "./PlatformIcon";
import { SalariesPayrollRow } from "@/lib/types/salaries-payroll";
import { useRouter } from "next/navigation";

interface SalariesPayrollPageClientProps {
  locale: string;
  initialMonth: string;
}

function StatCard({ label, value, subValue }: { label: string; value: string; subValue?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="text-sm text-primary/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-primary">{value}</div>
      {subValue && <div className="mt-1 text-sm text-primary/40">{subValue}</div>}
    </div>
  );
}

export function SalariesPayrollPageClient({ locale, initialMonth }: SalariesPayrollPageClientProps) {
  const t = useTranslations();
  const router = useRouter();
  const [month, setMonth] = useState(initialMonth);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data, loading, error, refresh } = useSalariesPayroll({
    month,
    status: statusFilter,
    search,
    page,
    pageSize,
  });

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement> | React.ChangeEvent<HTMLInputElement>) => {
    const newMonth = e.target.value;
    setMonth(newMonth);
    setPage(1);
    // update URL without refresh if needed, but here we just update state
  };

  const formatAmount = (v: number) =>
    v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
        <StatCard
          label={t("salariesPayroll.stats.activeEmployees")}
          value={data?.quickStats.activeEmployeesCount.toLocaleString() ?? "0"}
        />
        <StatCard
          label={t("salariesPayroll.stats.totalLoans")}
          value={formatAmount(data?.quickStats.totalLoansAmount ?? 0)}
        />
        <StatCard
          label={t("salariesPayroll.stats.totalDeductions")}
          value={formatAmount(data?.quickStats.totalDeductionsAmount ?? 0)}
        />
        <StatCard
          label={t("salariesPayroll.stats.totalSalariesDue")}
          value={formatAmount(data?.quickStats.totalSalariesDueAmount ?? 0)}
        />
        <StatCard
          label={t("salariesPayroll.stats.totalRevenue")}
          value={formatAmount(data?.quickStats.totalRevenueAmount ?? 0)}
        />
      </div>

      {/* Controls Row */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-primary/60">{t("salariesPayroll.month")}:</label>
            <input
              type="month"
              value={month}
              onChange={handleMonthChange}
              className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800"
            />
          </div>
          <div className="flex items-center gap-2">
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
          </div>
          <div className="flex items-center gap-2">
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
        </div>
        <button
          type="button"
          onClick={() => {
            /* Export logic */
          }}
          className="rounded-md bg-zinc-100 px-4 py-2 text-sm font-medium text-primary hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
        >
          {t("common.exportExcel")}
        </button>
      </div>

      {/* Main Table */}
      <div className="rounded-md border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-xs uppercase text-primary/60 dark:bg-zinc-800/60">
              <tr>
                <th className="px-4 py-3 text-left">{t("salariesPayroll.colEmployee")}</th>
                <th className="px-4 py-3 text-right">{t("salariesPayroll.colSalary")}</th>
                <th className="px-4 py-3 text-right">{t("salariesPayroll.colOrders")}</th>
                <th className="px-4 py-3 text-right">{t("salariesPayroll.colTargetDiff")}</th>
                <th className="px-4 py-3 text-right">{t("salariesPayroll.colDeductions")}</th>
                <th className="px-4 py-3 text-right">{t("salariesPayroll.colLoans")}</th>
                <th className="px-4 py-3 text-right">{t("salariesPayroll.colUnreceivedCash")}</th>
                <th className="px-4 py-3 text-center">{t("salariesPayroll.colStatus")}</th>
                <th className="px-4 py-3 text-right">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-primary/60">
                    {t("common.loading")}
                  </td>
                </tr>
              ) : data?.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-primary/60">
                    {t("common.noResults")}
                  </td>
                </tr>
              ) : (
                data?.items.map((row) => (
                  <tr key={row.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-zinc-200" />
                        <div>
                          <div className="font-medium text-primary leading-tight">
                            {locale === "ar" ? row.employee_name_ar : row.employee_name_en}
                          </div>
                          <div className="text-xs text-primary/40">{row.employee_code}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatAmount(row.base_salary)}</td>
                    <td className="px-4 py-3 text-right">{row.orders_count}</td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          row.target_difference >= 0 ? "text-emerald-600 font-semibold" : "text-red-600 font-semibold"
                        }
                      >
                        {row.target_difference > 0 ? `+${row.target_difference}` : row.target_difference}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">{formatAmount(row.total_deductions)}</td>
                    <td className="px-4 py-3 text-right">{formatAmount(row.total_outstanding_loans)}</td>
                    <td className="px-4 py-3 text-right">{formatAmount(row.total_unreceived_cash)}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold leading-none uppercase ${
                          row.status === "PAID"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                        }`}
                      >
                        {t(`salariesPayroll.status_${row.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => {
                            setSelectedEmployeeId(row.id);
                            setIsViewModalOpen(true);
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          {t("common.view")}
                        </button>
                        <button
                          onClick={() => {
                            /* Print logic */
                          }}
                          className="text-xs text-primary hover:underline"
                        >
                          {t("common.print")}
                        </button>
                        {row.status === "NOT_PAID" && (
                          <button
                            onClick={() => {
                              setSelectedEmployeeId(row.id);
                              setIsReceiptModalOpen(true);
                            }}
                            className="text-xs font-semibold text-primary hover:underline"
                          >
                            {t("salariesPayroll.addReceipt")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
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

      {/* View Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => {
          setIsViewModalOpen(false);
          setSelectedEmployeeId(null);
        }}
        title={t("salariesPayroll.viewEmployeeDetail")}
        maxWidth="lg"
      >
        <EmployeeDetailView
          id={selectedEmployeeId}
          locale={locale}
          onClose={() => setIsViewModalOpen(false)}
        />
      </Modal>

      {/* Add Receipt Modal */}
      <Modal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setSelectedEmployeeId(null);
        }}
        title={t("salariesPayroll.addSalaryReceipt")}
      >
        <AddReceiptForm
          id={selectedEmployeeId}
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

function EmployeeDetailView({
  id,
  locale,
  onClose,
}: {
  id: string | null;
  locale: string;
  onClose: () => void;
}) {
  const t = useTranslations();
  const { data, loading } = useSalariesPayrollDetail(id);

  if (loading) return <div className="py-8 text-center">{t("common.loading")}</div>;
  if (!data) return <div className="py-8 text-center">{t("common.noResults")}</div>;

  const formatAmount = (v: number) =>
    v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6 pt-4">
      {/* Employee Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-700">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-zinc-200" />
          <div>
            <h3 className="text-lg font-semibold text-primary leading-tight">
              {locale === "ar" ? data.employee_name_ar : data.employee_name_en}
            </h3>
            <div className="text-sm text-primary/40">{data.employee_code}</div>
          </div>
        </div>
        <div className="text-right">
          <span
            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold leading-none uppercase ${
              data.status === "PAID"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            }`}
          >
            {t(`salariesPayroll.status_${data.status}`)}
          </span>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-md border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="text-xs text-primary/60">{t("salariesPayroll.workingDays")}</div>
          <div className="text-lg font-semibold text-primary">{data.working_days}</div>
        </div>
        <div className="rounded-md border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="text-xs text-primary/60">{t("salariesPayroll.ordersCount")}</div>
          <div className="text-lg font-semibold text-primary">{data.orders_count}</div>
        </div>
        <div className="rounded-md border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="text-xs text-primary/60">{t("salariesPayroll.monthlyTarget")}</div>
          <div className="text-lg font-semibold text-primary">{data.monthly_target}</div>
        </div>
        <div className="rounded-md border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/50">
          <div className="text-xs text-primary/60">{t("salariesPayroll.targetDiff")}</div>
          <div
            className={`text-lg font-semibold ${
              data.target_difference >= 0 ? "text-emerald-600" : "text-red-600"
            }`}
          >
            {data.target_difference}
          </div>
        </div>
      </div>

      {/* Salary & Details Sections */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="space-y-4">
          <SectionHeader title={t("salariesPayroll.salarySection")} />
          <DetailRow label={t("salariesPayroll.basicSalary")} value={formatAmount(data.base_salary)} />
          <DetailRow label={t("salariesPayroll.deductionsTotal")} value={`-${formatAmount(data.total_deductions)}`} className="text-red-600" />
          <DetailRow label={t("salariesPayroll.scheduledLoans")} value={`-${formatAmount(data.scheduled_loan_installments)}`} className="text-red-600" />
          <DetailRow label={t("salariesPayroll.bonuses")} value={`+${formatAmount(data.total_bonus)}`} className="text-emerald-600" />
          <div className="border-t border-zinc-100 pt-2 dark:border-zinc-700">
            <DetailRow
              label={t("salariesPayroll.finalSalary")}
              value={formatAmount(data.salary_after_deductions)}
              className="text-lg font-bold text-primary"
            />
          </div>
        </div>

        <div className="space-y-4">
          <SectionHeader title={t("salariesPayroll.revenueSection")} />
          <div className={`rounded-lg p-4 ${data.total_revenue < data.average_cost ? "bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800" : "bg-zinc-50 dark:bg-zinc-800/50"}`}>
            <DetailRow label={t("salariesPayroll.totalRevenue")} value={formatAmount(data.total_revenue)} />
            <DetailRow label={t("salariesPayroll.averageCost")} value={formatAmount(data.average_cost)} />
            {data.total_revenue < data.average_cost && (
              <div className="mt-2 text-xs text-red-600 font-medium italic">
                {t("salariesPayroll.belowAverageCostHint")}
              </div>
            )}
          </div>

          <SectionHeader title={t("salariesPayroll.cashSection")} />
          <DetailRow label={t("salariesPayroll.totalLoans")} value={formatAmount(data.total_outstanding_loans)} />
          <DetailRow label={t("salariesPayroll.unreceivedCash")} value={formatAmount(data.total_unreceived_cash)} />
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          onClick={onClose}
          className="rounded-md border border-zinc-200 px-6 py-2 text-sm font-medium text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {t("common.close")}
        </button>
        <button
          onClick={() => {}}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          {t("common.printStatement")}
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <h4 className="text-sm font-semibold text-primary/80 uppercase tracking-wider">{title}</h4>;
}

function DetailRow({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-primary/60">{label}</span>
      <span className={`font-medium text-primary ${className}`}>{value}</span>
    </div>
  );
}

function AddReceiptForm({
  id,
  onSave,
  onCancel,
}: {
  id: string | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations();
  const { data: employee } = useSalariesPayrollDetail(id);
  const { createReceipt, loading, error } = useCreateSalaryReceipt();

  const [formData, setFormData] = useState({
    amount: employee?.salary_after_deductions ?? 0,
    paymentMethod: "BANK_TRANSFER" as const,
    paymentDate: new Date().toISOString().split("T")[0],
    attachmentUrl: "",
  });

  // Sync amount when employee data is loaded
  useState(() => {
    if (employee) {
      setFormData((p) => ({ ...p, amount: employee.salary_after_deductions }));
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    try {
      await createReceipt(id, formData);
      onSave();
    } catch (err) {
      // handled by hook
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
        <label className="text-sm font-medium text-primary">{t("salariesPayroll.receiptAmount")}</label>
        <input
          required
          type="number"
          step="0.01"
          value={formData.amount}
          onChange={(e) => setFormData((p) => ({ ...p, amount: Number(e.target.value) }))}
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-primary">{t("salariesPayroll.paymentMethod")}</label>
          <select
            required
            value={formData.paymentMethod}
            onChange={(e) => setFormData((p) => ({ ...p, paymentMethod: e.target.value as any }))}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="BANK_TRANSFER">{t("salariesPayroll.method_BANK_TRANSFER")}</option>
            <option value="CASH">{t("salariesPayroll.method_CASH")}</option>
            <option value="OTHER">{t("salariesPayroll.method_OTHER")}</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-primary">{t("salariesPayroll.paymentDate")}</label>
          <input
            required
            type="date"
            value={formData.paymentDate}
            onChange={(e) => setFormData((p) => ({ ...p, paymentDate: e.target.value }))}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-sm font-medium text-primary">{t("salariesPayroll.attachmentUrl")}</label>
        <input
          type="text"
          value={formData.attachmentUrl}
          onChange={(e) => setFormData((p) => ({ ...p, attachmentUrl: e.target.value }))}
          placeholder="https://..."
          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
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
          {loading ? t("common.saving") : t("salariesPayroll.saveReceipt")}
        </button>
      </div>
    </form>
  );
}

