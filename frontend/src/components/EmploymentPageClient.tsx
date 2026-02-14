"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Eye, Pencil, CheckCircle, Slash, Trash2, UserX, RotateCcw } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { PlatformIcon } from "./PlatformIcon";
import { EmploymentModal } from "./EmploymentModal";
import { EmploymentViewModal } from "./EmploymentViewModal";
import { Modal } from "./Modal";

type EmploymentListItem = {
  id: string;
  recruitment_candidate_id: string | null;
  employee_no: string | null;
  employee_code: string | null;
  full_name_ar: string | null;
  full_name_en: string | null;
  iqama_no: string | null;
  contract_end_at: string | null;
  iqama_expiry_at: string | null;
  passport_expiry_at: string | null;
  license_expiry_at: string | null;
  status_code: string;
  salary_amount: string | null;
  salary_currency_code: string | null;
  assigned_platform: string | null;
  platform_user_no: string | null;
  avatar_file_id: string | null;
  assets?: Array<{ id: string; asset: { type: string; name: string } }>;
  created_at: string;
  updated_at: string;
  recruitment_candidate: {
    full_name_ar: string;
    full_name_en: string | null;
  } | null;
};

interface EmploymentPageClientProps {
  locale: string;
  initialItems: EmploymentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function EmploymentPageClient({
  locale,
  initialItems,
  total,
  page,
  pageSize,
}: EmploymentPageClientProps) {
  const t = useTranslations();
  const [editId, setEditId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewEmploymentId, setViewEmploymentId] = useState<string | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<"ACTIVATE" | "DEACTIVATE" | "VIEW" | "DELETE" | "DESERT" | "RESTORE">("VIEW");
  const [selectedRecord, setSelectedRecord] = useState<EmploymentListItem | null>(null);

  const handleEdit = (id: string) => {
    setEditId(id);
    setIsModalOpen(true);
  };

  const handleAction = (record: EmploymentListItem, type: "ACTIVATE" | "DEACTIVATE" | "VIEW" | "DELETE" | "DESERT" | "RESTORE") => {
    if (type === "VIEW") {
      setViewEmploymentId(record.id);
      setViewModalOpen(true);
      return;
    }
    setSelectedRecord(record);
    setActionType(type);
    setIsActionModalOpen(true);
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
                          onClick={() => handleAction(r, "VIEW")}
                          className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          title={t("common.view")}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(r.id)}
                          className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          title={t("common.edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {r.status_code !== "EMPLOYMENT_STATUS_ACTIVE" ? (
                          <button
                            onClick={() => handleAction(r, "ACTIVATE")}
                            className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                            title={r.status_code === "EMPLOYMENT_STATUS_DEACTIVATED" ? t("common.reactivate") : t("common.activate")}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAction(r, "DEACTIVATE")}
                            className="rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title={t("common.deactivate")}
                          >
                            <Slash className="h-4 w-4" />
                          </button>
                        )}
                        {r.status_code !== "EMPLOYMENT_STATUS_ACTIVE" && r.status_code !== "EMPLOYMENT_STATUS_DESERTED" && (
                          <button
                            onClick={() => handleAction(r, "DESERT")}
                            className="rounded-md p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                            title={t("common.markAsDeserted")}
                          >
                            <UserX className="h-4 w-4" />
                          </button>
                        )}
                        {r.status_code === "EMPLOYMENT_STATUS_DESERTED" && (
                          <button
                            onClick={() => handleAction(r, "RESTORE")}
                            className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                            title={t("common.restoreToInProgress")}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                        {r.status_code !== "EMPLOYMENT_STATUS_ACTIVE" && (
                          <button
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
                  <td className="px-3 py-12 text-center text-zinc-400" colSpan={7}>
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
        isOpen={viewModalOpen}
        onClose={() => {
          setViewModalOpen(false);
          setViewEmploymentId(null);
        }}
        employmentId={viewEmploymentId}
        locale={locale}
        onEdit={(id) => {
          setViewModalOpen(false);
          setViewEmploymentId(null);
          setEditId(id);
          setIsModalOpen(true);
        }}
        onActivate={(r) => {
          setViewModalOpen(false);
          setViewEmploymentId(null);
          setSelectedRecord(r as EmploymentListItem);
          setActionType("ACTIVATE");
          setIsActionModalOpen(true);
        }}
        onDeactivate={(r) => {
          setViewModalOpen(false);
          setViewEmploymentId(null);
          setSelectedRecord(r as EmploymentListItem);
          setActionType("DEACTIVATE");
          setIsActionModalOpen(true);
        }}
        onDesert={(r) => {
          setViewModalOpen(false);
          setViewEmploymentId(null);
          setSelectedRecord(r as EmploymentListItem);
          setActionType("DESERT");
          setIsActionModalOpen(true);
        }}
        onRestore={(r) => {
          setViewModalOpen(false);
          setViewEmploymentId(null);
          setSelectedRecord(r as EmploymentListItem);
          setActionType("RESTORE");
          setIsActionModalOpen(true);
        }}
        onDelete={(r) => {
          setViewModalOpen(false);
          setViewEmploymentId(null);
          setSelectedRecord(r as EmploymentListItem);
          setActionType("DELETE");
          setIsActionModalOpen(true);
        }}
      />

      <ActionModal
        isOpen={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        type={actionType}
        record={selectedRecord}
        locale={locale}
      />
    </>
  );
}

function ActionModal({
  isOpen,
  onClose,
  type,
  record,
  locale,
}: {
  isOpen: boolean;
  onClose: () => void;
  type: "ACTIVATE" | "DEACTIVATE" | "VIEW" | "DELETE" | "DESERT" | "RESTORE";
  record: EmploymentListItem | null;
  locale: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveError = (data: { message?: unknown } | null, fallbackMessage: string): string => {
    const msg = data?.message;
    if (msg == null) return t("common.actionFailed");
    if (typeof msg === "object" && msg !== null && "error_code" in msg) {
      const obj = msg as { error_code: string; min?: number };
      const code = obj.error_code;
      try {
        if (code === "HR_EMPLOYMENT_ACTIVE_SALARY_MIN" && typeof obj.min === "number") {
          return t("common.employmentErrors.HR_EMPLOYMENT_ACTIVE_SALARY_MIN", { min: obj.min });
        }
        return t(`common.employmentErrors.${code}` as any);
      } catch {
        return fallbackMessage;
      }
    }
    if (typeof msg === "string" && msg.startsWith("HR_EMPLOYMENT_")) {
      try {
        return t(`common.employmentErrors.${msg}` as any);
      } catch {
        return msg;
      }
    }
    return typeof msg === "string" ? msg : t("common.actionFailed");
  };

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
        const newStatus =
          type === "ACTIVATE"
            ? "EMPLOYMENT_STATUS_ACTIVE"
            : type === "DESERT"
              ? "EMPLOYMENT_STATUS_DESERTED"
              : type === "RESTORE"
                ? "EMPLOYMENT_STATUS_UNDER_PROCEDURE"
                : "EMPLOYMENT_STATUS_DEACTIVATED";
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
        const data = await res.json().catch(() => ({}));
        setError(resolveError(data, t("common.actionFailed")));
        setSaving(false);
        return;
      }

      onClose();
      router.refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(resolveError({ message }, t("common.actionFailed")));
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!record) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/employment/${record.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status_code: "EMPLOYMENT_STATUS_DRAFT", notes: notes || undefined }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(resolveError(data, t("common.actionFailed")));
        setSaving(false);
        return;
      }
      onClose();
      router.refresh();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setError(resolveError({ message }, t("common.actionFailed")));
      setSaving(false);
    }
  };

