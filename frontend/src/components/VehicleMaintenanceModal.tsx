"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "./Modal";
import { FileUpload } from "./FileUpload";
import { useRouter } from "next/navigation";

interface VehicleMaintenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
  vehicleId: string | null;
}

export function VehicleMaintenanceModal({ isOpen, onClose, locale, vehicleId }: VehicleMaintenanceModalProps) {
  const t = useTranslations();
  const router = useRouter();
  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    workshop_type_code: "INTERNAL",
    workshop_name: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    cost: "",
    invoice_number: "",
    invoice_file_id: null as string | null,
    current_odometer: "",
  });

  useEffect(() => {
    if (isOpen && vehicleId) {
      setLoading(true);
      fetch(`/api/fleet/vehicles/${vehicleId}`)
        .then((res) => res.json())
        .then((data) => {
          setVehicle(data);
          const activeLog = data.maintenance_logs?.find((l: any) => !l.end_date);
          if (activeLog) {
            setForm({
              workshop_type_code: activeLog.workshop_type_code,
              workshop_name: activeLog.workshop_name,
              start_date: activeLog.start_date.split("T")[0],
              end_date: new Date().toISOString().split("T")[0],
              cost: activeLog.cost?.toString() || "",
              invoice_number: activeLog.invoice_number || "",
              invoice_file_id: activeLog.invoice_file_id,
              current_odometer: data.current_odometer.toString(),
            });
          } else {
            setForm({
              workshop_type_code: "INTERNAL",
              workshop_name: "",
              start_date: new Date().toISOString().split("T")[0],
              end_date: "",
              cost: "",
              invoice_number: "",
              invoice_file_id: null,
              current_odometer: data.current_odometer.toString(),
            });
          }
          setLoading(false);
        });
    }
  }, [isOpen, vehicleId]);

  const onSave = async () => {
    setSaving(true);
    const isExiting = !!vehicle?.maintenance_logs?.find((l: any) => !l.end_date);
    const endpoint = isExiting ? "exit" : "enter";
    try {
      const res = await fetch(`/api/fleet/vehicles/${vehicleId}/maintenance/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          cost: form.cost ? parseFloat(form.cost) : undefined,
          current_odometer: form.current_odometer ? parseFloat(form.current_odometer) : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.message);
        return;
      }
      onClose();
      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const isExiting = !!vehicle?.maintenance_logs?.find((l: any) => !l.end_date);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isExiting ? t("fleet.exitMaintenance") : t("fleet.putInMaintenance")} maxWidth="2xl">
      {loading ? (
        <div className="py-10 text-center text-zinc-400">{t("common.loading")}</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-primary">{t("fleet.workshopType")}</label>
              <select
                value={form.workshop_type_code}
                onChange={(e) => setForm({ ...form, workshop_type_code: e.target.value })}
                disabled={isExiting}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900 disabled:opacity-50"
              >
                <option value="INTERNAL">{t("fleet.internalMaintenance")}</option>
                <option value="EXTERNAL">{t("fleet.externalMaintenance")}</option>
                <option value="CONTRACT">{t("fleet.maintenanceContract")}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-primary">{t("fleet.workshopName")}</label>
              <input
                value={form.workshop_name}
                onChange={(e) => setForm({ ...form, workshop_name: e.target.value })}
                disabled={isExiting}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-primary">{t("fleet.startDate")}</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                disabled={isExiting}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900 disabled:opacity-50"
              />
            </div>
            {isExiting && (
              <div>
                <label className="text-sm font-medium text-primary">{t("fleet.endDate")}</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                  className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
                />
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-primary">{t("fleet.cost")} (SAR)</label>
              <input
                type="number"
                value={form.cost}
                onChange={(e) => setForm({ ...form, cost: e.target.value })}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-primary">{t("fleet.invoiceNumber")}</label>
              <input
                value={form.invoice_number}
                onChange={(e) => setForm({ ...form, invoice_number: e.target.value })}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-primary">{t("fleet.currentOdometer")} (km)</label>
              <input
                type="number"
                value={form.current_odometer}
                onChange={(e) => setForm({ ...form, current_odometer: e.target.value })}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <FileUpload
              purpose_code="MAINTENANCE_INVOICE"
              label={t("fleet.uploadImage")}
              fileId={form.invoice_file_id}
              onFileIdChange={(fid) => setForm({ ...form, invoice_file_id: fid })}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              onClick={onClose}
              className="rounded-md border border-zinc-200 px-4 py-2 text-sm text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className={`rounded-md px-4 py-2 text-sm font-medium text-white shadow hover:opacity-90 disabled:opacity-50 ${isExiting ? "bg-emerald-600" : "bg-amber-600"}`}
            >
              {saving ? t("common.saving") : isExiting ? t("fleet.exitMaintenance") : t("fleet.putInMaintenance")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

