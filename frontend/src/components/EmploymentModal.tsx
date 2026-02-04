"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Modal } from "./Modal";
import { FileUpload } from "./FileUpload";
import { StatusBadge } from "./StatusBadge";
import { PlatformIcon } from "./PlatformIcon";
import { AssetIcons } from "./AssetIcons";
import { NationalitySearchDropdown } from "./NationalitySearchDropdown";
import { FileImage, User } from "lucide-react";

interface EmploymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
  employmentId?: string; // If provided, we are in Edit mode
}

type Employment = {
  id?: string;
  recruitment_candidate_id: string | null;
  employee_no: string | null;
  employee_code: string | null;
  full_name_ar: string | null;
  full_name_en: string | null;
  nationality: string | null;
  phone: string | null;
  date_of_birth: string | null;
  iqama_no: string | null;
  iqama_expiry_at: string | null;
  iqama_file_id: string | null;
  passport_no: string | null;
  passport_expiry_at: string | null;
  passport_file_id: string | null;
  contract_no: string | null;
  contract_end_at: string | null;
  contract_file_id: string | null;
  license_expiry_at: string | null;
  license_file_id: string | null;
  promissory_note_file_id: string | null;
  avatar_file_id: string | null;
  custody_status: string | null;
  start_date_at: string | null;
  medical_expiry_at: string | null;
  status_code: string;
  salary_amount: string | null;
  salary_currency_code: string | null;
  cost_center_code: string | null;
  assigned_platform: string | null;
  platform_user_no: string | null;
  job_type: string | null;
  notes?: string | null;
  assets?: Array<{ id: string; asset: { type: string; name: string } }>;
};

const INITIAL_RECORD: Employment = {
  recruitment_candidate_id: null,
  employee_no: null,
  employee_code: null,
  full_name_ar: null,
  full_name_en: null,
  nationality: null,
  phone: null,
  date_of_birth: null,
  iqama_no: null,
  iqama_expiry_at: null,
  iqama_file_id: null,
  passport_no: null,
  passport_expiry_at: null,
  passport_file_id: null,
  contract_no: null,
  contract_end_at: null,
  contract_file_id: null,
  license_expiry_at: null,
  license_file_id: null,
  promissory_note_file_id: null,
  avatar_file_id: null,
  custody_status: null,
  start_date_at: null,
  medical_expiry_at: null,
  status_code: "EMPLOYMENT_STATUS_UNDER_PROCEDURE",
  salary_amount: null,
  salary_currency_code: "SAR",
  cost_center_code: null,
  assigned_platform: null,
  platform_user_no: null,
  job_type: null,
};

