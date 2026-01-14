"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "./Modal";
import { EmployeeSearchBox } from "./EmployeeSearchBox";
import { Upload, Smartphone, HardHat, Shirt, ShoppingBag, Box, Trash2 } from "lucide-react";

type EmployeeAssets = {
  id: string;
  assets: Array<{
    id: string;
    status_code: string;
    condition_code: string;
    asset: { id: string; type: string; name: string; price: string; vehicle_id: string | null };
  }>;
};

type AssetLossReportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
  initialEmployeeId?: string | null;
};

export function AssetLossReportModal({ isOpen, onClose, locale, initialEmployeeId }: AssetLossReportModalProps) {
  const t = useTranslations();
  const [employeeId, setEmployeeId] = useState<string | null>(initialEmployeeId || null);
  const [employeeAssets, setEmployeeAssets] = useState<EmployeeAssets | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null);
  const [typeCode, setTypeCode] = useState("neglect");
  const [actionCode, setActionCode] = useState("DEDUCT_FROM_SALARY");
  const [assetValue, setAssetValue] = useState<string>("");
  const [installments, setInstallments] = useState<string>("1");
  const [notes, setNotes] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Mock permission check - in real app would come from auth context
  const hasEditPermission = true; 

  useEffect(() => {
    if (initialEmployeeId) setEmployeeId(initialEmployeeId);
    else setEmployeeId(null);
  }, [initialEmployeeId, isOpen]);

  useEffect(() => {
    if (!employeeId) {
      setEmployeeAssets(null);
      setSelectedAsset(null);
      setAssetValue("");
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
          const firstAsset = data.assets?.[0];
          setSelectedAsset(firstAsset?.id ?? null);
          setAssetValue(firstAsset?.asset?.price?.toString() ?? "");
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

  const handleAssetChange = (assetId: string) => {
    setSelectedAsset(assetId);
    const asset = employeeAssets?.assets.find(a => a.id === assetId);
    if (asset) {
      setAssetValue(asset.asset.price.toString());
    }
  };

  const getAssetIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'PHONE': return <Smartphone className="h-4 w-4" />;
      case 'HELMET': return <HardHat className="h-4 w-4" />;
      case 'VEST': return <Shirt className="h-4 w-4" />;
      case 'BAG': return <ShoppingBag className="h-4 w-4" />;
      default: return <Box className="h-4 w-4" />;
    }
  };

  const onSave = async () => {
    if (!employeeId || !selectedAsset) return;
    if (typeCode === "theft" && files.length === 0) {
      setError(t("assets.policeReportRequired"));
      return;
    }
    
    setSaving(true);
    setError(null);
    try {
      // In a real app with file uploads, use FormData
      const res = await fetch("/api/assets/loss-reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          employment_record_id: employeeId,
          asset_assignment_id: selectedAsset,
          type_code: typeCode.toUpperCase(),
          asset_value: Number(assetValue || 0),
          action_code: actionCode,
          installment_count: actionCode === "DEDUCT_IN_INSTALLMENTS" ? Number(installments || 1) : undefined,
          notes,
          // files would be handled here
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
    <Modal isOpen={isOpen} onClose={onClose} title={t("assets.newLossReport")}>
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-primary">{t("assets.selectEmployee")}</label>
          <EmployeeSearchBox value={employeeId} onChange={setEmployeeId} disabled={!!initialEmployeeId} />
        </div>

        {employeeAssets && (
          <div>
            <label className="text-sm font-medium text-primary">{t("assets.damagedAsset")}</label>
            <select
              value={selectedAsset || ""}
              onChange={(e) => handleAssetChange(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
            >
              {employeeAssets.assets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.asset.name}
                </option>
              ))}
            </select>
            <div className="mt-2 flex items-center gap-2 text-xs text-primary/60">
              {selectedAsset && getAssetIcon(employeeAssets.assets.find(a => a.id === selectedAsset)?.asset.type || "")}
              <span>{employeeAssets.assets.find(a => a.id === selectedAsset)?.asset.name}</span>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-primary">{t("assets.typeOfLoss")}</label>
            <select
              value={typeCode}
              onChange={(e) => setTypeCode(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="neglect">{t("assets.neglect")}</option>
              <option value="loss">{t("assets.loss")}</option>
              <option value="theft">{t("assets.theft")}</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-primary">{t("assets.estimatedValue")}</label>
            <input
              type="number"
              value={assetValue}
              readOnly={!hasEditPermission}
              onChange={(e) => setAssetValue(e.target.value)}
              className={`mt-1 w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-primary dark:border-zinc-700 ${!hasEditPermission ? 'bg-zinc-50 dark:bg-zinc-800' : 'bg-white dark:bg-zinc-900'}`}
            />
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-primary">{t("assets.processMethod")}</label>
          <select
            value={actionCode}
            onChange={(e) => setActionCode(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="DEDUCT_FROM_SALARY">{t("assets.directDeduction")}</option>
            <option value="DEDUCT_IN_INSTALLMENTS">{t("assets.installmentDeduction")}</option>
            <option value="ADMINISTRATIVE_EXEMPTION">{t("assets.adminExemption")}</option>
          </select>
          {actionCode === "DEDUCT_IN_INSTALLMENTS" && (
            <div className="mt-2">
              <label className="text-xs text-primary/60">{t("assets.installments")}</label>
              <input
                type="number"
                min={1}
                max={12}
                value={installments}
                onChange={(e) => setInstallments(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-primary">{t("assets.description")}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-primary">{t("assets.upload")} ({t("common.optional")}, max 3)</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {files.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 rounded bg-primary/10 px-2 py-1 text-xs text-primary">
                <span className="max-w-[100px] truncate">{file.name}</span>
                <button type="button" onClick={() => setFiles(prev => prev.filter((_, i) => i !== idx))}>
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
            {files.length < 3 && (
              <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-dashed border-zinc-300 hover:bg-zinc-50 dark:border-zinc-600 dark:hover:bg-zinc-800">
                <Upload className="h-4 w-4 text-zinc-400" />
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      const newFiles = Array.from(e.target.files);
                      setFiles(prev => [...prev, ...newFiles].slice(0, 3));
                    }
                  }}
                />
              </label>
            )}
          </div>
          {typeCode === "theft" && files.length === 0 && (
            <p className="mt-1 text-xs text-red-500">{t("assets.policeReportRequired")}</p>
          )}
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
            disabled={saving || !selectedAsset || !employeeId || (typeCode === "theft" && files.length === 0)}
            onClick={onSave}
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white shadow hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? t("common.saving") : (actionCode === 'ADMINISTRATIVE_EXEMPTION' && !hasEditPermission ? t("assets.requestApproval") : t("common.save"))}
          </button>
        </div>
      </div>
    </Modal>
  );
}
