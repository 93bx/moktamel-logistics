"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Eye,
  Pencil,
  CheckCircle,
  Slash,
  Trash2,
  BadgeDollarSign,
  Layers,
  BarChart3,
} from "lucide-react";
import Tooltip from "@mui/material/Tooltip";
import { StatusBadge } from "./StatusBadge";
import { PlatformIcon } from "./PlatformIcon";
import { EmploymentModal } from "./EmploymentModal";
import { EmploymentViewModal, type EmploymentRecordForView } from "./EmploymentViewModal";
import { Modal } from "./Modal";
import type { EmploymentListItem } from "@/lib/types/employment";

function formatBasicSalaryCell(
  amount: string | null,
  currency: string | null,
  locale: string,
): string {
  if (amount == null || amount === "") return "—";
  const n = Number(amount);
  if (Number.isNaN(n)) return "—";
  const cur = currency?.trim() || "SAR";
  return `${n.toLocaleString(locale)} ${cur}`;
}

function deductionTooltipForCode(code: string | null, t: (key: string) => string): string {
  if (code === "DEDUCTION_FIXED") return t("employment.tooltipDeductionFixedSelected");
  if (code === "DEDUCTION_ORDERS_TIERS") return t("employment.tooltipDeductionOrdersTiersSelected");
  if (code === "DEDUCTION_REVENUE_TIERS") return t("employment.tooltipDeductionRevenueTiersSelected");
  return t("employment.tooltipTargetDeductionType");
}

function EmploymentDeductionMethodCell({
  code,
  tooltip,
}: {
  code: string | null;
  tooltip: string;
}) {
  const Icon =
    code === "DEDUCTION_FIXED"
      ? BadgeDollarSign
      : code === "DEDUCTION_ORDERS_TIERS"
        ? Layers
        : code === "DEDUCTION_REVENUE_TIERS"
          ? BarChart3
          : null;
  if (!Icon) {
    return <span className="text-zinc-400">—</span>;
  }
  return (
    <Tooltip
      title={tooltip}
      arrow
      placement="top"
      enterDelay={200}
      sx={{
        "& .MuiTooltip-tooltip": {
          backgroundColor: "rgba(0, 0, 0, 0.9)",
          fontSize: "0.75rem",
          maxWidth: "360px",
          padding: "8px 12px",
          whiteSpace: "pre-line",
        },
        "& .MuiTooltip-arrow": { color: "rgba(0, 0, 0, 0.9)" },
      }}
    >
      <span className="inline-flex cursor-help text-primary" tabIndex={0} aria-label={tooltip}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
      </span>
    </Tooltip>
  );
}

function formatTargetCell(
  r: EmploymentListItem,
  t: (key: string, values?: Record<string, string | number>) => string,
): string {
  if (r.target_type === "TARGET_TYPE_REVENUE") {
    if (r.monthly_target_amount == null || r.monthly_target_amount === "") return "—";
    return t("employment.tableTargetRevenue", { amount: String(r.monthly_target_amount) });
  }
  if (r.target_type === "TARGET_TYPE_ORDERS") {
    if (r.monthly_orders_target == null) return "—";
    return t("employment.tableTargetOrder", { count: r.monthly_orders_target });
  }
  return "—";
}

