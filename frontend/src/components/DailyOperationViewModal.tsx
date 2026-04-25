"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "./Modal";
import { PlatformIcon } from "./PlatformIcon";
import { Pencil } from "lucide-react";

type OperatingPlatform = "NONE" | "JAHEZ" | "HUNGERSTATION" | "NINJA" | "KEETA";

export type DailyOperationListItem = {
  id: string;
  date: string;
  platform: OperatingPlatform;
  orders_count: number;
  total_revenue: string | number;
  cash_collected: string | number;
  cash_received?: string | number;
  difference_amount?: string | number;
  tips: string | number;
  work_hours?: string | number | null;
  deduction_amount: string | number;
  deduction_reason: string | null;
  is_draft?: boolean;
  approved_at?: string | null;
  approved_by_user_id?: string | null;
  status_code: string;
  employment_record: {
    id: string;
    employee_no: string | null;
    avatar_file_id?: string | null;
    recruitment_candidate: { full_name_ar: string; full_name_en: string | null } | null;
  } | null;
};

type DailyOpLogItem = {
  id: string;
  action: string;
  entity_id: string | null;
  old_values: unknown;
  new_values: unknown;
  created_at: string;
  actor_user_id: string | null;
  actor_name: string | null;
  actor_role: string | null;
};

const formatAmount = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusTone = (status: string) => {
  if (status === "FLAGGED_DEDUCTION") return "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700";
  if (status === "DRAFT") return "bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-700 dark:text-zinc-100 dark:border-zinc-600";
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700";
  if (status === "REVIEWED") return "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700";
  return "bg-primary/10 text-primary border-primary/30";
};

function statusLabel(status: string, t: (key: string) => string) {
  if (status === "FLAGGED_DEDUCTION") return t("dailyOps.statusFlagged");
  if (status === "APPROVED") return t("dailyOps.statusApproved");
  if (status === "DRAFT") return t("dailyOps.statusDraft");
  if (status === "REVIEWED") return t("dailyOps.statusReviewed");
  return t("dailyOps.statusRecorded");
}

function logActionLabel(action: string, t: (key: string) => string): string {
  const key = `dailyOps.logAction.${action}` as const;
  const map: Record<string, string> = {
    OPS_DAILY_CREATE_DRAFT: t("dailyOps.logAction.OPS_DAILY_CREATE_DRAFT"),
    OPS_DAILY_CREATE_APPROVED: t("dailyOps.logAction.OPS_DAILY_CREATE_APPROVED"),
    OPS_DAILY_BULK_DRAFT: t("dailyOps.logAction.OPS_DAILY_BULK_DRAFT"),
    OPS_DAILY_BULK_APPROVED: t("dailyOps.logAction.OPS_DAILY_BULK_APPROVED"),
    OPS_DAILY_STATUS_UPDATE: t("dailyOps.logAction.OPS_DAILY_STATUS_UPDATE"),
    OPS_DAILY_UPDATE: t("dailyOps.logAction.OPS_DAILY_UPDATE"),
    OPS_DAILY_DELETE: t("dailyOps.logAction.OPS_DAILY_DELETE"),
  };
  return map[action] ?? action;
}

export type EmployeeDisplay = {
  nameAr: string;
  nameEn: string | null;
  avatar_file_id?: string | null;
  employee_no: string | null;
  platform_user_no?: string | null;
} | undefined;

interface DailyOperationViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
  employeeId: string;
  employeeDisplay: EmployeeDisplay;
  dateFrom: string;
  dateTo: string;
  onEditRecord?: (record: DailyOperationListItem) => void;
}

