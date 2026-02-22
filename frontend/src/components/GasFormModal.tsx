"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "./Modal";
import { FileUpload } from "./FileUpload";
import { LicensePlate } from "./LicensePlate";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";

const INPUT_BASE = "mt-1 w-full rounded-md px-3 py-2 text-sm text-primary bg-white dark:bg-zinc-900";
const INPUT_NEUTRAL = "border border-zinc-200 dark:border-zinc-700";
const INPUT_ERROR = "border border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-900/20";

type GasFieldErrorKey =
  | "date"
  | "vehicle_id"
  | "gas_quantity_liters"
  | "gas_cost"
  | "payment_method_code";

function sanitizePositiveNumber(value: string, maxDecimals = 2): string {
  const digitsAndDot = value.replace(/[^\d.]/g, "");
  const parts = digitsAndDot.split(".");
  if (parts.length <= 1) return digitsAndDot;
  return parts[0] + "." + parts.slice(1).join("").slice(0, maxDecimals);
}

type VehicleOption = {
  id: string;
  license_plate: string;
  model: string;
  year: number;
  vin: string;
  current_driver?: {
    id: string;
    full_name_ar: string;
    full_name_en: string | null;
    employee_code: string | null;
  } | null;
};

interface GasFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
  vehicleId: string | null;
}

