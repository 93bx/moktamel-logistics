"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { EmploymentModal } from "./EmploymentModal";
import { VehicleFormModal } from "./VehicleFormModal";
import { RecruitmentEditModal } from "./RecruitmentEditModal";
import { ImageViewerModal } from "./ImageViewerModal";

export type DocumentListItem = {
  id: string;
  doc_name: string;
  source_type: "employment" | "company" | "fleet" | "recruitment" | "other";
  source_label: string;
  expiry_date: string | null;
  status: "active" | "near_expiry" | "expired" | "no_expiry";
  entity_type: string;
  entity_id: string;
  document_id: string;
  file_id: string | null;
  file_url?: string | null;
  employment_record_id?: string;
  vehicle_id?: string;
  recruitment_candidate_id?: string;
};

export type DocumentsStatsData = {
  expiringWithin5: number;
  expiringWithin25: number;
  expired: number;
  active: number;
};

const TABS = [
  "near_expiry",
  "employees",
  "company",
  "fleet",
  "recruitment",
  "other",
] as const;

type TabValue = (typeof TABS)[number];

interface DocumentsPageClientProps {
  locale: string;
  stats: DocumentsStatsData;
  initialData: {
    items: DocumentListItem[];
    total: number;
    page: number;
    page_size: number;
  };
  searchParams: { tab: string; page: number; q: string };
}