export function DailyOperationViewModal({
  isOpen,
  onClose,
  locale,
  employeeId,
  employeeDisplay,
  dateFrom,
  dateTo,
  onEditRecord,
}: DailyOperationViewModalProps) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<"table" | "logs">("table");
  const [records, setRecords] = useState<DailyOperationListItem[]>([]);
  const [logs, setLogs] = useState<DailyOpLogItem[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  useEffect(() => {
    if (!isOpen || !employeeId || !dateFrom || !dateTo) return;
    setFilterFrom(dateFrom.slice(0, 10));
    setFilterTo(dateTo.slice(0, 10));
    setLoadingRecords(true);
    const url = `/api/daily-operations/records?employment_record_id=${encodeURIComponent(employeeId)}&date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}&page_size=200`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setRecords(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => setRecords([]))
      .finally(() => setLoadingRecords(false));
  }, [isOpen, employeeId, dateFrom, dateTo]);

  const logsDateFrom = filterFrom ? `${filterFrom}T00:00:00.000Z` : dateFrom;
  const logsDateTo = filterTo ? `${filterTo}T23:59:59.999Z` : dateTo;

  useEffect(() => {
    if (!isOpen || !employeeId) return;
    setLoadingLogs(true);
    const url = `/api/daily-operations/logs?employment_record_id=${encodeURIComponent(employeeId)}&date_from=${encodeURIComponent(logsDateFrom)}&date_to=${encodeURIComponent(logsDateTo)}`;
    fetch(url)
      .then((res) => res.json())
      .then((data) => {
        setLogs(Array.isArray(data?.items) ? data.items : []);
      })
      .catch(() => setLogs([]))
      .finally(() => setLoadingLogs(false));
  }, [isOpen, employeeId, logsDateFrom, logsDateTo]);

  const filteredRecords = useMemo(() => {
    if (!filterFrom && !filterTo) return records;
    const from = filterFrom ? new Date(filterFrom + "T00:00:00.000Z").getTime() : 0;
    const to = filterTo ? new Date(filterTo + "T23:59:59.999Z").getTime() : Number.MAX_SAFE_INTEGER;
    return records.filter((r) => {
      const time = new Date(r.date).getTime();
      return time >= from && time <= to;
    });
  }, [records, filterFrom, filterTo]);

  if (!isOpen) return null;

  const displayName =
    locale === "ar"
      ? (employeeDisplay?.nameAr || employeeDisplay?.nameEn || employeeDisplay?.employee_no || "—")
      : (employeeDisplay?.nameEn || employeeDisplay?.nameAr || employeeDisplay?.employee_no || "—");
  const initial = displayName && displayName !== "—" ? displayName.charAt(0).toUpperCase() : "?";

  const formatLogDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString(locale === "ar" ? "ar-SA" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("dailyOps.viewOperation")}
      maxWidth="4xl"
      contentClassName="p-0"
      modalClassName="max-h-[90vh] flex flex-col"
    >
      <div className="flex flex-col min-h-0">
        {/* Employee header */}
        <div className="shrink-0 border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-white px-6 py-5 dark:border-zinc-700 dark:from-zinc-800/80 dark:to-zinc-800">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700">
              {employeeDisplay?.avatar_file_id ? (
                <img
                  src={`/api/files/${employeeDisplay.avatar_file_id}/view`}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-2xl font-semibold text-primary">{initial}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-primary truncate">{displayName}</h3>
              {employeeDisplay?.employee_no && (
                <p className="text-sm text-primary/60 mt-0.5">
                  {t("common.employeeNo")}: {employeeDisplay.employee_no}
                </p>
              )}
              {employeeDisplay?.platform_user_no && (
                <p className="text-sm text-primary/60">
                  {t("common.platformUserNo")}: {employeeDisplay.platform_user_no}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Date filter (shared for both tabs) */}
        <div className="shrink-0 flex flex-wrap items-center gap-3 px-6 py-4 border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
          <span className="text-sm font-medium text-primary/80">{t("dailyOps.filterByDate")}:</span>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-600 dark:bg-zinc-700"
          />
          <span className="text-primary/50">–</span>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-600 dark:bg-zinc-700"
          />
          {activeTab === "table" && (
            <span className="text-sm text-primary/60">
              {filteredRecords.length} {t("dailyOps.recordsInRange")}
            </span>
          )}
          {activeTab === "logs" && (
            <span className="text-sm text-primary/60">
              {logs.length} {t("dailyOps.logsInRange")}
            </span>
          )}
        </div>

        {/* Tabs (same style as Fleet VehicleViewModal) */}
        <div className="flex border-b border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab("table")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "table" ? "border-b-2 border-primary text-primary" : "text-zinc-500 hover:text-primary"}`}
          >
            {t("dailyOps.tabTable")}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("logs")}
            className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "logs" ? "border-b-2 border-primary text-primary" : "text-zinc-500 hover:text-primary"}`}
          >
            {t("dailyOps.tabLogs")}
          </button>
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-auto px-6 pb-6">
          {activeTab === "table" && (
            <>
              {loadingRecords ? (
                <div className="py-12 text-center text-primary/60">{t("common.loading")}</div>
              ) : filteredRecords.length === 0 ? (
                <div className="py-12 text-center text-primary/60 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700">
                  {t("dailyOps.noResults")}
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-800/50 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-primary">
                      <thead>
                        <tr
                          className={`border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/80 ${locale === "ar" ? "text-right" : "text-left"}`}
                        >
                          <th className="px-4 py-3 font-semibold">{t("dailyOps.dateLabel")}</th>
                          <th className="px-4 py-3 font-semibold">{t("dailyOps.tablePlatform")}</th>
                          <th className="px-4 py-3 font-semibold">{t("dailyOps.tableOrders")}</th>
                          <th className="px-4 py-3 font-semibold">{t("dailyOps.tableRevenue")}</th>
                          <th className="px-4 py-3 font-semibold">{t("dailyOps.tableCash")}</th>
                          <th className="px-4 py-3 font-semibold">{t("dailyOps.tableTips")}</th>
                          <th className="px-4 py-3 font-semibold">{t("dailyOps.workHours")}</th>
                          <th className="px-4 py-3 font-semibold">{t("dailyOps.tableDeductions")}</th>
                          <th className="px-4 py-3 font-semibold">{t("dailyOps.tableStatus")}</th>
                          {onEditRecord ? (
                            <th className="px-4 py-3 font-semibold text-right">{t("common.actions")}</th>
                          ) : null}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRecords.map((record) => (
                          <tr
                            key={record.id}
                            className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-700/50 transition-colors"
                          >
                            <td className="px-4 py-3 whitespace-nowrap">
                              {record.date ? new Date(record.date).toISOString().slice(0, 10) : "—"}
                            </td>
                            <td className="px-4 py-3">
                              <PlatformIcon platform={record.platform} />
                            </td>
                            <td className="px-4 py-3">{record.orders_count}</td>
                            <td className="px-4 py-3">{formatAmount(record.total_revenue)}</td>
                            <td className="px-4 py-3">{formatAmount(record.cash_collected)}</td>
                            <td className="px-4 py-3">{formatAmount(record.tips)}</td>
                            <td className="px-4 py-3">{Number(record.work_hours ?? 0).toLocaleString()}</td>
                            <td className="px-4 py-3">
                              <div className="flex flex-col gap-0.5">
                                <span>{formatAmount(record.deduction_amount)}</span>
                                {record.deduction_reason && Number(record.deduction_amount) > 0 && (
                                  <span className="text-xs text-primary/60 max-w-[120px] truncate" title={record.deduction_reason}>
                                    {record.deduction_reason}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusTone(record.status_code)}`}
                              >
                                {statusLabel(record.status_code, t)}
                              </span>
                            </td>
                            {onEditRecord ? (
                              <td className="px-4 py-3 text-right">
                                {(record.status_code === "DRAFT" || record.status_code === "APPROVED") && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onEditRecord(record);
                                      onClose();
                                    }}
                                    title={t("common.edit")}
                                    aria-label={t("common.edit")}
                                    className="rounded-md border border-zinc-200 p-1.5 text-primary hover:bg-primary/10 dark:border-zinc-600 dark:hover:bg-zinc-600"
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </button>
                                )}
                              </td>
                            ) : null}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === "logs" && (
            <>
              {loadingLogs ? (
                <div className="py-12 text-center text-primary/60">{t("common.loading")}</div>
              ) : logs.length === 0 ? (
                <div className="py-12 text-center text-primary/60 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-700">
                  {t("dailyOps.noLogs")}
                </div>
              ) : (
                <div className="overflow-hidden rounded-md border border-zinc-100 dark:border-zinc-800">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                      <tr className={`${locale === "ar" ? "text-right" : "text-left"}`}>
                        <th className="px-3 py-2 font-semibold">{t("common.date")}</th>
                        <th className="px-3 py-2 font-semibold">{t("dailyOps.logActionColumn")}</th>
                        <th className="px-3 py-2 font-semibold">{t("common.name")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map((log) => (
                        <tr key={log.id} className="border-t border-zinc-100 dark:border-zinc-800">
                          <td className="px-3 py-2 whitespace-nowrap">{formatLogDate(log.created_at)}</td>
                          <td className="px-3 py-2">{logActionLabel(log.action, t)}</td>
                          <td className="px-3 py-2 font-medium">{log.actor_name ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
