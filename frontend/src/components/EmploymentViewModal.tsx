"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  User,
  Hash,
  Phone,
  Calendar,
  Globe,
  FileText,
  Activity,
  Monitor,
  Briefcase,
  Pencil,
  CheckCircle,
  Slash,
  Trash2,
  UserX,
  RotateCcw,
} from "lucide-react";
import { Modal } from "./Modal";
import { StatusBadge } from "./StatusBadge";
import { PlatformIcon } from "./PlatformIcon";
import { NationalityDisplay } from "./NationalityDisplay";
import { CandidateImageCard } from "./CandidateImageCard";
import { ImageViewerModal } from "./ImageViewerModal";

type EmploymentRecordForView = {
  id: string;
  recruitment_candidate_id: string | null;
  employment_source: string | null;
  employee_no: string | null;
  employee_code: string | null;
  full_name_ar: string | null;
  full_name_en: string | null;
  nationality: string | null;
  phone: string | null;
  date_of_birth: string | null;
  passport_no: string | null;
  passport_expiry_at: string | null;
  passport_file_id: string | null;
  iqama_no: string | null;
  iqama_expiry_at: string | null;
  iqama_file_id: string | null;
  contract_no: string | null;
  contract_end_at: string | null;
  contract_file_id: string | null;
  license_expiry_at: string | null;
  license_file_id: string | null;
  promissory_note_file_id: string | null;
  avatar_file_id: string | null;
  status_code: string;
  salary_amount: string | null;
  salary_currency_code: string | null;
  assigned_platform: string | null;
  platform_user_no: string | null;
  job_type: string | null;
  monthly_orders_target: number | null;
  monthly_target_amount: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  recruitment_candidate: {
    full_name_ar: string;
    full_name_en: string | null;
  } | null;
  extra_documents?: Array<{
    id: string;
    document_name: string;
    expiry_at: string | null;
    file_id: string | null;
  }>;
  audit_logs?: Array<{ id: string; action: string; created_at: string }>;
};

interface EmploymentViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  employmentId: string | null;
  locale: string;
  onEdit: (id: string) => void;
  onActivate: (record: EmploymentRecordForView) => void;
  onDeactivate: (record: EmploymentRecordForView) => void;
  onDesert: (record: EmploymentRecordForView) => void;
  onRestore: (record: EmploymentRecordForView) => void;
  onDelete: (record: EmploymentRecordForView) => void;
}

function DocumentPlaceholder({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-800/50">
      <p className="text-sm font-medium text-primary/80">{label}</p>
      <p className="mt-1 text-xs text-primary/60">{detail}</p>
      <p className="mt-2 text-xs italic text-primary/50">—</p>
    </div>
  );
}