function formatExpiry(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export function DocumentsPageClient({
  locale,
  stats,
  initialData,
  searchParams,
}: DocumentsPageClientProps) {
  const t = useTranslations();
  const router = useRouter();
  const tab = (searchParams.tab || "near_expiry") as TabValue;
  const page = searchParams.page || 1;
  const q = searchParams.q || "";
  const totalPages = Math.max(1, Math.ceil(initialData.total / initialData.page_size));

  const [employmentModalOpen, setEmploymentModalOpen] = useState(false);
  const [employmentEditId, setEmploymentEditId] = useState<string | null>(null);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [vehicleEditId, setVehicleEditId] = useState<string | null>(null);
  const [recruitmentModalOpen, setRecruitmentModalOpen] = useState(false);
  const [recruitmentEditId, setRecruitmentEditId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [viewState, setViewState] = useState<{ url: string; title: string; filename: string } | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  function buildUrl(opts: { tab?: string; page?: number; q?: string }) {
    const params = new URLSearchParams();
    params.set("tab", opts.tab ?? tab);
    params.set("page", String(opts.page ?? page));
    if (opts.q !== undefined) {
      if (opts.q) params.set("q", opts.q);
    } else if (q) params.set("q", q);
    return `/${locale}/documents?${params.toString()}`;
  }

  async function handleView(item: DocumentListItem) {
    if (item.file_id) {
      setViewLoading(true);
      try {
        const res = await fetch("/api/files/download-url", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ file_id: item.file_id }),
        });
        const data = await res.json().catch(() => null);
        if (res.ok && data?.download_url) {
          setViewState({
            url: data.download_url,
            title: item.doc_name,
            filename: `${item.source_label}_${item.doc_name}`.replace(/\s+/g, "_"),
          });
        }
      } finally {
        setViewLoading(false);
      }
    } else if (item.file_url) {
      setViewState({
        url: item.file_url,
        title: item.doc_name,
        filename: `${item.source_label}_${item.doc_name}`.replace(/\s+/g, "_"),
      });
    }
  }

  function handleEdit(item: DocumentListItem) {
    if (item.source_type === "employment" && item.employment_record_id) {
      setEmploymentEditId(item.employment_record_id);
      setEmploymentModalOpen(true);
    } else if (item.source_type === "fleet" && item.vehicle_id) {
      setVehicleEditId(item.vehicle_id);
      setVehicleModalOpen(true);
    } else if (item.source_type === "recruitment" && item.recruitment_candidate_id) {
      setRecruitmentEditId(item.recruitment_candidate_id);
      setRecruitmentModalOpen(true);
    }
  }

  async function handleDeleteConfirm(id: string) {
    setDeleting(true);
    try {
      const res = await fetch(`/api/documents/items/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err?.message || t("documents.deleteError"));
        return;
      }
      setDeleteConfirmId(null);
      router.refresh();
    } finally {
      setDeleting(false);
    }
  }

  function statusBadge(status: DocumentListItem["status"]) {
    const key = `documents.status.${status}`;
    const color =
      status === "expired"
        ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
        : status === "near_expiry"
          ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
          : status === "active"
            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300"
            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300";
    return (
      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${color}`}>
        {t(key)}
      </span>
    );
  }

  return (
    <>
      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="text-sm text-primary/60">{t("documents.stats.expiringWithin5")}</div>
          <div className="mt-1 text-2xl font-semibold text-primary">{stats.expiringWithin5}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="text-sm text-primary/60">{t("documents.stats.expiringWithin25")}</div>
          <div className="mt-1 text-2xl font-semibold text-primary">{stats.expiringWithin25}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="text-sm text-primary/60">{t("documents.stats.expired")}</div>
          <div className="mt-1 text-2xl font-semibold text-primary">{stats.expired}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="text-sm text-primary/60">{t("documents.stats.active")}</div>
          <div className="mt-1 text-2xl font-semibold text-primary">{stats.active}</div>
        </div>
      </div>

      {/* Tabs – styled like Payroll & Costs page */}
      <div className="border-b border-zinc-200 dark:border-zinc-700">
        <nav className="flex gap-4">
          {TABS.map((tVal) => (
            <Link
              key={tVal}
              href={buildUrl({ tab: tVal, page: 1 })}
              className={`px-3 py-2 text-sm font-medium ${
                tab === tVal
                  ? "border-b-2 border-primary text-primary"
                  : "text-primary/60 hover:text-primary"
              }`}
            >
              {t(`documents.tabs.${tVal === "near_expiry" ? "nearExpiry" : tVal}`)}
            </Link>
          ))}
        </nav>
      </div>

      {/* Search */}
      <form action={`/${locale}/documents`} method="get" className="flex gap-2">
        <input type="hidden" name="tab" value={tab} />
        <input type="hidden" name="page" value="1" />
        <input
          name="q"
          defaultValue={q}
          placeholder={t("documents.searchPlaceholder")}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800"
        />
        <button
          type="submit"
          className="rounded-md bg-[#244473] px-4 py-2 text-sm font-medium text-white hover:bg-[#1e3860]"
        >
          {t("common.filter")}
        </button>
      </form>

      {/* Table */}
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-primary">
            <thead className="border-b border-zinc-200 dark:border-zinc-700">
              <tr className={locale === "ar" ? "text-right" : "text-left"}>
                <th className="px-3 py-3 font-semibold">{t("documents.table.docName")}</th>
                <th className="px-3 py-3 font-semibold">{t("documents.table.docSource")}</th>
                <th className="px-3 py-3 font-semibold">{t("documents.table.docExpiry")}</th>
                <th className="px-3 py-3 font-semibold">{t("documents.table.docStatus")}</th>
                <th className="px-3 py-3 font-semibold text-right">{t("documents.table.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {initialData.items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-700"
                >
                  <td className="px-3 py-2">{item.doc_name}</td>
                  <td className="px-3 py-2">{item.source_label}</td>
                  <td className="px-3 py-2">{formatExpiry(item.expiry_date)}</td>
                  <td className="px-3 py-2">{statusBadge(item.status)}</td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleView(item)}
                        disabled={(!item.file_id && !item.file_url) || viewLoading}
                        className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50"
                        title={t("documents.actions.view")}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                      {(item.source_type === "employment" ||
                        item.source_type === "fleet" ||
                        item.source_type === "recruitment") && (
                        <button
                          type="button"
                          onClick={() => handleEdit(item)}
                          className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          title={t("documents.actions.edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmId(item.id)}
                        className="rounded-md p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title={t("documents.actions.delete")}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {initialData.items.length === 0 && (
                <tr>
                  <td
                    className="px-3 py-12 text-center text-zinc-400"
                    colSpan={5}
                  >
                    {t("documents.noDocuments")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-zinc-200 px-3 py-2 dark:border-zinc-700">
            <span className="text-sm text-primary/70">
              {t("documents.paginationSummary", {
                from: (page - 1) * initialData.page_size + 1,
                to: Math.min(page * initialData.page_size, initialData.total),
                total: initialData.total,
              })}
            </span>
            <div className="flex gap-1">
              <Link
                href={buildUrl({ page: page - 1 })}
                className={`rounded-md px-3 py-1 text-sm ${
                  page <= 1
                    ? "pointer-events-none text-zinc-400"
                    : "text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                }`}
              >
                {t("common.previous")}
              </Link>
              <Link
                href={buildUrl({ page: page + 1 })}
                className={`rounded-md px-3 py-1 text-sm ${
                  page >= totalPages
                    ? "pointer-events-none text-zinc-400"
                    : "text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                }`}
              >
                {t("common.next")}
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirm */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="rounded-lg bg-white p-4 shadow-lg dark:bg-zinc-800">
            <p className="text-primary">{t("documents.confirmDelete")}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteConfirm(deleteConfirmId)}
                disabled={deleting}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? t("common.loading") : t("documents.actions.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      <EmploymentModal
        isOpen={employmentModalOpen}
        onClose={() => {
          setEmploymentModalOpen(false);
          setEmploymentEditId(null);
        }}
        locale={locale}
        employmentId={employmentEditId ?? undefined}
      />

      <VehicleFormModal
        isOpen={vehicleModalOpen}
        onClose={() => {
          setVehicleModalOpen(false);
          setVehicleEditId(null);
        }}
        locale={locale}
        vehicleId={vehicleEditId}
      />

      <RecruitmentEditModal
        isOpen={recruitmentModalOpen}
        onClose={() => {
          setRecruitmentModalOpen(false);
          setRecruitmentEditId(null);
        }}
        locale={locale}
        candidateId={recruitmentEditId}
      />

      {viewState && (
        <ImageViewerModal
          isOpen={!!viewState}
          onClose={() => setViewState(null)}
          imageUrl={viewState.url}
          imageTitle={viewState.title}
          downloadFilename={viewState.filename}
        />
      )}
    </>
  );
}
