"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Modal } from "./Modal";
import { FileUpload } from "./FileUpload";

interface VehicleFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
  vehicleId?: string | null;
}

type VehicleForm = {
  type_code: string;
  license_plate: string;
  model: string;
  year: string;
  vin: string;
  gps_tracker_id: string;
  current_odometer: string;
  purchase_date: string;
  purchase_price: string;
  purchase_condition: string;
  documents: {
    REGISTRATION: { number: string; expiry_date: string; file_id: string | null };
    INSURANCE: { number: string; expiry_date: string; file_id: string | null; issuer: string };
    CHECKUP: { expiry_date: string; file_id: string | null };
    OPERATING_CARD: { number: string; expiry_date: string; file_id: string | null };
  };
};

const INITIAL_FORM: VehicleForm = {
  type_code: "SEDAN",
  license_plate: "",
  model: "",
  year: new Date().getFullYear().toString(),
  vin: "",
  gps_tracker_id: "",
  current_odometer: "0",
  purchase_date: "",
  purchase_price: "",
  purchase_condition: "NEW",
  documents: {
    REGISTRATION: { number: "", expiry_date: "", file_id: null },
    INSURANCE: { number: "", expiry_date: "", file_id: null, issuer: "" },
    CHECKUP: { expiry_date: "", file_id: null },
    OPERATING_CARD: { number: "", expiry_date: "", file_id: null },
  },
};