  if (!record) return null;

  const getTitle = () => {
    if (type === "ACTIVATE") return record?.status_code === "EMPLOYMENT_STATUS_DEACTIVATED" ? t("common.reactivate") : t("common.activate");
    if (type === "DEACTIVATE") return t("common.deactivate");
    if (type === "DELETE") return t("common.delete");
    if (type === "DESERT") return t("common.markAsDeserted");
    if (type === "RESTORE") return t("common.restoreToInProgress");
    return "";
  };

  const displayName = record.full_name_ar || record.full_name_en || "-";

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={getTitle()}
      >
        <div className="space-y-4">
          {type === "DELETE" ? (
          <div className="space-y-4">
            {record.status_code === "EMPLOYMENT_STATUS_ACTIVE" ? (
              <p className="text-sm text-primary font-medium">
                {t("common.cannotDeleteActiveEmployee")}
              </p>
            ) : (
              <p className="text-sm text-red-600 font-medium">
                {t("common.confirmDeleteEmployee") || "Are you sure you want to delete this employee? This action cannot be undone."}
              </p>
            )}
            {error && <div className="text-xs text-red-600">{error}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md">
                {t("common.cancel")}
              </button>
              <button
                onClick={handleArchive}
                disabled={saving}
                className="px-4 py-2 text-sm text-white rounded-md bg-zinc-600 hover:bg-zinc-700 disabled:opacity-50"
              >
                {saving ? t("common.saving") : t("common.archive")}
              </button>
              {record.status_code !== "EMPLOYMENT_STATUS_ACTIVE" && (
                <button
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
              {type === "DESERT"
                ? t("common.confirmMarkAsDeserted", { name: displayName })
                : type === "RESTORE"
                  ? t("common.confirmRestoreToInProgress", { name: displayName })
                  : type === "ACTIVATE"
                    ? record?.status_code === "EMPLOYMENT_STATUS_DEACTIVATED"
                      ? t("common.confirmReactivate")
                      : t("common.confirmActivate") || "Are you sure you want to activate this employee? This will change status to Active."
                    : t("common.confirmDeactivate") || "Are you sure you want to deactivate this employee?"}
            </p>
            {type === "ACTIVATE" && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-400">
                <p>{t("common.employmentWarning") || "Note: Employee status cannot be set to Active unless all mandatory documents are uploaded and valid."}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">{t("common.notes")}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-primary"
                rows={3}
                required={type !== "DESERT" && type !== "RESTORE"}
              />
            </div>
            {error && <div className="text-xs text-red-600">{error}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md">
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className={`px-4 py-2 text-sm text-white rounded-md ${type === "ACTIVATE" ? "bg-emerald-600 hover:bg-emerald-700" : type === "DESERT" ? "bg-amber-600 hover:bg-amber-700" : type === "RESTORE" ? "bg-blue-600 hover:bg-blue-700" : "bg-red-600 hover:bg-red-700"}`}
              >
                {saving
                  ? t("common.saving")
                  : type === "DESERT"
                    ? t("common.markAsDeserted")
                    : type === "RESTORE"
                      ? t("common.restoreToInProgress")
                      : type === "ACTIVATE" && record?.status_code === "EMPLOYMENT_STATUS_DEACTIVATED"
                        ? t("common.reactivate")
                        : t("common.save")}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
    </>
  );
}

