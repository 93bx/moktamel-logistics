"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "./Modal";
import { EmployeeSearchBox } from "./EmployeeSearchBox";
import { Plus, Trash2, Upload } from "lucide-react";

type AssetItem = {
  type: "VEHICLE" | "DEVICE" | "TOOL" | "OTHER";
  description: string;
  estimated_value: number | null;
  file?: File | null;
};

export function AssetNewModal({ isOpen, onClose, locale }: { isOpen: boolean; onClose: () => void; locale: string }) {
  const t = useTranslations();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [handoverDate, setHandoverDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [assets, setAssets] = useState<AssetItem[]>([
    { type: "VEHICLE", description: "", estimated_value: null },
  ]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const updateAsset = (idx: number, patch: Partial<AssetItem>) => {
    setAssets((prev) => prev.map((a, i) => (i === idx ? { ...a, ...patch } : a)));
  };

  const addAsset = () => setAssets((prev) => [...prev, { type: "OTHER", description: "", estimated_value: null }]);
  const removeAsset = (idx: number) => setAssets((prev) => prev.filter((_, i) => i !== idx));

  const onSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/assets/assignments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employment_record_id: employeeId,
          receive_date: new Date(handoverDate).toISOString(),
          assets: assets.map((a) => ({
            type: a.type,
            name: a.description || a.type,
            price: a.estimated_value ?? 0,
          })),
          notes,
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

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("assets.newAsset")}>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-primary">{t("assets.selectEmployee")}</label>
          <EmployeeSearchBox value={employeeId} onChange={setEmployeeId} />
        </div>
        <div>
          <label className="text-sm font-medium text-primary">{t("assets.handoverDate")}</label>
          <input
            type="date"
            max={today}
            value={handoverDate}
            onChange={(e) => setHandoverDate(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-primary">{t("assets.assetsList")}</div>
            <button
              type="button"
              onClick={addAsset}
              className="flex items-center gap-1 rounded-md border border-primary/40 px-2 py-1 text-xs text-primary hover:bg-primary/5"
            >
              <Plus className="h-3 w-3" /> {t("common.add")}
            </button>
          </div>
          
          <div className="max-h-64 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-700">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-800">
                <tr className="border-b border-zinc-200 dark:border-zinc-700">
                  <th className="px-2 py-2 text-left">{t("assets.type")}</th>
                  <th className="px-2 py-2 text-left">{t("assets.description")}</th>
                  <th className="px-2 py-2 text-left">{t("assets.estimatedValue")}</th>
                  <th className="px-2 py-2 text-center">{t("assets.upload")}</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700">
                {assets.map((a, idx) => (
                  <tr key={idx}>
                    <td className="px-2 py-2">
                      <select
                        value={a.type}
                        onChange={(e) => updateAsset(idx, { type: e.target.value as any })}
                        className="w-full rounded border-zinc-200 bg-transparent py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <option value="VEHICLE">{t("assets.vehicle")}</option>
                        <option value="DEVICE">{t("assets.device")}</option>
                        <option value="TOOL">{t("assets.tool")}</option>
                        <option value="OTHER">{t("assets.other")}</option>
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        value={a.description}
                        onChange={(e) => updateAsset(idx, { description: e.target.value })}
                        className="w-full rounded border-zinc-200 bg-transparent py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                        placeholder={t("assets.description")}
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        value={a.estimated_value ?? ""}
                        onChange={(e) => updateAsset(idx, { estimated_value: e.target.value ? Number(e.target.value) : null })}
                        className="w-full rounded border-zinc-200 bg-transparent py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <label className="flex cursor-pointer items-center justify-center text-primary hover:text-primary/80">
                        <Upload className="h-4 w-4" />
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => updateAsset(idx, { file: e.target.files?.[0] || null })}
                        />
                      </label>
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => removeAsset(idx)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-primary">{t("common.notes")}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

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
            disabled={saving || !employeeId}
            onClick={onSave}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
