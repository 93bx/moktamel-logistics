"use client";

import { useTranslations } from "next-intl";
import { Modal } from "./Modal";
import { PlatformIcon } from "./PlatformIcon";

type OperatingPlatform = "NONE" | "JAHEZ" | "HUNGERSTATION" | "NINJA" | "KEETA";

type DailyOperationListItem = {
  id: string;
  date: string;
  platform: OperatingPlatform;
  orders_count: number;
  total_revenue: string | number;
  cash_collected: string | number;
  cash_received?: string | number;
  difference_amount?: string | number;
  tips: string | number;
  deduction_amount: string | number;
  deduction_reason: string | null;
  loan_amount?: string | number;
  loan_reason?: string | null;
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

const formatAmount = (v: number | string | null | undefined) =>
  Number(v ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const statusTone = (status: string) => {
  if (status === "FLAGGED_DEDUCTION") return "bg-amber-100 text-amber-800 border-amber-300";
  if (status === "DRAFT") return "bg-zinc-100 text-zinc-800 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-600";
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800 border-emerald-300";
  if (status === "REVIEWED") return "bg-emerald-100 text-emerald-800 border-emerald-300";
  return "bg-primary/10 text-primary border-primary/30";
};

function statusLabel(status: string, t: (key: string) => string) {
  if (status === "FLAGGED_DEDUCTION") return t("dailyOps.statusFlagged");
  if (status === "APPROVED") return t("dailyOps.statusApproved");
  if (status === "DRAFT") return t("dailyOps.statusDraft");
  if (status === "REVIEWED") return t("dailyOps.statusReviewed");
  return t("dailyOps.statusRecorded");
}

interface DailyOperationViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: DailyOperationListItem | null;
}

export function DailyOperationViewModal({ isOpen, onClose, record }: DailyOperationViewModalProps) {
  const t = useTranslations();

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("dailyOps.viewOperation")} maxWidth="2xl">
      {!record ? (
        <div className="py-6 text-center text-primary/60">{t("common.noResults")}</div>
      ) : (
        <div className="space-y-6">
          {/* Employee block: avatar + name_ar + name_en */}
          {record.employment_record && (
            <div className="flex items-center gap-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                {record.employment_record.avatar_file_id ? (
                  <img
                    src={`/api/files/${record.employment_record.avatar_file_id}/view`}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-xl font-semibold text-primary">
                    {(record.employment_record.recruitment_candidate?.full_name_ar ||
                      record.employment_record.recruitment_candidate?.full_name_en ||
                      "?")[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-primary">
                  {record.employment_record.recruitment_candidate?.full_name_ar ?? "-"}
                </div>
                <div className="text-sm text-primary/70">
                  {record.employment_record.recruitment_candidate?.full_name_en ?? "-"}
                </div>
              </div>
            </div>
          )}

          {/* Daily operation fields */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <span className="text-xs font-medium text-primary/60">{t("dailyOps.dateLabel")}</span>
              <div className="mt-0.5 text-primary">
                {record.date ? new Date(record.date).toISOString().slice(0, 10) : "-"}
              </div>
            </div>
            <div>
              <span className="text-xs font-medium text-primary/60">{t("dailyOps.platform")}</span>
              <div className="mt-0.5">
                <PlatformIcon platform={record.platform} />
              </div>
            </div>
            <div>
              <span className="text-xs font-medium text-primary/60">{t("dailyOps.tableStatus")}</span>
              <div className="mt-0.5">
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusTone(record.status_code)}`}
                >
                  {statusLabel(record.status_code, t)}
                </span>
              </div>
            </div>
            <div>
              <span className="text-xs font-medium text-primary/60">{t("dailyOps.ordersCount")}</span>
              <div className="mt-0.5 text-primary">{record.orders_count}</div>
            </div>
            <div>
              <span className="text-xs font-medium text-primary/60">{t("dailyOps.totalRevenue")}</span>
              <div className="mt-0.5 text-primary">{formatAmount(record.total_revenue)}</div>
            </div>
            <div>
              <span className="text-xs font-medium text-primary/60">{t("dailyOps.cashCollected")}</span>
              <div className="mt-0.5 text-primary">{formatAmount(record.cash_collected)}</div>
            </div>
            <div>
              <span className="text-xs font-medium text-primary/60">{t("dailyOps.cashReceived")}</span>
              <div className="mt-0.5 text-primary">{formatAmount(record.cash_received)}</div>
            </div>
            <div>
              <span className="text-xs font-medium text-primary/60">{t("dailyOps.difference")}</span>
              <div className="mt-0.5 text-primary">
                {record.difference_amount != null
                  ? formatAmount(record.difference_amount)
                  : formatAmount(Number(record.cash_received ?? 0) - Number(record.cash_collected ?? 0))}
              </div>
            </div>
            <div>
              <span className="text-xs font-medium text-primary/60">{t("dailyOps.tableTips")}</span>
              <div className="mt-0.5 text-primary">{formatAmount(record.tips)}</div>
            </div>
            <div>
              <span className="text-xs font-medium text-primary/60">{t("dailyOps.tableDeductions")}</span>
              <div className="mt-0.5 text-primary">{formatAmount(record.deduction_amount)}</div>
              {record.deduction_amount && Number(record.deduction_amount) > 0 && record.deduction_reason && (
                <div className="mt-0.5 text-xs text-primary/70">{record.deduction_reason}</div>
              )}
            </div>
            <div>
              <span className="text-xs font-medium text-primary/60">{t("dailyOps.loanAmount")}</span>
              <div className="mt-0.5 text-primary">{formatAmount(record.loan_amount)}</div>
              {record.loan_amount && Number(record.loan_amount) > 0 && record.loan_reason && (
                <div className="mt-0.5 text-xs text-primary/70">{record.loan_reason}</div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
