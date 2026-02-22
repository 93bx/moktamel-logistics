"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "./Modal";
import { FileUpload } from "./FileUpload";
import { LicensePlate } from "./LicensePlate";
import { useRouter } from "next/navigation";

const INPUT_BASE = "mt-1 w-full rounded-md px-3 py-2 text-sm text-primary bg-white dark:bg-zinc-900";
const INPUT_NEUTRAL = "border border-zinc-200 dark:border-zinc-700";
const INPUT_ERROR = "border border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-900/20";

type FieldErrorKey =
  | "workshop_type_code"
  | "workshop_name"
  | "start_date"
  | "end_date"
  | "cost"
  | "invoice_number"
  | "current_odometer";

function sanitizeCostInput(value: string): string {
  const digitsAndDot = value.replace(/[^\d.]/g, "");
  const parts = digitsAndDot.split(".");
  if (parts.length <= 1) return digitsAndDot;
  return parts[0] + "." + parts.slice(1).join("").slice(0, 2);
}

function sanitizeOdometerInput(value: string): string {
  return value.replace(/[^\d.]/g, "").split(".").slice(0, 2).join(".");
}

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
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldErrorKey, string>>>({});
  const [enteredAtPutIn, setEnteredAtPutIn] = useState<{
    workshop_name: boolean;
    cost: boolean;
    invoice_number: boolean;
  }>({ workshop_name: false, cost: false, invoice_number: false });
  const [form, setForm] = useState({
    workshop_type_code: "INTERNAL",
    workshop_name: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    cost: "",
    invoice_number: "",
    invoice_file_id: null as string | null,
    current_odometer: "",
    notes: "",
  });

  useEffect(() => {
    if (isOpen && vehicleId) {
      setFieldErrors({});
      setLoading(true);
      fetch(`/api/fleet/vehicles/${vehicleId}`)
        .then((res) => res.json())
        .then((data) => {
          setVehicle(data);
          const activeLog = data.maintenance_logs?.find((l: any) => !l.end_date);
          if (activeLog) {
            setForm({
              workshop_type_code: activeLog.workshop_type_code,
              workshop_name: activeLog.workshop_name ?? "",
              start_date: activeLog.start_date.split("T")[0],
              end_date: new Date().toISOString().split("T")[0],
              cost: activeLog.cost != null ? String(activeLog.cost) : "",
              invoice_number: activeLog.invoice_number ?? "",
              invoice_file_id: activeLog.invoice_file_id,
              current_odometer: data.current_odometer.toString(),
              notes: activeLog.notes ?? "",
            });
            setEnteredAtPutIn({
              workshop_name: !!(activeLog.workshop_name?.trim?.() ?? activeLog.workshop_name),
              cost: activeLog.cost != null && String(activeLog.cost).trim() !== "",
              invoice_number: !!(activeLog.invoice_number?.trim?.() ?? activeLog.invoice_number),
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
              notes: "",
            });
            setEnteredAtPutIn({ workshop_name: false, cost: false, invoice_number: false });
          }
          setLoading(false);
        });
    }
  }, [isOpen, vehicleId]);

  const isExiting = !!vehicle?.maintenance_logs?.find((l: any) => !l.end_date);
  const currentOdometerValue = vehicle?.current_odometer ?? 0;

  const validatePutIn = (): Partial<Record<FieldErrorKey, string>> => {
    const err: Partial<Record<FieldErrorKey, string>> = {};
    if (!form.workshop_type_code?.trim()) err.workshop_type_code = t("fleet.validationWorkshopTypeRequired");
    if (!form.workshop_name?.trim()) err.workshop_name = t("fleet.validationWorkshopNameRequired");
    if (!form.start_date?.trim()) err.start_date = t("fleet.validationStartDateRequired");
    const costNum = form.cost.trim() === "" ? NaN : parseFloat(form.cost);
    if (form.cost.trim() === "") err.cost = t("fleet.validationCostRequired");
    else if (Number.isNaN(costNum) || costNum <= 0) err.cost = t("fleet.validationCostMustBePositive");
    if (!form.invoice_number?.trim()) err.invoice_number = t("fleet.validationInvoiceNumberRequired");
    const odoNum = form.current_odometer.trim() === "" ? NaN : parseFloat(form.current_odometer);
    if (form.current_odometer.trim() === "") err.current_odometer = t("fleet.validationOdometerRequired");
    else if (Number.isNaN(odoNum) || odoNum < 0) err.current_odometer = t("fleet.validationOdometerMustBePositive");
    else if (odoNum < currentOdometerValue) err.current_odometer = t("fleet.validationOdometerMustBeAtLeast", { value: currentOdometerValue });
    return err;
  };

  const validateExit = (): Partial<Record<FieldErrorKey, string>> => {
    const err = validatePutIn();
    if (!form.end_date?.trim()) err.end_date = t("fleet.validationEndDateRequired");
    return err;
  };

  const getInputClass = (field: FieldErrorKey): string => {
    const hasError = !!fieldErrors[field];
    return `${INPUT_BASE} ${hasError ? INPUT_ERROR : INPUT_NEUTRAL}`;
  };

  const clearFieldError = (field: FieldErrorKey) => {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const onSave = async () => {
    const errors = isExiting ? validateExit() : validatePutIn();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    const endpoint = isExiting ? "exit" : "enter";
    try {
      const res = await fetch(`/api/fleet/vehicles/${vehicleId}/maintenance/${endpoint}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          cost: form.cost ? parseFloat(form.cost) : undefined,
          current_odometer: form.current_odometer ? parseFloat(form.current_odometer) : undefined,
          notes: form.notes || undefined,
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

  const costReadOnly = isExiting && enteredAtPutIn.cost;
  const invoiceReadOnly = isExiting && enteredAtPutIn.invoice_number;
  const workshopNameReadOnly = isExiting && enteredAtPutIn.workshop_name;

  const titleBase = isExiting ? t("fleet.exitMaintenance") : t("fleet.putInMaintenance");
  const titleNode = vehicle ? (
    <>
      {titleBase} — <LicensePlate value={vehicle.license_plate} size="md" /> {vehicle.model} {vehicle.year}
    </>
  ) : (
    titleBase
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={titleNode} maxWidth="2xl">
      {loading ? (
        <div className="py-10 text-center text-zinc-400">{t("common.loading")}</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-primary">{t("fleet.workshopType")}</label>
              <select
                value={form.workshop_type_code}
                onChange={(e) => {
                  setForm({ ...form, workshop_type_code: e.target.value });
                  clearFieldError("workshop_type_code");
                }}
                disabled={isExiting}
                className={getInputClass("workshop_type_code") + (isExiting ? " disabled:opacity-50" : "")}
              >
                <option value="INTERNAL">{t("fleet.internalMaintenance")}</option>
                <option value="EXTERNAL">{t("fleet.externalMaintenance")}</option>
                <option value="CONTRACT">{t("fleet.maintenanceContract")}</option>
              </select>
              {fieldErrors.workshop_type_code && (
                <div className="mt-0.5 text-sm text-red-600 dark:text-red-400">{fieldErrors.workshop_type_code}</div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-primary">{t("fleet.workshopName")}</label>
              <input
                value={form.workshop_name}
                onChange={(e) => {
                  setForm({ ...form, workshop_name: e.target.value });
                  clearFieldError("workshop_name");
                }}
                readOnly={workshopNameReadOnly}
                className={getInputClass("workshop_name") + (workshopNameReadOnly ? " bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed" : "")}
              />
              {fieldErrors.workshop_name && (
                <div className="mt-0.5 text-sm text-red-600 dark:text-red-400">{fieldErrors.workshop_name}</div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-primary">{t("fleet.startDate")}</label>
              <input
                type="date"
                value={form.start_date}
                onChange={(e) => {
                  setForm({ ...form, start_date: e.target.value });
                  clearFieldError("start_date");
                }}
                disabled={isExiting}
                className={getInputClass("start_date") + (isExiting ? " disabled:opacity-50" : "")}
              />
              {fieldErrors.start_date && (
                <div className="mt-0.5 text-sm text-red-600 dark:text-red-400">{fieldErrors.start_date}</div>
              )}
            </div>
            {isExiting && (
              <div>
                <label className="text-sm font-medium text-primary">{t("fleet.endDate")}</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => {
                    setForm({ ...form, end_date: e.target.value });
                    clearFieldError("end_date");
                  }}
                  className={getInputClass("end_date")}
                />
                {fieldErrors.end_date && (
                  <div className="mt-0.5 text-sm text-red-600 dark:text-red-400">{fieldErrors.end_date}</div>
                )}
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-primary">{t("fleet.cost")} (SAR)</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.cost}
                onChange={(e) => {
                  setForm({ ...form, cost: sanitizeCostInput(e.target.value) });
                  clearFieldError("cost");
                }}
                readOnly={costReadOnly}
                className={getInputClass("cost") + (costReadOnly ? " bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed" : "")}
              />
              {fieldErrors.cost && (
                <div className="mt-0.5 text-sm text-red-600 dark:text-red-400">{fieldErrors.cost}</div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-primary">{t("fleet.invoiceNumber")}</label>
              <input
                value={form.invoice_number}
                onChange={(e) => {
                  setForm({ ...form, invoice_number: e.target.value });
                  clearFieldError("invoice_number");
                }}
                readOnly={invoiceReadOnly}
                className={getInputClass("invoice_number") + (invoiceReadOnly ? " bg-zinc-100 dark:bg-zinc-800 cursor-not-allowed" : "")}
              />
              {fieldErrors.invoice_number && (
                <div className="mt-0.5 text-sm text-red-600 dark:text-red-400">{fieldErrors.invoice_number}</div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium text-primary">{t("fleet.currentOdometer")} (km)</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.current_odometer}
                onChange={(e) => {
                  setForm({ ...form, current_odometer: sanitizeOdometerInput(e.target.value) });
                  clearFieldError("current_odometer");
                }}
                className={getInputClass("current_odometer")}
              />
              {fieldErrors.current_odometer && (
                <div className="mt-0.5 text-sm text-red-600 dark:text-red-400">{fieldErrors.current_odometer}</div>
              )}
            </div>
            <FileUpload
              purpose_code="MAINTENANCE_INVOICE"
              label={t("fleet.uploadImage")}
              fileId={form.invoice_file_id}
              onFileIdChange={(fid) => setForm({ ...form, invoice_file_id: fid })}
            />
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-primary">{t("fleet.notes")}</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
                placeholder={t("fleet.notes")}
              />
            </div>
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