export function VehicleFormModal({ isOpen, onClose, locale, vehicleId }: VehicleFormModalProps) {
  const router = useRouter();
  const t = useTranslations();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<VehicleForm>(INITIAL_FORM);

  useEffect(() => {
    if (isOpen) {
      if (vehicleId) {
        setLoading(true);
        fetch(`/api/fleet/vehicles/${vehicleId}`)
          .then((res) => res.json())
          .then((data) => {
            const docs: any = { ...INITIAL_FORM.documents };
            data.documents.forEach((d: any) => {
              docs[d.type_code] = {
                number: d.number || "",
                expiry_date: d.expiry_date ? d.expiry_date.split("T")[0] : "",
                file_id: d.file_id,
                issuer: d.issuer || "",
              };
            });

            setForm({
              type_code: data.type_code,
              license_plate: data.license_plate,
              model: data.model,
              year: data.year.toString(),
              vin: data.vin,
              gps_tracker_id: data.gps_tracker_id || "",
              current_odometer: data.current_odometer.toString(),
              purchase_date: data.purchase_date ? data.purchase_date.split("T")[0] : "",
              purchase_price: data.purchase_price ? data.purchase_price.toString() : "",
              purchase_condition: data.purchase_condition,
              documents: docs,
            });
            setLoading(false);
          })
          .catch(() => {
            setError("Failed to load vehicle");
            setLoading(false);
          });
      } else {
        setForm(INITIAL_FORM);
        setStep(1);
      }
    }
  }, [isOpen, vehicleId]);

  const onSave = async () => {
    setSaving(true);
    setError(null);

    const isEdit = !!vehicleId;
    const url = isEdit ? `/api/fleet/vehicles/${vehicleId}` : `/api/fleet/vehicles`;
    const method = isEdit ? "PATCH" : "POST";

    const documents = Object.entries(form.documents)
      .filter(([type, data]) => {
        if (type === "OPERATING_CARD" && form.type_code !== "MOTORCYCLE") return false;
        return data.expiry_date !== "";
      })
      .map(([type, data]) => ({
        type_code: type,
        ...data,
      }));

    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          year: parseInt(form.year),
          current_odometer: parseFloat(form.current_odometer),
          purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : undefined,
          documents,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.message ?? "Save failed");
      }

      onClose();
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const renderStep1 = () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className="text-sm font-medium text-primary">{t("fleet.vehicleType")}</label>
        <select
          value={form.type_code}
          onChange={(e) => setForm({ ...form, type_code: e.target.value })}
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="MOTORCYCLE">{t("fleet.motorcycle")}</option>
          <option value="SEDAN">{t("fleet.sedan")}</option>
          <option value="VAN">{t("fleet.van")}</option>
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-primary">{t("fleet.licensePlate")}</label>
        <input
          value={form.license_plate}
          onChange={(e) => setForm({ ...form, license_plate: e.target.value })}
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-sm font-medium text-primary">{t("fleet.model")}</label>
          <input
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div className="w-24">
          <label className="text-sm font-medium text-primary">{t("fleet.year")}</label>
          <input
            type="number"
            value={form.year}
            onChange={(e) => setForm({ ...form, year: e.target.value })}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>
      <div>
        <label className="text-sm font-medium text-primary">{t("fleet.vin")}</label>
        <input
          value={form.vin}
          onChange={(e) => setForm({ ...form, vin: e.target.value })}
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-primary">{t("fleet.gpsTrackerId")}</label>
        <input
          value={form.gps_tracker_id}
          onChange={(e) => setForm({ ...form, gps_tracker_id: e.target.value })}
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
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        <h4 className="mb-3 font-medium text-primary">{t("fleet.registration")}</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="text-sm text-primary">{t("fleet.docNumber")}</label>
            <input
              value={form.documents.REGISTRATION.number}
              onChange={(e) => setForm({
                ...form,
                documents: { ...form.documents, REGISTRATION: { ...form.documents.REGISTRATION, number: e.target.value } }
              })}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="text-sm text-primary">{t("fleet.expiryDate")}</label>
            <input
              type="date"
              value={form.documents.REGISTRATION.expiry_date}
              onChange={(e) => setForm({
                ...form,
                documents: { ...form.documents, REGISTRATION: { ...form.documents.REGISTRATION, expiry_date: e.target.value } }
              })}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <FileUpload
            purpose_code="VEHICLE_REGISTRATION"
            label={t("fleet.uploadImage")}
            fileId={form.documents.REGISTRATION.file_id}
            onFileIdChange={(fid) => setForm({
              ...form,
              documents: { ...form.documents, REGISTRATION: { ...form.documents.REGISTRATION, file_id: fid } }
            })}
          />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        <h4 className="mb-3 font-medium text-primary">{t("fleet.insurance")}</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-sm text-primary">{t("fleet.insuranceCompany")}</label>
            <input
              value={form.documents.INSURANCE.issuer}
              onChange={(e) => setForm({
                ...form,
                documents: { ...form.documents, INSURANCE: { ...form.documents.INSURANCE, issuer: e.target.value } }
              })}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="text-sm text-primary">{t("fleet.docNumber")}</label>
            <input
              value={form.documents.INSURANCE.number}
              onChange={(e) => setForm({
                ...form,
                documents: { ...form.documents, INSURANCE: { ...form.documents.INSURANCE, number: e.target.value } }
              })}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <div>
            <label className="text-sm text-primary">{t("fleet.expiryDate")}</label>
            <input
              type="date"
              value={form.documents.INSURANCE.expiry_date}
              onChange={(e) => setForm({
                ...form,
                documents: { ...form.documents, INSURANCE: { ...form.documents.INSURANCE, expiry_date: e.target.value } }
              })}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <FileUpload
            purpose_code="VEHICLE_INSURANCE"
            label={t("fleet.uploadImage")}
            fileId={form.documents.INSURANCE.file_id}
            onFileIdChange={(fid) => setForm({
              ...form,
              documents: { ...form.documents, INSURANCE: { ...form.documents.INSURANCE, file_id: fid } }
            })}
          />
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
        <h4 className="mb-3 font-medium text-primary">{t("fleet.periodicCheck")}</h4>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="text-sm text-primary">{t("fleet.expiryDate")}</label>
            <input
              type="date"
              value={form.documents.CHECKUP.expiry_date}
              onChange={(e) => setForm({
                ...form,
                documents: { ...form.documents, CHECKUP: { ...form.documents.CHECKUP, expiry_date: e.target.value } }
              })}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <FileUpload
            purpose_code="VEHICLE_CHECKUP"
            label={t("fleet.uploadImage")}
            fileId={form.documents.CHECKUP.file_id}
            onFileIdChange={(fid) => setForm({
              ...form,
              documents: { ...form.documents, CHECKUP: { ...form.documents.CHECKUP, file_id: fid } }
            })}
          />
        </div>
      </div>

      {form.type_code === "MOTORCYCLE" && (
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
          <h4 className="mb-3 font-medium text-primary">{t("fleet.operatingCard")}</h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="text-sm text-primary">{t("fleet.docNumber")}</label>
              <input
                value={form.documents.OPERATING_CARD.number}
                onChange={(e) => setForm({
                  ...form,
                  documents: { ...form.documents, OPERATING_CARD: { ...form.documents.OPERATING_CARD, number: e.target.value } }
                })}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="text-sm text-primary">{t("fleet.expiryDate")}</label>
              <input
                type="date"
                value={form.documents.OPERATING_CARD.expiry_date}
                onChange={(e) => setForm({
                  ...form,
                  documents: { ...form.documents, OPERATING_CARD: { ...form.documents.OPERATING_CARD, expiry_date: e.target.value } }
                })}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <FileUpload
              purpose_code="VEHICLE_OPERATING_CARD"
              label={t("fleet.uploadImage")}
              fileId={form.documents.OPERATING_CARD.file_id}
              onFileIdChange={(fid) => setForm({
                ...form,
                documents: { ...form.documents, OPERATING_CARD: { ...form.documents.OPERATING_CARD, file_id: fid } }
              })}
            />
          </div>
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <label className="text-sm font-medium text-primary">{t("fleet.purchaseDate")}</label>
        <input
          type="date"
          value={form.purchase_date}
          onChange={(e) => setForm({ ...form, purchase_date: e.target.value })}
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-primary">{t("fleet.purchasePrice")} (SAR)</label>
        <input
          type="number"
          value={form.purchase_price}
          onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-primary">{t("fleet.purchaseCondition")}</label>
        <select
          value={form.purchase_condition}
          onChange={(e) => setForm({ ...form, purchase_condition: e.target.value })}
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="NEW">{t("fleet.new")}</option>
          <option value="USED">{t("fleet.used")}</option>
        </select>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={vehicleId ? t("fleet.editVehicle") : t("fleet.addVehicle")}
      maxWidth="4xl"
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex items-center gap-2 ${step === s ? "text-primary" : "text-zinc-400"}`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${step === s ? "bg-primary text-white" : "bg-zinc-100 dark:bg-zinc-800"}`}
              >
                {s}
              </div>
              <span className="hidden text-sm font-medium sm:inline">
                {s === 1 ? t("fleet.basicInfo") : s === 2 ? t("fleet.documents") : t("fleet.financialInfo")}
              </span>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-400">{t("common.loading")}</div>
        ) : (
          <>
            {step === 1 && renderStep1()}
            {step === 2 && renderStep2()}
            {step === 3 && renderStep3()}
          </>
        )}

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
            {error}
          </div>
        )}

        <div className="flex justify-between gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800">
          <button
            onClick={step === 1 ? onClose : () => setStep(step - 1)}
            disabled={saving}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm text-primary hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            {step === 1 ? t("common.cancel") : t("common.back")}
          </button>
          <button
            onClick={step === 3 ? onSave : () => setStep(step + 1)}
            disabled={saving || loading}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
          >
            {step === 3 ? (saving ? t("common.saving") : t("common.save")) : t("common.next")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