interface EmploymentPageClientProps {
  locale: string;
  initialItems: EmploymentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

function employmentViewRecordToListItem(r: EmploymentRecordForView): EmploymentListItem {
  return {
    id: r.id,
    recruitment_candidate_id: r.recruitment_candidate_id,
    employee_no: r.employee_no,
    employee_code: r.employee_code,
    full_name_ar: r.full_name_ar,
    full_name_en: r.full_name_en,
    iqama_no: r.iqama_no,
    custody_status: null,
    start_date_at: null,
    contract_end_at: r.contract_end_at,
    iqama_expiry_at: r.iqama_expiry_at,
    passport_expiry_at: r.passport_expiry_at,
    medical_expiry_at: null,
    license_expiry_at: r.license_expiry_at,
    status_code: r.status_code,
    salary_amount: r.salary_amount,
    salary_currency_code: r.salary_currency_code,
    target_type: r.target_type,
    target_deduction_type: r.target_deduction_type,
    monthly_orders_target: r.monthly_orders_target,
    monthly_target_amount: r.monthly_target_amount,
    cost_center_code: null,
    assigned_platform: r.assigned_platform,
    platform_user_no: r.platform_user_no,
    avatar_file_id: r.avatar_file_id,
    created_at: r.created_at,
    updated_at: r.updated_at,
    recruitment_candidate: r.recruitment_candidate,
  };
}

export function EmploymentPageClient(props: EmploymentPageClientProps) {
  const { locale, initialItems } = props;
  const t = useTranslations();
  const router = useRouter();
  const [editId, setEditId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<"ACTIVATE" | "DEACTIVATE" | "DELETE">("DELETE");
  const [selectedRecord, setSelectedRecord] = useState<EmploymentListItem | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewEmploymentId, setViewEmploymentId] = useState<string | null>(null);

  const handleEdit = (id: string) => {
    setEditId(id);
    setIsModalOpen(true);
  };

  const handleAction = (
    record: EmploymentListItem,
    type: "ACTIVATE" | "DEACTIVATE" | "VIEW" | "DELETE",
  ) => {
    if (type === "VIEW") {
      setViewEmploymentId(record.id);
      setIsViewOpen(true);
      return;
    }
    setSelectedRecord(record);
    setActionType(type);
    setIsActionModalOpen(true);
  };

  const closeView = () => {
    setIsViewOpen(false);
    setViewEmploymentId(null);
  };

  return (
    <>
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-primary">
            <thead className="border-b border-zinc-200 dark:border-zinc-700">
              <tr className={locale === "ar" ? "text-right" : "text-left"}>
                <th className="px-3 py-3 font-semibold">{t("common.personalPicture")}</th>
                <th className="px-3 py-3 font-semibold">{t("common.name")}</th>
                <th className="px-3 py-3 font-semibold">{t("common.employeeCode")}</th>
                <th className="px-3 py-3 font-semibold">{t("common.iqamaNumber")}</th>
                <th className="px-3 py-3 font-semibold">{t("common.status")}</th>
                <th className="px-3 py-3 font-semibold">{t("common.basicSalary")}</th>
                <th className="px-3 py-3 font-semibold">{t("common.deductionMethod")}</th>
                <th className="px-3 py-3 font-semibold">{t("common.target")}</th>
                <th className="px-3 py-3 font-semibold">{t("common.operatingPlatform")}</th>
                <th className="px-3 py-3 font-semibold text-right">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {initialItems.map((r) => (
                <tr key={r.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-700">
                  <td className="px-3 py-2">
                    <div className="h-10 w-10 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
                      {r.avatar_file_id ? (
                        <img
                          src={`/api/files/${r.avatar_file_id}/view`}
                          alt={r.full_name_en ?? ""}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-zinc-400 uppercase">
                          {(r.full_name_en || r.full_name_ar || "?")[0]}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col">
                      <span className="font-bold text-primary">{r.full_name_ar || "-"}</span>
                      <span className="text-xs text-primary/60">{r.full_name_en || "-"}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.employee_code || "-"}</td>
                  <td className="px-3 py-2">
                    {r.iqama_no || <span className="text-amber-600 italic">{t("common.inProcess")}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={r.status_code} />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                    {formatBasicSalaryCell(r.salary_amount, r.salary_currency_code, locale)}
                  </td>
                  <td className="px-3 py-2">
                    <EmploymentDeductionMethodCell
                      code={r.target_deduction_type}
                      tooltip={deductionTooltipForCode(r.target_deduction_type, t)}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">{formatTargetCell(r, t)}</td>
                  <td className="px-3 py-2">
                    {r.assigned_platform ? (
                      <div className="flex flex-col gap-0.5">
                        <PlatformIcon platform={r.assigned_platform} />
                        {r.platform_user_no ? (
                          <span className="font-semibold text-primary">{r.platform_user_no}</span>
                        ) : null}
                      </div>
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleAction(r, "VIEW")}
                        className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                        title={t("common.view")}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleEdit(r.id)}
                        className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                        title={t("common.edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {r.status_code !== "EMPLOYMENT_STATUS_ACTIVE" ? (
                        <button
                          type="button"
                          onClick={() => handleAction(r, "ACTIVATE")}
                          className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                          title={
                            r.status_code === "EMPLOYMENT_STATUS_DEACTIVATED"
                              ? t("common.reactivate")
                              : t("common.activate")
                          }
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAction(r, "DEACTIVATE")}
                          className="rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title={t("common.deactivate")}
                        >
                          <Slash className="h-4 w-4" />
                        </button>
                      )}
                      {r.status_code !== "EMPLOYMENT_STATUS_ACTIVE" && (
                        <button
                          type="button"
                          onClick={() => handleAction(r, "DELETE")}
                          className="rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title={t("common.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {initialItems.length === 0 && (
                <tr>
                  <td className="px-3 py-12 text-center text-zinc-400" colSpan={10}>
                    {t("common.noResults")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EmploymentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditId(null);
        }}
        locale={locale}
        employmentId={editId || undefined}
      />

      <EmploymentViewModal
        isOpen={isViewOpen}
        onClose={closeView}
        employmentId={viewEmploymentId}
        locale={locale}
        onEdit={(id) => {
          closeView();
          handleEdit(id);
        }}
        onActivate={(record) => {
          closeView();
          setSelectedRecord(employmentViewRecordToListItem(record));
          setActionType("ACTIVATE");
          setIsActionModalOpen(true);
        }}
        onDeactivate={(record) => {
          closeView();
          setSelectedRecord(employmentViewRecordToListItem(record));
          setActionType("DEACTIVATE");
          setIsActionModalOpen(true);
        }}
        onDesert={async (record) => {
          closeView();
          try {
            const res = await fetch(`/api/employment/${record.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ status_code: "EMPLOYMENT_STATUS_DESERTED" }),
            });
            if (res.ok) router.refresh();
          } catch {
            // ignore
          }
        }}
        onRestore={async (record) => {
          closeView();
          try {
            const res = await fetch(`/api/employment/${record.id}`, {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ status_code: "EMPLOYMENT_STATUS_UNDER_PROCEDURE" }),
            });
            if (res.ok) router.refresh();
          } catch {
            // ignore
          }
        }}
        onDelete={(record) => {
          closeView();
          setSelectedRecord(employmentViewRecordToListItem(record));
          setActionType("DELETE");
          setIsActionModalOpen(true);
        }}
      />

      <ActionModal
        isOpen={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        type={actionType}
        record={selectedRecord}
      />
    </>
  );
}

function ActionModal({
  isOpen,
  onClose,
  type,
  record,
}: {
  isOpen: boolean;
  onClose: () => void;
  type: "ACTIVATE" | "DEACTIVATE" | "DELETE";
  record: EmploymentListItem | null;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!record) return;
    setSaving(true);
    setError(null);

    try {
      let res;
      if (type === "DELETE") {
        res = await fetch(`/api/employment/${record.id}`, {
          method: "DELETE",
        });
      } else {
        const newStatus = type === "ACTIVATE" ? "EMPLOYMENT_STATUS_ACTIVE" : "EMPLOYMENT_STATUS_DEACTIVATED";
        res = await fetch(`/api/employment/${record.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status_code: newStatus,
            notes: notes,
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data?.message ?? "Action failed");
        setSaving(false);
        return;
      }

      onClose();
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed");
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!record) return;
    if (record.status_code === "EMPLOYMENT_STATUS_ACTIVE") return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/employment/${record.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status_code: "EMPLOYMENT_STATUS_DRAFT", notes: notes || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.message ?? "Action failed");
        setSaving(false);
        return;
      }
      onClose();
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Action failed");
      setSaving(false);
    }
  };

  if (!record) return null;

  const getTitle = () => {
    if (type === "ACTIVATE")
      return record?.status_code === "EMPLOYMENT_STATUS_DEACTIVATED"
        ? t("common.reactivate")
        : t("common.activate");
    if (type === "DEACTIVATE") return t("common.deactivate");
    if (type === "DELETE") return t("common.delete");
    return "";
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={getTitle()}>
      <div className="space-y-4">
        {type === "DELETE" ? (
          <div className="space-y-4">
            {record.status_code === "EMPLOYMENT_STATUS_ACTIVE" ? (
              <p className="text-sm text-primary font-medium">{t("common.cannotDeleteActiveEmployee")}</p>
            ) : (
              <p className="text-sm text-red-600 font-medium">
                {t("common.confirmDeleteEmployee") ||
                  "Are you sure you want to delete this employee? This action cannot be undone."}
              </p>
            )}
            {error && <div className="text-xs text-red-600">{error}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-md">
                {t("common.cancel")}
              </button>
              {record.status_code !== "EMPLOYMENT_STATUS_ACTIVE" && (
                <button
                  type="button"
                  onClick={handleArchive}
                  disabled={saving}
                  className="px-4 py-2 text-sm text-white rounded-md bg-zinc-600 hover:bg-zinc-700 disabled:opacity-50"
                >
                  {saving ? t("common.saving") : t("common.archive")}
                </button>
              )}
              {record.status_code !== "EMPLOYMENT_STATUS_ACTIVE" && (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={saving}
                  className="px-4 py-2 text-sm text-white rounded-md bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? t("common.deleting") : t("common.delete")}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              {type === "ACTIVATE"
                ? record?.status_code === "EMPLOYMENT_STATUS_DEACTIVATED"
                  ? t("common.confirmReactivate")
                  : t("common.confirmActivate") ||
                    "Are you sure you want to activate this employee? This will change status to Active."
                : t("common.confirmDeactivate") || "Are you sure you want to deactivate this employee?"}
            </p>
            <div>
              <label className="text-sm font-medium">{t("common.notes")}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                rows={3}
                required
              />
            </div>
            {error && <div className="text-xs text-red-600">{error}</div>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm border rounded-md">
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={saving}
                className={`px-4 py-2 text-sm text-white rounded-md ${type === "ACTIVATE" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
              >
                {saving
                  ? t("common.saving")
                  : type === "ACTIVATE" && record?.status_code === "EMPLOYMENT_STATUS_DEACTIVATED"
                    ? t("common.reactivate")
                    : t("common.save")}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
