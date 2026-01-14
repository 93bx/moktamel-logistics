"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "./Modal";
import { EmployeeSearchBox } from "./EmployeeSearchBox";
import { FileUpload } from "./FileUpload";

type EmployeeAssets = {
  id: string;
  recruitment_candidate: { full_name_ar: string; full_name_en: string | null } | null;
  assets: Array<{
    id: string;
    status_code: string;
    condition_code: string;
    receive_date: string;
    recovered_at: string | null;
    asset_record: string | null;
    asset_image_file_id: string | null;
    asset: { id: string; type: string; name: string; price: string; vehicle_id: string | null };
  }>;
};

type RecoveryState = {
  condition_code: string;
  received: boolean;
  asset_record: string;
  asset_image_file_id: string | null;
};

export function AssetRecoveryModal({ isOpen, onClose, locale }: { isOpen: boolean; onClose: () => void; locale: string }) {
  const t = useTranslations();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [employeeAssets, setEmployeeAssets] = useState<EmployeeAssets | null>(null);
  const [states, setStates] = useState<Record<string, RecoveryState>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!employeeId) {
      setEmployeeAssets(null);
      return;
    }
    let cancelled = false;
    async function load() {
      setError(null);
      try {
        const res = await fetch(`/api/assets/employees/${employeeId}/assets`);
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message ?? "Failed");
        if (!cancelled) {
          setEmployeeAssets(data);
          const initial: Record<string, RecoveryState> = {};
          data.assets.forEach((a: any) => {
            initial[a.id] = {
              condition_code: a.condition_code ?? "GOOD",
              received: a.status_code === "RECOVERED" || Boolean(a.recovered_at),
              asset_record: a.asset_record ?? "",
              asset_image_file_id: a.asset_image_file_id ?? null,
            };
          });
          setStates(initial);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  const updateState = (id: string, patch: Partial<RecoveryState>) => {
    setStates((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const onSave = async () => {
    if (!employeeAssets) return;
    setSaving(true);
    setError(null);
    try {
      for (const asset of employeeAssets.assets) {
        const s = states[asset.id];
        if (!s) continue;
        const res = await fetch("/api/assets/recover", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            assignment_id: asset.id,
            condition_code: s.condition_code,
            received: s.received,
            asset_record: s.asset_record,
            asset_image_file_id: s.asset_image_file_id,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message ?? "Failed");
      }
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("assets.receiveAsset")}>
      <div className="space-y-4">
        <div>
          <label className="text-sm text-primary">{t("assets.selectEmployee")}</label>
          <EmployeeSearchBox value={employeeId} onChange={setEmployeeId} />
        </div>

        {employeeAssets ? (
          <div className="space-y-3">
            {employeeAssets.assets.map((asset) => {
              const st = states[asset.id] ?? {
                condition_code: "GOOD",
                received: false,
                asset_record: "",
                asset_image_file_id: null,
              };
              return (
                <div key={asset.id} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-700">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-primary">{asset.asset.name}</div>
                    <div className="text-xs text-primary/60">{asset.status_code}</div>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div>
                      <label className="text-sm text-primary">{t("assets.condition")}</label>
                      <select
                        value={st.condition_code}
                        onChange={(e) => updateState(asset.id, { condition_code: e.target.value })}
                        className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <option value="GOOD">{t("assets.conditionGood")}</option>
                        <option value="FAIR">{t("assets.conditionFair")}</option>
                        <option value="POOR">{t("assets.conditionPoor")}</option>
                        <option value="DAMAGED">{t("assets.conditionDamaged")}</option>
                      </select>
                    </div>
                    <div className="flex items-end gap-2">
                      <label className="text-sm text-primary">{t("assets.received")}</label>
                      <input
                        type="checkbox"
                        checked={st.received}
                        onChange={(e) => updateState(asset.id, { received: e.target.checked })}
                        className="h-4 w-4"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-primary">{t("assets.assetImage")}</label>
                      <FileUpload
                        purpose_code="ASSET_IMAGE"
                        label={t("assets.assetImage")}
                        fileId={st.asset_image_file_id}
                        onFileIdChange={(id) => updateState(asset.id, { asset_image_file_id: id })}
                        accept="image/*"
                      />
                    </div>
                  </div>
                  <div className="mt-2">
                    <label className="text-sm text-primary">{t("assets.assetRecord")}</label>
                    <textarea
                      value={st.asset_record}
                      onChange={(e) => updateState(asset.id, { asset_record: e.target.value })}
                      className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}

        {error ? <div className="text-sm text-red-600">{error}</div> : null}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            disabled={saving || !employeeAssets}
            onClick={onSave}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("assets.saveRecovery")}
          </button>
        </div>
      </div>
    </Modal>
  );
}