export function EmploymentModal({ isOpen, onClose, locale, employmentId }: EmploymentModalProps) {
  const router = useRouter();
  const t = useTranslations();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [record, setRecord] = useState<Employment>(INITIAL_RECORD);

  useEffect(() => {
    if (isOpen) {
      setSaving(false);
      setLoading(false);
      if (employmentId) {
        setLoading(true);
        fetch(`/api/employment/${employmentId}`)
          .then((res) => res.json())
          .then((data) => {
            setRecord(data);
            setLoading(false);
          })
          .catch(() => {
            setError("Failed to load record");
            setLoading(false);
          });
      } else {
        setRecord(INITIAL_RECORD);
        setStep(1);
      }
    }
  }, [isOpen, employmentId]);

  const handleClose = () => {
    setStep(1);
    setError(null);
    setSaving(false);
    setLoading(false);
    onClose();
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);

    const isEdit = !!employmentId;
    const url = isEdit ? `/api/employment/${employmentId}` : `/api/employment/new`;
    const method = isEdit ? "PATCH" : "POST";

    const payload = {
      recruitment_candidate_id: record.recruitment_candidate_id,
      employee_no: record.employee_no || null,
      employee_code: record.employee_code || null,
      full_name_ar: record.full_name_ar || null,
      full_name_en: record.full_name_en || null,
      nationality: record.nationality || null,
      phone: record.phone || null,
      date_of_birth: record.date_of_birth || null,
      iqama_no: record.iqama_no || null,
      iqama_expiry_at: record.iqama_expiry_at || null,
      iqama_file_id: record.iqama_file_id || null,
      passport_no: record.passport_no || null,
      passport_expiry_at: record.passport_expiry_at || null,
      passport_file_id: record.passport_file_id || null,
      contract_no: record.contract_no || null,
      contract_end_at: record.contract_end_at || null,
      contract_file_id: record.contract_file_id || null,
      license_expiry_at: record.license_expiry_at || null,
      license_file_id: record.license_file_id || null,
      promissory_note_file_id: record.promissory_note_file_id || null,
      avatar_file_id: record.avatar_file_id || null,
      custody_status: record.custody_status || null,
      start_date_at: record.start_date_at || null,
      medical_expiry_at: record.medical_expiry_at || null,
      status_code: record.status_code,
      salary_amount: record.salary_amount ? Number(record.salary_amount) : null,
      salary_currency_code: record.salary_currency_code || "SAR",
      cost_center_code: record.cost_center_code || null,
      assigned_platform: record.assigned_platform || null,
      platform_user_no: record.platform_user_no || null,
      job_type: record.job_type || null,
      notes: record.notes || null,
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data?.message ?? "Save failed");
        setSaving(false);
        return;
      }

      handleClose();
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Save failed");
      setSaving(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="flex items-end gap-4">
        <div className="w-1/3">
          <FileUpload
            purpose_code="avatar"
            label={t("common.avatar")}
            fileId={record.avatar_file_id}
            onFileIdChange={(id) => setRecord({ ...record, avatar_file_id: id })}
          />
        </div>
        <div className="flex-1">
          <label className="text-sm font-medium text-primary">{t("common.employeeCode")}</label>
          <input
            value={record.employee_code ?? ""}
            onChange={(e) => setRecord({ ...record, employee_code: e.target.value })}
            placeholder="Auto-generated if empty"
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-primary">{t("common.fullNameAr")}</label>
          <input
            value={record.full_name_ar ?? ""}
            onChange={(e) => setRecord({ ...record, full_name_ar: e.target.value })}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-primary">{t("common.fullNameEn")}</label>
          <input
            value={record.full_name_en ?? ""}
            onChange={(e) => setRecord({ ...record, full_name_en: e.target.value })}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-primary">{t("common.nationality")}</label>
          <NationalitySearchDropdown
            value={record.nationality ?? ""}
            onChange={(v) => setRecord({ ...record, nationality: v || null })}
            locale={locale as "ar" | "en"}
          />
        </div>
        <div>
          <label className="text-sm font-medium text-primary">{t("common.phoneNumber")}</label>
          <input
            value={record.phone ?? ""}
            onChange={(e) => setRecord({ ...record, phone: e.target.value })}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-primary">{t("common.dateOfBirth")}</label>
          <input
            type="date"
            value={record.date_of_birth?.split("T")[0] ?? ""}
            onChange={(e) => setRecord({ ...record, date_of_birth: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-10">
      <div className="flex gap-2">
        <div className="flex relative w-1/2 gap-2 border border-primary rounded-md p-2 dark:border-zinc-800">
          <div className="bg-primary rounded text-white absolute top-[-21%] left-[-0.1%] px-2 py-1">
            <p className="text-medium">{t("common.passport")}</p>
          </div>

          <div className="w-full">
            <div className="">
              <label className="text-sm font-medium text-primary">{t("common.passportNumber")}</label>
              <input
                value={record.passport_no ?? ""}
                onChange={(e) => setRecord({ ...record, passport_no: e.target.value })}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-primary">{t("common.passport")} {t("common.expiry") || "Expiry"}</label>
              <input
                type="date"
                value={record.passport_expiry_at?.split("T")[0] ?? ""}
                onChange={(e) => setRecord({ ...record, passport_expiry_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>
          </div>

          <div className="w-1/2">
            <FileUpload
              purpose_code="passport"
              label={t("common.passportImage")}
              fileId={record.passport_file_id}
              onFileIdChange={(id) => setRecord({ ...record, passport_file_id: id })}
            />
          </div>
        </div>

        <div className="flex relative w-1/2 gap-2 border border-primary rounded-md p-2 dark:border-zinc-800">
          <div className="bg-primary rounded text-white absolute top-[-21%] left-[-0.1%] px-2 py-1">
            <p className="text-medium">{t("common.iqama")}</p>
          </div>

          <div className="w-full">
            <div>
              <label className="text-sm font-medium text-primary">{t("common.iqamaNumber")}</label>
              <input
                value={record.iqama_no ?? ""}
                onChange={(e) => setRecord({ ...record, iqama_no: e.target.value })}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-primary">{t("common.iqamaExpiry")}</label>
              <input
                type="date"
                value={record.iqama_expiry_at?.split("T")[0] ?? ""}
                onChange={(e) => setRecord({ ...record, iqama_expiry_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

          </div>


          <div className="w-1/2">
            <FileUpload
              purpose_code="iqama"
              label={t("common.iqamaImage")}
              fileId={record.iqama_file_id}
              onFileIdChange={(id) => setRecord({ ...record, iqama_file_id: id })}
            />
          </div>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex relative w-2/4 gap-2 border border-primary rounded-md p-2 dark:border-zinc-800">
          <div className="bg-primary rounded text-white absolute top-[-21%] left-[-0.1%] px-2 py-1">
            <p className="text-medium">{t("common.contract")}</p>
          </div>

          <div className="w-full">
            <div>
              <label className="text-sm font-medium text-primary">{t("common.contractNumber")}</label>
              <input
                value={record.contract_no ?? ""}
                onChange={(e) => setRecord({ ...record, contract_no: e.target.value })}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-primary">{t("common.contractEnd")}</label>
              <input
                type="date"
                value={record.contract_end_at?.split("T")[0] ?? ""}
                onChange={(e) => setRecord({ ...record, contract_end_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
              />
            </div>

          </div>


          <div className="w-1/2">
            <FileUpload
              purpose_code="contract"
              label={t("common.contractImage")}
              fileId={record.contract_file_id}
              onFileIdChange={(id) => setRecord({ ...record, contract_file_id: id })}
            />
          </div>
        </div>

        <div className="relative w-1/4 gap-2 border border-primary rounded-md p-2 dark:border-zinc-800">
          <div className="bg-primary rounded text-white absolute top-[-21%] left-[-0.1%] px-2 py-1">
            <p className="text-medium">{t("common.license")}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-primary">{t("common.licenceExpiry")}</label>
            <input
              type="date"
              value={record.license_expiry_at?.split("T")[0] ?? ""}
              onChange={(e) => setRecord({ ...record, license_expiry_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>

          <div className="mt-2">
            <FileUpload
              purpose_code="license"
              label={t("common.licenseImage")}
              fileId={record.license_file_id}
              onFileIdChange={(id) => setRecord({ ...record, license_file_id: id })}
            />
          </div>
        </div>

        <div className="relative w-1/4 gap-2 border border-primary rounded-md p-2 dark:border-zinc-800">
          <div className="bg-primary rounded text-white absolute top-[-21%] left-[-0.1%] px-2 py-1">
            <p className="text-medium">{t("common.promissoryNote")}</p>
          </div>
          <div className="mt-2">
            <FileUpload
              purpose_code="promissory_note"
              label={t("common.promissoryNoteImage")}
              fileId={record.promissory_note_file_id}
              onFileIdChange={(id) => setRecord({ ...record, promissory_note_file_id: id })}
            />
          </div>
        </div>
      </div>


    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="text-sm font-medium text-primary">{t("common.operatingPlatform")}</label>
          <select
            value={record.assigned_platform ?? ""}
            onChange={(e) => setRecord({ ...record, assigned_platform: e.target.value || null })}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">-</option>
            <option value="JAHEZ">Jahez</option>
            <option value="HUNGERSTATION">Hungerstation</option>
            <option value="NINJA">Ninja</option>
            <option value="KEETA">Keeta</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-primary">{t("common.platformUserNo")}</label>
          <input
            value={record.platform_user_no ?? ""}
            onChange={(e) => setRecord({ ...record, platform_user_no: e.target.value })}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-primary">{t("common.jobType")}</label>
          <select
            value={record.job_type ?? ""}
            onChange={(e) => setRecord({ ...record, job_type: e.target.value || null })}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="">-</option>
            <option value="REPRESENTATIVE">{t("common.jobRepresentative")}</option>
            <option value="DRIVER">{t("common.jobDriver")}</option>
            <option value="ADMINISTRATOR">{t("common.jobAdministrator")}</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium text-primary">{t("common.status")}</label>
          <select
            value={record.status_code}
            onChange={(e) => setRecord({ ...record, status_code: e.target.value })}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
          >
            <option value="EMPLOYMENT_STATUS_UNDER_PROCEDURE">{t("common.statusInProgress")}</option>
            <option value="INCOMPLETE_FILE">{t("common.statusIncompleteFile")}</option>
            <option value="NOT_ASSIGNED">{t("common.statusNotAssigned")}</option>
            <option value="IN_TRAINING">{t("common.statusInTraining")}</option>
            <option value="EMPLOYMENT_STATUS_ACTIVE">{t("common.statusActive")}</option>
            <option value="COMPLETE_FILE">{t("common.statusCompleteFile")}</option>
            <option value="ASSIGNED">{t("common.statusAssigned")}</option>
          </select>
        </div>
      </div>

      {/* Asset Card Display */}
      <div className="rounded-md border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
        <label className="mb-2 block text-sm font-semibold text-primary">{t("common.assetCard")}</label>
        <AssetIcons assets={record.assets?.map((a) => ({ type: a.asset.type })) || []} />
        {(!record.assets || record.assets.length === 0) && (
          <p className="mt-1 text-xs text-zinc-400 italic">No assets assigned</p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-primary">{t("common.notes")}</label>
        <textarea
          value={record.notes ?? ""}
          onChange={(e) => setRecord({ ...record, notes: e.target.value })}
          className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
          rows={3}
        />
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={employmentId ? t("common.editEmployment") : t("common.newEmployment")}
      maxWidth="4xl"
    >
      <div className="space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`flex items-center gap-2 ${step === s ? "text-primary" : "text-zinc-400"}`}
            >
              <div
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${step === s ? "bg-primary text-white" : "bg-zinc-100 dark:bg-zinc-800"
                  }`}
              >
                {s}
              </div>
              <span className="hidden text-sm font-medium sm:inline">
                {s === 1 ? t("common.stepBasicInfo") : s === 2 ? t("common.stepDocuments") : t("common.stepOperatingData")}
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
            onClick={step === 1 ? handleClose : () => setStep(step - 1)}
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

