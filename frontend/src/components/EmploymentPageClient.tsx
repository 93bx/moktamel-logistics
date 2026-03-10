"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Zap, Eye, Pencil, CheckCircle, Slash, Trash2, User, Hash, Phone, Calendar, Globe, FileText, Monitor, Briefcase, Activity } from "lucide-react";
import { StatusBadge } from "./StatusBadge";
import { PlatformIcon } from "./PlatformIcon";
import { NationalityDisplay } from "./NationalityDisplay";
import { CandidateImageCard } from "./CandidateImageCard";
import { ImageViewerModal } from "./ImageViewerModal";
import { EmploymentModal } from "./EmploymentModal";
import { Modal } from "./Modal";
import type { EmploymentListItem, EmploymentFull } from "@/lib/types/employment";

interface EmploymentPageClientProps {
  locale: string;
  initialItems: EmploymentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export function EmploymentPageClient({
  locale,
  initialItems,
  total,
  page,
  pageSize,
}: EmploymentPageClientProps) {
  const t = useTranslations();
  const [editId, setEditId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [actionType, setActionType] = useState<"ACTIVATE" | "DEACTIVATE" | "VIEW" | "DELETE">("VIEW");
  const [selectedRecord, setSelectedRecord] = useState<EmploymentListItem | null>(null);

  const handleEdit = (id: string) => {
    setEditId(id);
    setIsModalOpen(true);
  };

  const handleAction = (record: EmploymentListItem, type: "ACTIVATE" | "DEACTIVATE" | "VIEW" | "DELETE") => {
    setSelectedRecord(record);
    setActionType(type);
    setIsActionModalOpen(true);
  };

  return (
    <>
      {/* Warning Row */}
      <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-400">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4" />
          <p>{t("common.employmentWarning") || "Note: Employee status cannot be set to Active unless all mandatory documents are uploaded and valid."}</p>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-primary">
            <thead className="border-b border-zinc-200 dark:border-zinc-700">
              <tr className={locale === "ar" ? "text-right" : "text-left"}>
                <th className="px-3 py-3 font-semibold">{t("common.personalPicture")}</th>
                <th className="px-3 py-3 font-semibold">{t("common.name")}</th>
                <th className="px-3 py-3 font-semibold">{t("common.employeeCode")}</th>
                <th className="px-3 py-3 font-semibold">{t("common.iqamaNumber")}</th>
                <th className="px-3 py-3 font-semibold">{t("common.status")}</th>
                <th className="px-3 py-3 font-semibold">{t("common.operatingPlatform")}</th>
                <th className="px-3 py-3 font-semibold text-right">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {initialItems.map((r) => (
                  <tr key={r.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-700">
                    <td className="px-3 py-2">
                      <div className="h-10 w-10 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-700">
                        {r.avatar_file_id ? (
                          <img
                            src={`/api/files/${r.avatar_file_id}/view`}
                            alt={r.full_name_en ?? ""}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs font-bold text-zinc-400 uppercase">
                            {(r.full_name_en || r.full_name_ar || "?")[0]}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col">
                        <span className="font-bold text-primary">{r.full_name_ar || "-"}</span>
                        <span className="text-xs text-primary/60">{r.full_name_en || "-"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.employee_code || "-"}</td>
                    <td className="px-3 py-2">
                      {r.iqama_no || <span className="text-amber-600 italic">{t("common.inProcess")}</span>}
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={r.status_code} />
                    </td>
                    <td className="px-3 py-2">
                      {r.assigned_platform ? (
                        <div className="flex flex-col gap-0.5">
                          <PlatformIcon platform={r.assigned_platform} />
                          {r.platform_user_no ? (
                            <span className="font-semibold text-primary">{r.platform_user_no}</span>
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => handleAction(r, "VIEW")}
                          className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          title={t("common.view")}
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(r.id)}
                          className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          title={t("common.edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {r.status_code !== "EMPLOYMENT_STATUS_ACTIVE" ? (
                          <button
                            onClick={() => handleAction(r, "ACTIVATE")}
                            className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                            title={r.status_code === "EMPLOYMENT_STATUS_DEACTIVATED" ? t("common.reactivate") : t("common.activate")}
                          >
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAction(r, "DEACTIVATE")}
                            className="rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title={t("common.deactivate")}
                          >
                            <Slash className="h-4 w-4" />
                          </button>
                        )}
                        {r.status_code !== "EMPLOYMENT_STATUS_ACTIVE" && (
                          <button
                            onClick={() => handleAction(r, "DELETE")}
                            className="rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                            title={t("common.delete")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
              ))}
              {initialItems.length === 0 && (
                <tr>
                  <td className="px-3 py-12 text-center text-zinc-400" colSpan={7}>
                    {t("common.noResults")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <EmploymentModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditId(null);
        }}
        locale={locale}
        employmentId={editId || undefined}
      />

      <ActionModal
        isOpen={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        type={actionType}
        record={selectedRecord}
        locale={locale}
      />
    </>
  );
}

function ActionModal({
  isOpen,
  onClose,
  type,
  record,
  locale,
}: {
  isOpen: boolean;
  onClose: () => void;
  type: "ACTIVATE" | "DEACTIVATE" | "VIEW" | "DELETE";
  record: EmploymentListItem | null;
  locale: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [viewRecord, setViewRecord] = useState<EmploymentFull | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [viewerState, setViewerState] = useState<{ url: string; title: string; filename: string } | null>(null);

  useEffect(() => {
    if (!isOpen || !record || type !== "VIEW") {
      setViewRecord(null);
      setDocumentUrls({});
      return;
    }
    const employmentId = record.id;
    let cancelled = false;
    async function load() {
      setViewLoading(true);
      setViewRecord(null);
      setDocumentUrls({});
      try {
        const res = await fetch(`/api/employment/${employmentId}`);
        const data = await res.json().catch(() => null);
        if (!res.ok || cancelled) return;
        setViewRecord(data as EmploymentFull);

        const fileIds: { key: string; fileId: string }[] = [];
        if (data.passport_file_id) fileIds.push({ key: "passport", fileId: data.passport_file_id });
        if (data.iqama_file_id) fileIds.push({ key: "iqama", fileId: data.iqama_file_id });
        if (data.contract_file_id) fileIds.push({ key: "contract", fileId: data.contract_file_id });
        if (data.license_file_id) fileIds.push({ key: "license", fileId: data.license_file_id });
        if (data.promissory_note_file_id) fileIds.push({ key: "promissory_note", fileId: data.promissory_note_file_id });

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
              // ignore per-file errors
            }
          })
        );
        if (!cancelled) setDocumentUrls(urlMap);
      } finally {
        if (!cancelled) setViewLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, record?.id, type]);

  const handleSubmit = async () => {
    if (!record) return;
    setSaving(true);
    setError(null);

    try {
      let res;
      if (type === "DELETE") {
        res = await fetch(`/api/employment/${record.id}`, {
          method: "DELETE",
        });
      } else {
        const newStatus = type === "ACTIVATE" ? "EMPLOYMENT_STATUS_ACTIVE" : "EMPLOYMENT_STATUS_DEACTIVATED";
        res = await fetch(`/api/employment/${record.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            status_code: newStatus,
            notes: notes,
          }),
        });
      }

      if (!res.ok) {
        const data = await res.json();
        setError(data?.message ?? "Action failed");
        setSaving(false);
        return;
      }

      onClose();
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Action failed");
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!record) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/employment/${record.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status_code: "EMPLOYMENT_STATUS_DRAFT", notes: notes || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.message ?? "Action failed");
        setSaving(false);
        return;
      }
      onClose();
      router.refresh();
    } catch (e: any) {
      setError(e?.message ?? "Action failed");
      setSaving(false);
    }
  };

  if (!record) return null;

  const getTitle = () => {
    if (type === "VIEW") return t("common.view");
    if (type === "ACTIVATE") return record?.status_code === "EMPLOYMENT_STATUS_DEACTIVATED" ? t("common.reactivate") : t("common.activate");
    if (type === "DEACTIVATE") return t("common.deactivate");
    if (type === "DELETE") return t("common.delete");
    return "";
  };

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

  const displayName = viewRecord?.full_name_ar || record.full_name_ar || "-";

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={getTitle()}
        maxWidth={type === "VIEW" ? "4xl" : undefined}
      >
        <div className="space-y-4">
          {type === "VIEW" ? (
            <div className="space-y-6">
              {viewLoading ? (
                <div className="py-12 text-center text-sm text-primary/70">{t("common.loading")}</div>
              ) : viewRecord ? (
                <>
                  {/* A – Personal Info */}
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary/80">
                      <User className="h-4 w-4" />
                      {t("common.personalInfo")}
                    </h3>
                    <div className="flex flex-wrap items-start gap-6">
                      <div className="flex shrink-0 flex-col items-center gap-2">
                        <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-zinc-200 bg-zinc-100 dark:border-zinc-600 dark:bg-zinc-700">
                          {viewRecord.avatar_file_id ? (
                            <img
                              src={`/api/files/${viewRecord.avatar_file_id}/view`}
                              className="h-full w-full object-cover"
                              alt=""
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-zinc-400">
                              {(viewRecord.full_name_ar || viewRecord.full_name_en || "?")[0]}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="grid min-w-0 flex-1 grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
                        <div className="flex items-center gap-2 text-sm">
                          <Hash className="h-4 w-4 shrink-0 text-primary/50" />
                          <span className="text-primary/60">{t("common.employeeCode")}:</span>
                          <span className="font-medium text-primary">{viewRecord.employee_code || "-"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 shrink-0 text-primary/50" />
                          <span className="text-primary/60">{t("common.fullNameAr")}:</span>
                          <span className="font-medium text-primary">{viewRecord.full_name_ar || "-"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <User className="h-4 w-4 shrink-0 text-primary/50" />
                          <span className="text-primary/60">{t("common.fullNameEn")}:</span>
                          <span className="font-medium text-primary">{viewRecord.full_name_en || "-"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Globe className="h-4 w-4 shrink-0 text-primary/50" />
                          <span className="text-primary/60">{t("common.nationality")}:</span>
                          <NationalityDisplay value={viewRecord.nationality} locale={locale as "ar" | "en"} />
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Phone className="h-4 w-4 shrink-0 text-primary/50" />
                          <span className="text-primary/60">{t("common.phoneNumber")}:</span>
                          <span className="font-medium text-primary">{viewRecord.phone || "-"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 shrink-0 text-primary/50" />
                          <span className="text-primary/60">{t("common.dateOfBirth")}:</span>
                          <span className="font-medium text-primary">{formatDate(viewRecord.date_of_birth)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* B – Official Documents */}
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary/80">
                      <FileText className="h-4 w-4" />
                      {t("common.officialDocuments")}
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {documentUrls["passport"] && (
                        <CandidateImageCard
                          src={documentUrls["passport"]}
                          alt={t("common.passportImage")}
                          label={`${t("common.passport")} (${viewRecord.passport_no || "-"} / ${formatDate(viewRecord.passport_expiry_at)})`}
                          downloadFilename={`${displayName}_passport`}
                          onView={() =>
                            setViewerState({
                              url: documentUrls["passport"],
                              title: t("common.passportImage"),
                              filename: `${displayName}_passport`,
                            })
                          }
                        />
                      )}
                      {!documentUrls["passport"] && (
                        <DocumentPlaceholder
                          label={t("common.passport")}
                          detail={`${viewRecord.passport_no || "-"} · ${formatDate(viewRecord.passport_expiry_at)}`}
                        />
                      )}
                      {documentUrls["iqama"] && (
                        <CandidateImageCard
                          src={documentUrls["iqama"]}
                          alt={t("common.iqamaImage")}
                          label={`${t("common.iqama")} (${viewRecord.iqama_no || "-"} / ${formatDate(viewRecord.iqama_expiry_at)})`}
                          downloadFilename={`${displayName}_iqama`}
                          onView={() =>
                            setViewerState({
                              url: documentUrls["iqama"],
                              title: t("common.iqamaImage"),
                              filename: `${displayName}_iqama`,
                            })
                          }
                        />
                      )}
                      {!documentUrls["iqama"] && (
                        <DocumentPlaceholder
                          label={t("common.iqama")}
                          detail={`${viewRecord.iqama_no || "-"} · ${formatDate(viewRecord.iqama_expiry_at)}`}
                        />
                      )}
                      {documentUrls["contract"] && (
                        <CandidateImageCard
                          src={documentUrls["contract"]}
                          alt={t("common.contractImage")}
                          label={`${t("common.contract")} (${viewRecord.contract_no || "-"} / ${formatDate(viewRecord.contract_end_at)})`}
                          downloadFilename={`${displayName}_contract`}
                          onView={() =>
                            setViewerState({
                              url: documentUrls["contract"],
                              title: t("common.contractImage"),
                              filename: `${displayName}_contract`,
                            })
                          }
                        />
                      )}
                      {!documentUrls["contract"] && (
                        <DocumentPlaceholder
                          label={t("common.contract")}
                          detail={`${viewRecord.contract_no || "-"} · ${formatDate(viewRecord.contract_end_at)}`}
                        />
                      )}
                      {documentUrls["license"] && (
                        <CandidateImageCard
                          src={documentUrls["license"]}
                          alt={t("common.licenseImage")}
                          label={`${t("common.license")} · ${formatDate(viewRecord.license_expiry_at)}`}
                          downloadFilename={`${displayName}_license`}
                          onView={() =>
                            setViewerState({
                              url: documentUrls["license"],
                              title: t("common.licenseImage"),
                              filename: `${displayName}_license`,
                            })
                          }
                        />
                      )}
                      {!documentUrls["license"] && (
                        <DocumentPlaceholder
                          label={t("common.license")}
                          detail={formatDate(viewRecord.license_expiry_at)}
                        />
                      )}
                      {documentUrls["promissory_note"] && (
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
                      )}
                      {!documentUrls["promissory_note"] && (
                        <DocumentPlaceholder
                          label={t("common.promissoryNote")}
                          detail="-"
                        />
                      )}
                    </div>
                  </div>

                  {/* C – Operating Data */}
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
                    <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary/80">
                      <Activity className="h-4 w-4" />
                      {t("common.operatingData")}
                    </h3>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Monitor className="h-4 w-4 shrink-0 text-primary/50" />
                        <span className="text-primary/60">{t("common.operatingPlatform")}:</span>
                        {viewRecord.assigned_platform ? (
                          <PlatformIcon platform={viewRecord.assigned_platform} />
                        ) : (
                          <span className="font-medium text-primary">-</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Hash className="h-4 w-4 shrink-0 text-primary/50" />
                        <span className="text-primary/60">{t("common.platformUserNo")}:</span>
                        <span className="font-medium text-primary">{viewRecord.platform_user_no || "-"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Briefcase className="h-4 w-4 shrink-0 text-primary/50" />
                        <span className="text-primary/60">{t("common.jobType")}:</span>
                        <span className="font-medium text-primary">{getJobTypeLabel(viewRecord.job_type)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Activity className="h-4 w-4 shrink-0 text-primary/50" />
                        <span className="text-primary/60">{t("common.status")}:</span>
                        <StatusBadge status={viewRecord.status_code} />
                      </div>
                    </div>
                    {(viewRecord.notes != null && viewRecord.notes !== "") && (
                      <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                        <div className="flex items-start gap-2 text-sm">
                          <FileText className="h-4 w-4 shrink-0 text-primary/50 mt-0.5" />
                          <div>
                            <span className="text-primary/60">{t("common.notes")}:</span>
                            <p className="mt-1 whitespace-pre-wrap font-medium text-primary">{viewRecord.notes}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          ) : type === "DELETE" ? (
          <div className="space-y-4">
            {record.status_code === "EMPLOYMENT_STATUS_ACTIVE" ? (
              <p className="text-sm text-primary font-medium">
                {t("common.cannotDeleteActiveEmployee")}
              </p>
            ) : (
              <p className="text-sm text-red-600 font-medium">
                {t("common.confirmDeleteEmployee") || "Are you sure you want to delete this employee? This action cannot be undone."}
              </p>
            )}
            {error && <div className="text-xs text-red-600">{error}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md">
                {t("common.cancel")}
              </button>
              <button
                onClick={handleArchive}
                disabled={saving}
                className="px-4 py-2 text-sm text-white rounded-md bg-zinc-600 hover:bg-zinc-700 disabled:opacity-50"
              >
                {saving ? t("common.saving") : t("common.archive")}
              </button>
              {record.status_code !== "EMPLOYMENT_STATUS_ACTIVE" && (
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="px-4 py-2 text-sm text-white rounded-md bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {saving ? t("common.deleting") : t("common.delete")}
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              {type === "ACTIVATE"
                ? record?.status_code === "EMPLOYMENT_STATUS_DEACTIVATED"
                  ? t("common.confirmReactivate")
                  : t("common.confirmActivate") || "Are you sure you want to activate this employee? This will change status to Active."
                : t("common.confirmDeactivate") || "Are you sure you want to deactivate this employee?"}
            </p>
            <div>
              <label className="text-sm font-medium">{t("common.notes")}</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm"
                rows={3}
                required
              />
            </div>
            {error && <div className="text-xs text-red-600">{error}</div>}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 text-sm border rounded-md">
                {t("common.cancel")}
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className={`px-4 py-2 text-sm text-white rounded-md ${type === "ACTIVATE" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}`}
              >
                {saving ? t("common.saving") : type === "ACTIVATE" && record?.status_code === "EMPLOYMENT_STATUS_DEACTIVATED" ? t("common.reactivate") : t("common.save")}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
      {type === "VIEW" && viewerState && (
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

function DocumentPlaceholder({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-md border border-dashed border-zinc-300 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-800/50">
      <p className="text-sm font-medium text-primary/80">{label}</p>
      <p className="mt-1 text-xs text-primary/60">{detail}</p>
      <p className="mt-2 text-xs italic text-primary/50">—</p>
    </div>
  );
}