export function GasFormModal({ isOpen, onClose, locale, vehicleId }: GasFormModalProps) {
  const t = useTranslations();
  const router = useRouter();
  const [vehicleSearchQuery, setVehicleSearchQuery] = useState("");
  const [vehicleSearchResults, setVehicleSearchResults] = useState<VehicleOption[]>([]);
  const [vehicleSearchLoading, setVehicleSearchLoading] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<GasFieldErrorKey, string>>>({});
  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    gas_quantity_liters: "",
    gas_cost: "",
    payment_method_code: "" as "" | "CASH" | "CARD" | "INVOICE",
    invoice_file_id: null as string | null,
    notes: "",
  });

  // Pre-fill vehicle when opened from row
  useEffect(() => {
    if (!isOpen) {
      setSelectedVehicle(null);
      setVehicleSearchQuery("");
      setVehicleSearchResults([]);
      setForm({
        date: new Date().toISOString().split("T")[0],
        gas_quantity_liters: "",
        gas_cost: "",
        payment_method_code: "",
        invoice_file_id: null,
        notes: "",
      });
      setFieldErrors({});
      return;
    }
    if (vehicleId) {
      setLoading(true);
      fetch(`/api/fleet/vehicles/${vehicleId}`)
        .then((res) => res.json())
        .then((data) => {
          const v: VehicleOption = {
            id: data.id,
            license_plate: data.license_plate,
            model: data.model,
            year: data.year,
            vin: data.vin,
            current_driver: data.current_driver
              ? {
                  id: data.current_driver.id,
                  full_name_ar: data.current_driver.full_name_ar,
                  full_name_en: data.current_driver.full_name_en,
                  employee_code: data.current_driver.employee_code,
                }
              : null,
          };
          setSelectedVehicle(v);
          setVehicleSearchQuery("");
          setVehicleSearchResults([]);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    } else {
      setSelectedVehicle(null);
      setLoading(false);
    }
  }, [isOpen, vehicleId]);

  // Debounced vehicle search
  useEffect(() => {
    if (!isOpen) return;
    const q = vehicleSearchQuery.trim();
    if (q.length < 1) {
      setVehicleSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setVehicleSearchLoading(true);
      fetch(`/api/fleet/vehicles/search?q=${encodeURIComponent(q)}`)
        .then((res) => res.json())
        .then((data) => {
          setVehicleSearchResults(Array.isArray(data) ? data : []);
          setVehicleSearchLoading(false);
        })
        .catch(() => {
          setVehicleSearchLoading(false);
          setVehicleSearchResults([]);
        });
    }, 300);
    return () => clearTimeout(timer);
  }, [isOpen, vehicleSearchQuery]);

  const validate = (): Partial<Record<GasFieldErrorKey, string>> => {
    const err: Partial<Record<GasFieldErrorKey, string>> = {};
    if (!form.date?.trim()) err.date = t("fleet.validationDateRequired");
    if (!selectedVehicle) err.vehicle_id = t("fleet.validationVehicleRequired");
    const qty = form.gas_quantity_liters.trim() === "" ? NaN : parseFloat(form.gas_quantity_liters);
    if (form.gas_quantity_liters.trim() === "") err.gas_quantity_liters = t("fleet.validationGasQuantityRequired");
    else if (Number.isNaN(qty) || qty <= 0) err.gas_quantity_liters = t("fleet.validationGasQuantityPositive");
    const cost = form.gas_cost.trim() === "" ? NaN : parseFloat(form.gas_cost);
    if (form.gas_cost.trim() === "") err.gas_cost = t("fleet.validationGasCostRequired");
    else if (Number.isNaN(cost) || cost <= 0) err.gas_cost = t("fleet.validationGasCostPositive");
    if (!form.payment_method_code) err.payment_method_code = t("fleet.validationPaymentMethodRequired");
    return err;
  };

  const getInputClass = (field: GasFieldErrorKey): string => {
    const hasError = !!fieldErrors[field];
    return `${INPUT_BASE} ${hasError ? INPUT_ERROR : INPUT_NEUTRAL}`;
  };

  const clearFieldError = (field: GasFieldErrorKey) => {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  };

  const onSave = async () => {
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    if (!selectedVehicle) return;

    setSaving(true);
    try {
      const res = await fetch("/api/fleet/gas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          vehicle_id: selectedVehicle.id,
          date: form.date,
          gas_quantity_liters: parseFloat(form.gas_quantity_liters),
          gas_cost: parseFloat(form.gas_cost),
          payment_method_code: form.payment_method_code,
          invoice_file_id: form.invoice_file_id || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.message ?? t("fleet.vehicleInMaintenanceCannotAddGas");
        alert(msg);
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

  const vehicleLabel = selectedVehicle
    ? `${selectedVehicle.license_plate} — ${selectedVehicle.model} ${selectedVehicle.year}`
    : "";

  const isRtl = locale === "ar";

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("fleet.gasForm")} maxWidth="2xl">
      {loading ? (
        <div className="py-10 text-center text-zinc-400">{t("common.loading")}</div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-primary">{t("fleet.date")} *</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => {
                  setForm({ ...form, date: e.target.value });
                  clearFieldError("date");
                }}
                className={getInputClass("date")}
              />
              {fieldErrors.date && (
                <div className="mt-0.5 text-sm text-red-600 dark:text-red-400">{fieldErrors.date}</div>
              )}
            </div>

            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-primary">{t("fleet.vehicle")} *</label>
              <div className="relative mt-1">
                {isRtl ? (
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                ) : (
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                )}
                <input
                  value={selectedVehicle ? vehicleLabel : vehicleSearchQuery}
                  onChange={(e) => {
                    setVehicleSearchQuery(e.target.value);
                    if (selectedVehicle) setSelectedVehicle(null);
                    clearFieldError("vehicle_id");
                  }}
                  onFocus={() => {
                    if (selectedVehicle) {
                      setVehicleSearchQuery(vehicleLabel);
                      setSelectedVehicle(null);
                    }
                  }}
                  placeholder={t("fleet.searchVehicle")}
                  className={`w-full rounded-md border bg-white py-2 text-sm text-primary dark:bg-zinc-900 ${fieldErrors.vehicle_id ? "border-red-500 bg-red-50 dark:border-red-600 dark:bg-red-900/20" : "border-zinc-200 dark:border-zinc-700"} ${isRtl ? "pr-10 pl-3" : "pl-10 pr-3"}`}
                />
              </div>
              {fieldErrors.vehicle_id && (
                <div className="mt-0.5 text-sm text-red-600 dark:text-red-400">{fieldErrors.vehicle_id}</div>
              )}
              <div className="max-h-48 overflow-y-auto rounded-md border border-zinc-100 dark:border-zinc-800 mt-1">
                {vehicleSearchLoading ? (
                  <div className="p-3 text-center text-sm text-zinc-400">{t("common.loading")}</div>
                ) : vehicleSearchResults.length > 0 ? (
                  vehicleSearchResults.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => {
                        setSelectedVehicle(v);
                        setVehicleSearchQuery("");
                        setVehicleSearchResults([]);
                        clearFieldError("vehicle_id");
                      }}
                      className="flex w-full items-center gap-2 border-b border-zinc-50 p-3 text-left hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                    >
                      <LicensePlate value={v.license_plate} size="sm" />
                      <span className="font-medium">{v.model}</span>
                      <span className="text-primary/60">{v.year}</span>
                      {v.current_driver && (
                        <span className="text-xs text-primary/50">
                          {locale === "ar" ? v.current_driver.full_name_ar : (v.current_driver.full_name_en ?? v.current_driver.full_name_ar)}
                          {v.current_driver.employee_code ? ` (${v.current_driver.employee_code})` : ""}
                        </span>
                      )}
                    </button>
                  ))
                ) : null}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-primary">{t("fleet.gasQuantityLiters")} *</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.gas_quantity_liters}
                onChange={(e) => {
                  setForm({ ...form, gas_quantity_liters: sanitizePositiveNumber(e.target.value) });
                  clearFieldError("gas_quantity_liters");
                }}
                placeholder="0"
                className={getInputClass("gas_quantity_liters")}
              />
              {fieldErrors.gas_quantity_liters && (
                <div className="mt-0.5 text-sm text-red-600 dark:text-red-400">{fieldErrors.gas_quantity_liters}</div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-primary">{t("fleet.gasCost")} * (SAR)</label>
              <input
                type="text"
                inputMode="decimal"
                value={form.gas_cost}
                onChange={(e) => {
                  setForm({ ...form, gas_cost: sanitizePositiveNumber(e.target.value) });
                  clearFieldError("gas_cost");
                }}
                placeholder="0"
                className={getInputClass("gas_cost")}
              />
              {fieldErrors.gas_cost && (
                <div className="mt-0.5 text-sm text-red-600 dark:text-red-400">{fieldErrors.gas_cost}</div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium text-primary">{t("fleet.paymentMethod")} *</label>
              <select
                value={form.payment_method_code}
                onChange={(e) => {
                  setForm({ ...form, payment_method_code: e.target.value as "CASH" | "CARD" | "INVOICE" });
                  clearFieldError("payment_method_code");
                }}
                className={getInputClass("payment_method_code")}
              >
                <option value="">{t("common.select")}</option>
                <option value="CASH">{t("fleet.paymentCash")}</option>
                <option value="CARD">{t("fleet.paymentCard")}</option>
                <option value="INVOICE">{t("fleet.paymentInvoice")}</option>
              </select>
              {fieldErrors.payment_method_code && (
                <div className="mt-0.5 text-sm text-red-600 dark:text-red-400">{fieldErrors.payment_method_code}</div>
              )}
            </div>

            <div className="sm:col-span-2">
              <FileUpload
                purpose_code="GAS_INVOICE"
                label={t("fleet.uploadInvoice")}
                fileId={form.invoice_file_id}
                onFileIdChange={(fid) => setForm({ ...form, invoice_file_id: fid })}
              />
            </div>

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
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow hover:bg-primary/90 disabled:opacity-50"
            >
              {saving ? t("common.saving") : t("fleet.addGasRecord")}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
