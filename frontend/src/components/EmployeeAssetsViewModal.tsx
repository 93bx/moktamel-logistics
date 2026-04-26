"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Car,
  Bike,
  Smartphone,
  HardHat,
  Shirt,
  ShoppingBag,
  Package,
  Pencil,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { Modal } from "./Modal";
import { CurrencyWithRiyal } from "./CurrencyWithRiyal";

type EmployeeAssetsResponse = {
  id: string;
  full_name_en?: string | null;
  full_name_ar?: string | null;
  recruitment_candidate: {
    full_name_ar: string;
    full_name_en: string | null;
  } | null;
  assets: Array<{
    id: string;
    status_code: string;
    condition_code: string;
    receive_date: string;
    recovered_at: string | null;
    asset_record: string | null;
    asset_image_file_id: string | null;
    asset: {
      id: string;
      type: string;
      name: string;
      price: string;
      vehicle_id: string | null;
    };
  }>;
};

function getAssetTypeIcon(type: string) {
  switch (type.toUpperCase()) {
    case "VEHICLE":
      return <Car className="h-5 w-5 shrink-0 text-primary/70" />;
    case "MOTORCYCLE":
      return <Bike className="h-5 w-5 shrink-0 text-primary/70" />;
    case "PHONE":
      return <Smartphone className="h-5 w-5 shrink-0 text-primary/70" />;
    case "HELMET":
      return <HardHat className="h-5 w-5 shrink-0 text-primary/70" />;
    case "VEST":
      return <Shirt className="h-5 w-5 shrink-0 text-primary/70" />;
    case "BAG":
      return <ShoppingBag className="h-5 w-5 shrink-0 text-primary/70" />;
    default:
      return <Package className="h-5 w-5 shrink-0 text-primary/70" />;
  }
}

export function EmployeeAssetsViewModal({
  isOpen,
  onClose,
  employmentRecordId,
  locale,
  onEditAssignment,
}: {
  isOpen: boolean;
  onClose: () => void;
  employmentRecordId: string | null;
  locale: string;
  onEditAssignment: (assignmentId: string) => void;
}) {
  const t = useTranslations("assets");
  const tCommon = useTranslations("common");
  const [record, setRecord] = useState<EmployeeAssetsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !employmentRecordId) {
      setRecord(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setRecord(null);
    setError(null);

    async function load() {
      try {
        const res = await fetch(
          `/api/assets/employees/${employmentRecordId}/assets`
        );
        const data = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) {
          setError(data?.message ?? "Failed");
          setRecord(null);
          setLoading(false);
          return;
        }
        setRecord(data as EmployeeAssetsResponse);
        setError(null);
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed");
          setRecord(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, employmentRecordId]);

  if (!isOpen) return null;

  const displayName =
    record?.full_name_ar ??
    record?.full_name_en ??
    record?.recruitment_candidate?.full_name_ar ??
    record?.recruitment_candidate?.full_name_en ??
    "—";
  const totalValue =
    record?.assets.reduce(
      (sum, a) => sum + Number(a.asset?.price ?? 0),
      0
    ) ?? 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("viewEmployeeAssets")}
      maxWidth="4xl"
      contentClassName="p-0"
      modalClassName="max-h-[90vh] flex flex-col"
    >
      <div className="flex max-h-[85vh] flex-col overflow-hidden">
        {loading ? (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="text-sm text-primary/60">{tCommon("loading")}</div>
          </div>
        ) : error ? (
          <div
            role="alert"
            className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p>{error}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="mt-3 rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/30"
                >
                  {tCommon("cancel")}
                </button>
              </div>
            </div>
          </div>
        ) : record ? (
          <>
            {/* Header / hero block - sticky so list scrolls below */}
            <div className="shrink-0 border-b border-zinc-200 bg-zinc-50/80 px-6 py-4 dark:border-zinc-700 dark:bg-zinc-800/80">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <span className="text-lg font-bold text-primary">
                    {displayName.charAt(0)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-primary">
                    {record.full_name_ar ?? record.recruitment_candidate?.full_name_ar ?? "—"}
                  </h3>
                  <p className="text-sm text-primary/60">
                    {record.full_name_en ?? record.recruitment_candidate?.full_name_en ?? ""}
                  </p>
                </div>
              </div>
              {/* Summary row */}
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                <span className="rounded-full bg-primary/10 px-3 py-1 font-medium text-primary">
                  {t("assetsCount", {
                    count: record.assets.length,
                  })}
                </span>
                <span className="text-primary/70">
                  {t("totalValue")}:{" "}
                  <span className="font-semibold text-primary">
                    <CurrencyWithRiyal amount={totalValue} formattedAmount={totalValue.toLocaleString()} symbolSize="sm" />
                  </span>
                </span>
              </div>
            </div>

            {/* Asset list - scrollable, header stays visible */}
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {record.assets.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-600">
                  <Package className="mb-3 h-12 w-12 text-primary/40" />
                  <p className="text-sm text-primary/70">
                    {t("noAssetsAssigned")}
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {record.assets.map((assignment) => {
                    const isRecovered =
                      assignment.status_code === "RECOVERED" ||
                      Boolean(assignment.recovered_at);
                    const isDamagedOrLost =
                      assignment.status_code === "DAMAGED" ||
                      assignment.status_code === "LOST";

                    return (
                      <li
                        key={assignment.id}
                        className="rounded-lg border border-zinc-200 bg-white transition-colors hover:bg-zinc-50 focus-within:ring-2 focus-within:ring-primary/20 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700/50"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3 p-4">
                          <div className="flex min-w-0 flex-1 gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/5">
                              {getAssetTypeIcon(
                                assignment.asset?.type ?? "OTHER"
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-primary">
                                {assignment.asset?.name ?? "—"}
                              </div>
                              <div className="mt-0.5 text-xs text-primary/60">
                                {assignment.asset?.type ?? "—"}
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <span
                                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                    isDamagedOrLost
                                      ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                      : isRecovered
                                        ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400"
                                        : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                  }`}
                                >
                                  {isDamagedOrLost
                                    ? t("statusDamaged")
                                    : isRecovered
                                      ? t("statusRecovered")
                                      : t("statusAssigned")}
                                </span>
                                <span className="text-xs text-primary/60">
                                  {t("condition")}:{" "}
                                  {assignment.condition_code ?? "—"}
                                </span>
                                <span className="text-xs text-primary/60">
                                  {t("receiveDate")}:{" "}
                                  {assignment.receive_date
                                    ? format(
                                        new Date(assignment.receive_date),
                                        "yyyy-MM-dd"
                                      )
                                    : "—"}
                                </span>
                                {assignment.recovered_at && (
                                  <span className="text-xs text-primary/60">
                                    {t("recoveredAt")}{" "}
                                    {format(
                                      new Date(assignment.recovered_at),
                                      "yyyy-MM-dd"
                                    )}
                                  </span>
                                )}
                              </div>
                              <div className="mt-1 text-sm font-medium text-primary">
                                <CurrencyWithRiyal
                                  amount={Number(assignment.asset?.price ?? 0)}
                                  formattedAmount={Number(assignment.asset?.price ?? 0).toLocaleString()}
                                  symbolSize="sm"
                                />
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => onEditAssignment(assignment.id)}
                            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-primary hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                            title={t("editAssignment")}
                            aria-label={t("editAssignment")}
                          >
                            <Pencil className="h-4 w-4" />
                            {t("editAssignment")}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
