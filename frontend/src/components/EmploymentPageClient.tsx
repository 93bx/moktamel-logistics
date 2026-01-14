"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Zap, Eye, Pencil, CheckCircle, Slash, Trash2 } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { PlatformIcon } from "./PlatformIcon";
import { AssetIcons } from "./AssetIcons";
import { EmploymentModal } from "./EmploymentModal";
import { Modal } from "./Modal";

type EmploymentListItem = {
  id: string;
  recruitment_candidate_id: string | null;
  employee_no: string | null;
  employee_code: string | null;
  full_name_ar: string | null;
  full_name_en: string | null;
  iqama_no: string | null;
  custody_status: string | null;
  start_date_at: string | null;
  contract_end_at: string | null;
  iqama_expiry_at: string | null;
  passport_expiry_at: string | null;
  medical_expiry_at: string | null;
  license_expiry_at: string | null;
  status_code: string;
  salary_amount: string | null;
  salary_currency_code: string | null;
  cost_center_code: string | null;
  assigned_platform: string | null;
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
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<"ACTIVATE" | "DEACTIVATE" | "VIEW" | "DELETE">("VIEW");
  const [selectedRecord, setSelectedRecord] = useState<EmploymentListItem | null>(null);

  const getNearestExpiry = (record: EmploymentListItem) => {
    const dates = [
      { name: t("common.iqamaNumber"), date: record.iqama_expiry_at },
      { name: t("common.passport"), date: record.passport_expiry_at },
      { name: t("common.employmentContract"), date: record.contract_end_at },
      { name: t("common.driversLicence"), date: record.license_expiry_at },
    ].filter((d) => d.date);

    if (dates.length === 0) return { name: "-", date: "-", isUrgent: false };

    const sorted = dates.sort(
      (a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime()
    );
    const nearest = sorted[0];
    const daysLeft = Math.ceil(
      (new Date(nearest.date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );

    return {
      name: nearest.name,
      date: new Date(nearest.date!).toISOString().split("T")[0],
      isUrgent: daysLeft < 30,
    };
  };

  const handleEdit = (id: string) => {
    setEditId(id);
    setIsModalOpen(true);
  };

  const handleAction = (record: EmploymentListItem, type: "ACTIVATE" | "DEACTIVATE" | "VIEW") => {
    setSelectedRecord(record);
    setActionType(type);
    setIsActionModalOpen(true);
  };

  return (
    <>
      {/* Warning Row */}
      <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-400">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          <p>{t("common.employmentWarning") || "Note: Employee status cannot be set to Active unless all mandatory documents are uploaded and valid."}</p>
        </div>
      </div>

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
                <th className="px-3 py-3 font-semibold">{t("assets.assets")}</th>
                <th className="px-3 py-3 font-semibold">{t("common.nearestExpiring")}</th>
                <th className="px-3 py-3 font-semibold text-right">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {initialItems.map((r) => {
                const nearest = getNearestExpiry(r);
                return (
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
                      {r.iqama_no || <span className="text-amber-600 italic">In Process</span>}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status_code} />
                    </td>
                    <td className="px-3 py-2">
                      {r.assigned_platform ? (
                        <PlatformIcon platform={r.assigned_platform} />
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <AssetIcons assets={r.assets?.map((a) => ({ type: a.asset.type })) || []} />
                    </td>
                    <td className={`px-3 py-2 ${nearest.isUrgent ? "bg-red-50 dark:bg-red-900/10" : ""}`}>
                      <div className="flex flex-col">
                        <span className={`text-xs font-medium ${nearest.isUrgent ? "text-red-700 dark:text-red-400" : "text-primary/70"}`}>
                          {nearest.name}
                        </span>
                        <span className={`text-[10px] ${nearest.isUrgent ? "text-red-600 dark:text-red-500 font-bold" : "text-primary/50"}`}>
                          {nearest.date}
                        </span>
                      </div>
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
                            title={t("common.activate")}
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
                        <button
                          onClick={() => handleAction(r, "DELETE")}
                          className="rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          title={t("common.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {initialItems.length === 0 && (
                <tr>
                  <td className="px-3 py-12 text-center text-zinc-400" colSpan={9}>
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
  type: "ACTIVATE" | "DEACTIVATE" | "VIEW" | "DELETE";
  record: EmploymentListItem | null;
  locale: string;
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
        const newStatus = type === "ACTIVATE" ? "EMPLOYMENT_STATUS_ACTIVE" : "DEACTIVATED";
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
    } catch (e: any) {
      setError(e?.message ?? "Action failed");
      setSaving(false);
    }
  };

  if (!record) return null;

  const getTitle = () => {
    if (type === "VIEW") return t("common.view");
    if (type === "ACTIVATE") return t("common.activate");
    if (type === "DEACTIVATE") return t("common.deactivate");
    if (type === "DELETE") return t("common.delete");
    return "";
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={getTitle()}
    >
      <div className="space-y-4">
        {type === "VIEW" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
               <div className="h-16 w-16 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
                  {record.avatar_file_id ? (
                    <img src={`/api/files/${record.avatar_file_id}/view`} className="h-full w-full object-cover" alt="" />
                  ) : null}
               </div>
               <div>
                  <h3 className="text-lg font-bold">{record.full_name_ar}</h3>
                  <p className="text-sm text-zinc-500">{record.full_name_en}</p>
               </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-zinc-400">{t("common.employeeCode")}:</span> {record.employee_code}</div>
              <div><span className="text-zinc-400">{t("common.iqamaNumber")}:</span> {record.iqama_no}</div>
              <div><span className="text-zinc-400">{t("common.status")}:</span> <StatusBadge status={record.status_code} /></div>
              <div><span className="text-zinc-400">{t("common.operatingPlatform")}:</span> {record.assigned_platform}</div>
            </div>
          </div>
        ) : type === "DELETE" ? (
          <div className="space-y-4">
            <p className="text-sm text-red-600 font-medium">
              {t("common.confirmDeleteEmployee") || "Are you sure you want to delete this employee? This action cannot be undone."}
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md">
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="px-4 py-2 text-sm text-white rounded-md bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? t("common.deleting") : t("common.delete")}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              {type === "ACTIVATE" 
                ? t("common.confirmActivate") || "Are you sure you want to activate this employee? This will change status to Active."
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
              <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md">
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className={`px-4 py-2 text-sm text-white rounded-md ${type === "ACTIVATE" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
              >
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