export function EmploymentViewModal({
  isOpen,
  onClose,
  employmentId,
  locale,
  onEdit,
  onActivate,
  onDeactivate,
  onDesert,
  onRestore,
  onDelete,
}: EmploymentViewModalProps) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<"documents" | "operating" | "logs">("documents");
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState<EmploymentRecordForView | null>(null);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [viewerState, setViewerState] = useState<{ url: string; title: string; filename: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !employmentId) {
      setRecord(null);
      setDocumentUrls({});
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setRecord(null);
      setDocumentUrls({});
      try {
        const res = await fetch(`/api/employment/${employmentId}`);
        const data = await res.json().catch(() => null);
        if (!res.ok || cancelled) return;
        setRecord(data as EmploymentRecordForView);

        const fileIds: { key: string; fileId: string }[] = [];
        if (data.passport_file_id) fileIds.push({ key: "passport", fileId: data.passport_file_id });
        if (data.iqama_file_id) fileIds.push({ key: "iqama", fileId: data.iqama_file_id });
        if (data.contract_file_id) fileIds.push({ key: "contract", fileId: data.contract_file_id });
        if (data.license_file_id) fileIds.push({ key: "license", fileId: data.license_file_id });
        if (data.promissory_note_file_id) fileIds.push({ key: "promissory_note", fileId: data.promissory_note_file_id });
        (data.extra_documents ?? []).forEach((doc: { id: string; file_id: string | null }, i: number) => {
          if (doc.file_id) fileIds.push({ key: `extra_${doc.id}`, fileId: doc.file_id });
        });

        const urlMap: Record<string, string> = {};
        await Promise.all(
          fileIds.map(async ({ key, fileId }) => {
            try {
              const urlRes = await fetch("/api/files/download-url", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ file_id: fileId }),
              });
              if (urlRes.ok && !cancelled) {
                const urlData = await urlRes.json();
                if (urlData.download_url) urlMap[key] = urlData.download_url;
              }
            } catch {
              // ignore
            }
          })
        );
        if (!cancelled) setDocumentUrls(urlMap);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, employmentId]);

  const formatDate = (dateString: string | null): string => {
    if (!dateString) return "-";
    try {
      return new Date(dateString).toLocaleDateString(locale === "ar" ? "ar-SA" : "en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const getJobTypeLabel = (jobType: string | null): string => {
    if (!jobType) return "-";
    const map: Record<string, string> = {
      REPRESENTATIVE: t("common.jobRepresentative"),
      DRIVER: t("common.jobDriver"),
      ADMINISTRATOR: t("common.jobAdministrator"),
    };
    return map[jobType] ?? jobType;
  };

  const getEmploymentSourceLabel = (): string => {
    if (!record) return "-";
    if (record.recruitment_candidate_id) return t("employment.employmentSourceRecruitment");
    if (record.employment_source === "AJEEER_CONTRACT") return t("employment.employmentSourceAjeer");
    if (record.employment_source === "WITHIN_KINGDOM") return t("employment.employmentSourceWithinKingdom");
    return record.employment_source ?? "-";
  };

  const getAuditActionLabel = (action: string): string => {
    try {
      return t(`employment.auditAction.${action}` as any);
    } catch {
      return action;
    }
  };

  const displayName = record?.full_name_ar || record?.full_name_en || "-";

  if (!isOpen) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t("common.view")}
        maxWidth="5xl"
        modalClassName="flex flex-col max-h-[90vh] overflow-hidden"
        contentClassName="flex flex-col flex-1 min-h-0 overflow-hidden p-0"
      >
        {loading || !record ? (
          <div className="flex flex-1 items-center justify-center py-20 text-zinc-400">{t("common.loading")}</div>
        ) : (
          <>
            <div className="flex-1 min-h-0 overflow-auto p-6 space-y-6">
              {/* Personal Info card */}
              <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
                <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary/80">
                  <User className="h-4 w-4" />
                  {t("common.personalInfo")}
                </h3>
                <div className="flex flex-wrap items-start gap-6">
                  <div className="flex shrink-0 flex-col items-center gap-2">
                    <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700">
                      {record.avatar_file_id ? (
                        <img
                          src={`/api/files/${record.avatar_file_id}/view`}
                          className="h-full w-full object-cover"
                          alt=""
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-zinc-400">
                          {(record.full_name_ar || record.full_name_en || "?")[0]}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Hash className="h-4 w-4 shrink-0 text-primary/50" />
                      <span className="text-primary/60">{t("common.employeeCode")}:</span>
                      <span className="font-medium text-primary">{record.employee_code || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 shrink-0 text-primary/50" />
                      <span className="text-primary/60">{t("common.fullNameAr")}:</span>
                      <span className="font-medium text-primary">{record.full_name_ar || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 shrink-0 text-primary/50" />
                      <span className="text-primary/60">{t("common.fullNameEn")}:</span>
                      <span className="font-medium text-primary">{record.full_name_en || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 shrink-0 text-primary/50" />
                      <span className="text-primary/60">{t("common.nationality")}:</span>
                      <NationalityDisplay value={record.nationality} locale={locale as "ar" | "en"} />
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 shrink-0 text-primary/50" />
                      <span className="text-primary/60">{t("common.phoneNumber")}:</span>
                      <span className="font-medium text-primary">{record.phone || "-"}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 shrink-0 text-primary/50" />
                      <span className="text-primary/60">{t("common.dateOfBirth")}:</span>
                      <span className="font-medium text-primary">{formatDate(record.date_of_birth)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-primary/50" />
                      <span className="text-primary/60">{t("employment.employmentSource")}:</span>
                      <span className="font-medium text-primary">{getEmploymentSourceLabel()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div>
                <div className="flex border-b border-zinc-100 dark:border-zinc-800">
                  <button
                    onClick={() => setActiveTab("operating")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "operating" ? "border-b-2 border-primary text-primary" : "text-zinc-500 hover:text-primary"}`}
                  >
                    {t("employment.operatingData")}
                  </button>
                  <button
                    onClick={() => setActiveTab("documents")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "documents" ? "border-b-2 border-primary text-primary" : "text-zinc-500 hover:text-primary"}`}
                  >
                    {t("employment.officialDocuments")}
                  </button>
                  <button
                    onClick={() => setActiveTab("logs")}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "logs" ? "border-b-2 border-primary text-primary" : "text-zinc-500 hover:text-primary"}`}
                  >
                    {t("employment.logs")}
                  </button>
                </div>

                {activeTab === "documents" && (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {documentUrls["passport"] ? (
                      <CandidateImageCard
                        src={documentUrls["passport"]}
                        alt={t("common.passportImage")}
                        label={`${t("common.passport")} (${record.passport_no || "-"} / ${formatDate(record.passport_expiry_at)})`}
                        downloadFilename={`${displayName}_passport`}
                        onView={() =>
                          setViewerState({
                            url: documentUrls["passport"],
                            title: t("common.passportImage"),
                            filename: `${displayName}_passport`,
                          })
                        }
                      />
                    ) : (
                      <DocumentPlaceholder
                        label={t("common.passport")}
                        detail={`${record.passport_no || "-"} · ${formatDate(record.passport_expiry_at)}`}
                      />
                    )}
                    {documentUrls["iqama"] ? (
                      <CandidateImageCard
                        src={documentUrls["iqama"]}
                        alt={t("common.iqamaImage")}
                        label={`${t("common.iqama")} (${record.iqama_no || "-"} / ${formatDate(record.iqama_expiry_at)})`}
                        downloadFilename={`${displayName}_iqama`}
                        onView={() =>
                          setViewerState({
                            url: documentUrls["iqama"],
                            title: t("common.iqamaImage"),
                            filename: `${displayName}_iqama`,
                          })
                        }
                      />
                    ) : (
                      <DocumentPlaceholder
                        label={t("common.iqama")}
                        detail={`${record.iqama_no || "-"} · ${formatDate(record.iqama_expiry_at)}`}
                      />
                    )}
                    {documentUrls["contract"] ? (
                      <CandidateImageCard
                        src={documentUrls["contract"]}
                        alt={t("common.contractImage")}
                        label={`${t("common.contract")} (${record.contract_no || "-"} / ${formatDate(record.contract_end_at)})`}
                        downloadFilename={`${displayName}_contract`}
                        onView={() =>
                          setViewerState({
                            url: documentUrls["contract"],
                            title: t("common.contractImage"),
                            filename: `${displayName}_contract`,
                          })
                        }
                      />
                    ) : (
                      <DocumentPlaceholder
                        label={t("common.contract")}
                        detail={`${record.contract_no || "-"} · ${formatDate(record.contract_end_at)}`}
                      />
                    )}
                    {documentUrls["license"] ? (
                      <CandidateImageCard
                        src={documentUrls["license"]}
                        alt={t("common.licenseImage")}
                        label={`${t("common.license")} · ${formatDate(record.license_expiry_at)}`}
                        downloadFilename={`${displayName}_license`}
                        onView={() =>
                          setViewerState({
                            url: documentUrls["license"],
                            title: t("common.licenseImage"),
                            filename: `${displayName}_license`,
                          })
                        }
                      />
                    ) : (
                      <DocumentPlaceholder
                        label={t("common.license")}
                        detail={formatDate(record.license_expiry_at)}
                      />
                    )}
                    {documentUrls["promissory_note"] ? (
                      <CandidateImageCard
                        src={documentUrls["promissory_note"]}
                        alt={t("common.promissoryNoteImage")}
                        label={t("common.promissoryNote")}
                        downloadFilename={`${displayName}_promissory_note`}
                        onView={() =>
                          setViewerState({
                            url: documentUrls["promissory_note"],
                            title: t("common.promissoryNoteImage"),
                            filename: `${displayName}_promissory_note`,
                          })
                        }
                      />
                    ) : (
                      <DocumentPlaceholder label={t("common.promissoryNote")} detail="-" />
                    )}
                    {(record.extra_documents ?? []).map((doc) =>
                      documentUrls[`extra_${doc.id}`] ? (
                        <CandidateImageCard
                          key={doc.id}
                          src={documentUrls[`extra_${doc.id}`]}
                          alt={doc.document_name || t("common.customDocument")}
                          label={`${doc.document_name || t("common.customDocument")} · ${formatDate(doc.expiry_at)}`}
                          downloadFilename={`${displayName}_${doc.document_name || "doc"}`}
                          onView={() =>
                            setViewerState({
                              url: documentUrls[`extra_${doc.id}`],
                              title: doc.document_name || t("common.customDocument"),
                              filename: `${displayName}_${doc.document_name || "doc"}`,
                            })
                          }
                        />
                      ) : (
                        <DocumentPlaceholder
                          key={doc.id}
                          label={doc.document_name || t("common.customDocument")}
                          detail={formatDate(doc.expiry_at)}
                        />
                      )
                    )}
                  </div>
                )}

                {activeTab === "operating" && (
                  <div className="rounded-lg border border-t-0 border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Monitor className="h-4 w-4 shrink-0 text-primary/50" />
                        <span className="text-primary/60">{t("common.operatingPlatform")}:</span>
                        {record.assigned_platform ? (
                          <PlatformIcon platform={record.assigned_platform} />
                        ) : (
                          <span className="font-medium text-primary">-</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Hash className="h-4 w-4 shrink-0 text-primary/50" />
                        <span className="text-primary/60">{t("common.platformUserNo")}:</span>
                        <span className="font-medium text-primary">{record.platform_user_no || "-"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Briefcase className="h-4 w-4 shrink-0 text-primary/50" />
                        <span className="text-primary/60">{t("common.jobType")}:</span>
                        <span className="font-medium text-primary">{getJobTypeLabel(record.job_type)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Activity className="h-4 w-4 shrink-0 text-primary/50" />
                        <span className="text-primary/60">{t("common.status")}:</span>
                        <StatusBadge status={record.status_code} />
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-primary/60">{t("common.salaryAmount")}:</span>
                        <span className="font-medium text-primary">
                          {record.salary_amount != null ? `${record.salary_amount} ${record.salary_currency_code || "SAR"}` : "-"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-primary/60">
                          {record.monthly_target_amount != null
                            ? t("employment.revenueTarget")
                            : t("employment.ordersTarget")}
                          :
                        </span>
                        <span className="font-medium text-primary">
                          {record.monthly_orders_target != null
                            ? String(record.monthly_orders_target)
                            : record.monthly_target_amount ?? "-"}
                        </span>
                      </div>
                    </div>
                    {(record.notes != null && record.notes !== "") && (
                      <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                        <div className="flex items-start gap-2 text-sm">
                          <FileText className="h-4 w-4 shrink-0 text-primary/50 mt-0.5" />
                          <div>
                            <span className="text-primary/60">{t("common.notes")}:</span>
                            <p className="mt-1 whitespace-pre-wrap font-medium text-primary">{record.notes}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "logs" && (
                  <div className="max-h-64 overflow-auto rounded-md border border-zinc-100 dark:border-zinc-800">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                        <tr className={locale === "ar" ? "text-right" : "text-left"}>
                          <th className="px-3 py-2">{t("common.date")}</th>
                          <th className="px-3 py-2">{t("common.action")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(record.audit_logs ?? []).map((log) => (
                          <tr key={log.id} className="border-t border-zinc-100 dark:border-zinc-800">
                            <td className="px-3 py-2 whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString(locale === "ar" ? "ar-SA" : "en-US")}
                            </td>
                            <td className="px-3 py-2">{getAuditActionLabel(log.action)}</td>
                          </tr>
                        ))}
                        {(!record.audit_logs || record.audit_logs.length === 0) && (
                          <tr>
                            <td colSpan={2} className="px-3 py-6 text-center text-zinc-400">
                              {t("common.noResults")}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Sticky actions row – only show actions that are allowed for current status */}
            <div className="flex-none flex flex-wrap gap-2 border-t border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
              <button
                onClick={() => {
                  onEdit(record.id);
                  onClose();
                }}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
              >
                <Pencil className="h-4 w-4" />
                {t("common.edit")}
              </button>
              {record.status_code !== "EMPLOYMENT_STATUS_ACTIVE" && (
                <button
                  onClick={() => {
                    onActivate(record);
                    onClose();
                  }}
                  className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  <CheckCircle className="h-4 w-4" />
                  {t("common.activate")}
                </button>
              )}
              {record.status_code === "EMPLOYMENT_STATUS_ACTIVE" && (
                <button
                  onClick={() => {
                    onDeactivate(record);
                    onClose();
                  }}
                  className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
                >
                  <Slash className="h-4 w-4" />
                  {t("common.deactivate")}
                </button>
              )}
              {record.status_code !== "EMPLOYMENT_STATUS_ACTIVE" &&
                record.status_code !== "EMPLOYMENT_STATUS_DESERTED" && (
                  <button
                    onClick={() => {
                      onDesert(record);
                      onClose();
                    }}
                    className="flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                  >
                    <UserX className="h-4 w-4" />
                    {t("common.markAsDeserted")}
                  </button>
                )}
              {(record.status_code === "EMPLOYMENT_STATUS_DESERTED" || record.status_code === "EMPLOYMENT_STATUS_DRAFT") && (
                <button
                  onClick={() => {
                    onRestore(record);
                    onClose();
                  }}
                  className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <RotateCcw className="h-4 w-4" />
                  {t("common.restoreToInProgress")}
                </button>
              )}
              {record.status_code !== "EMPLOYMENT_STATUS_ACTIVE" && (
                <button
                  onClick={() => {
                    onDelete(record);
                    onClose();
                  }}
                  className="flex items-center gap-2 rounded-md border border-zinc-300 bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-200"
                >
                  <Trash2 className="h-4 w-4" />
                  {t("common.delete")}
                </button>
              )}
            </div>
          </>
        )}
      </Modal>
      {viewerState && (
        <ImageViewerModal
          isOpen={!!viewerState}
          onClose={() => setViewerState(null)}
          imageUrl={viewerState.url}
          imageTitle={viewerState.title}
          downloadFilename={viewerState.filename}
        />
      )}
    </>
  );
}
