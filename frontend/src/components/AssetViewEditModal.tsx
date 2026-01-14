"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "./Modal";

type Assignment = {
  id: string;
  status_code: string;
  condition_code: string;
  receive_date: string;
  recovered_at: string | null;
  asset_record: string | null;
  asset_image_file_id: string | null;
  asset: { id: string; type: string; name: string; price: string; vehicle_id: string | null };
  employment_record: {
    id: string;
    employee_no: string | null;
    recruitment_candidate: { full_name_ar: string; full_name_en: string | null } | null;
  };
};

export function AssetViewEditModal({
  isOpen,
  onClose,
  locale,
  assignmentId,
}: {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
  assignmentId: string | null;
}) {
  const t = useTranslations();
  const [record, setRecord] = useState<Assignment | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [statusCode, setStatusCode] = useState("ASSIGNED");
  const [conditionCode, setConditionCode] = useState("GOOD");
  const [receiveDate, setReceiveDate] = useState("");
  const [assetRecord, setAssetRecord] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assignmentId || !isOpen) return;
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const res = await fetch(`/api/assets/assignments/${assignmentId}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message ?? "Failed");
        if (!cancelled) {
          setRecord(data);
          setStatusCode(data.status_code ?? "ASSIGNED");
          setConditionCode(data.condition_code ?? "GOOD");
          setReceiveDate(data.receive_date?.slice(0, 10) ?? "");
          setAssetRecord(data.asset_record ?? "");
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [assignmentId, isOpen]);

  const onSave = async () => {
    if (!assignmentId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/assets/assignments/${assignmentId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status_code: statusCode,
          condition_code: conditionCode,
          receive_date: receiveDate,
          asset_record: assetRecord,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message ?? "Failed");
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        setEditMode(false);
        onClose();
      }}
      title={t("assets.viewEditAsset")}
    >
      {!record ? (
        <div className="text-sm text-primary/60">{t("common.loading")}</div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-primary/60">
                {record.employment_record.recruitment_candidate ? `${record.employment_record.recruitment_candidate.full_name_ar} ${record.employment_record.recruitment_candidate.full_name_en ? `(${record.employment_record.recruitment_candidate.full_name_en})` : ""}` : record.employment_record.employee_no}
              </div>
              <div className="text-lg font-semibold text-primary">{record.asset.name}</div>
            </div>
            <button
              type="button"
              onClick={() => setEditMode((v) => !v)}
              className="rounded-md border border-zinc-200 px-2 py-1 text-sm text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
            >
              {editMode ? t("common.cancel") : t("common.edit")}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div>
              <label className="text-sm text-primary">{t("assets.status")}</label>
              <input
                value={statusCode}
                onChange={(e) => setStatusCode(e.target.value)}
                disabled={!editMode}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 disabled:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="text-sm text-primary">{t("assets.condition")}</label>
              <input
                value={conditionCode}
                onChange={(e) => setConditionCode(e.target.value)}
                disabled={!editMode}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 disabled:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="text-sm text-primary">{t("assets.receiveDate")}</label>
              <input
                type="date"
                value={receiveDate}
                onChange={(e) => setReceiveDate(e.target.value)}
                disabled={!editMode}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 disabled:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </div>

          <div>
            <label className="text-sm text-primary">{t("assets.assetRecord")}</label>
            <textarea
              value={assetRecord}
              onChange={(e) => setAssetRecord(e.target.value)}
              disabled={!editMode}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 disabled:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          {error ? <div className="text-sm text-red-600">{error}</div> : null}
          {editMode ? (
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setEditMode(false);
                  setRecord(null);
                  onClose();
                }}
                className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={onSave}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? t("common.saving") : t("common.save")}
              </button>
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}


