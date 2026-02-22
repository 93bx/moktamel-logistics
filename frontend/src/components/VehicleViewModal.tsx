"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "./Modal";
import { StatusBadge } from "./StatusBadge";
import { LicensePlate } from "./LicensePlate";
import { CandidateImageCard } from "./CandidateImageCard";
import { ImageViewerModal } from "./ImageViewerModal";
import { User, Wrench, ArrowRightLeft, UserMinus, UserPlus, FileText, Eye, Download, Printer } from "lucide-react";

async function downloadFile(url: string, filename: string) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename || "file";
    a.click();
    URL.revokeObjectURL(blobUrl);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

function printFile(url: string, title: string) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`
    <!DOCTYPE html>
    <html>
      <head><title>${title}</title></head>
      <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;">
        <img src="${url}" alt="${title}" style="max-width:100%;height:auto;" />
      </body>
    </html>
  `);
  w.document.close();
  w.onload = () => {
    w.print();
    w.close();
  };
}

interface VehicleViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
  vehicleId: string | null;
  onAssign?: (id: string) => void;
  onTransfer?: (id: string) => void;
  onMaintenance?: (id: string) => void;
  onUnassign?: (id: string) => void;
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

export function VehicleViewModal({
  isOpen,
  onClose,
  locale,
  vehicleId,
  onAssign,
  onTransfer,
  onMaintenance,
  onUnassign,
}: VehicleViewModalProps) {
  const t = useTranslations();
  const [activeTab, setActiveTab] = useState<"info" | "documents" | "logs" | "maintenance" | "gas">("info");
  const [loading, setLoading] = useState(false);
  const [vehicle, setVehicle] = useState<any>(null);
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [viewerState, setViewerState] = useState<{ url: string; title: string; filename: string } | null>(null);

  useEffect(() => {
    if (isOpen && vehicleId) {
      setLoading(true);
      fetch(`/api/fleet/vehicles/${vehicleId}`)
        .then((res) => res.json())
        .then((data) => {
          setVehicle(data);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [isOpen, vehicleId]);

  useEffect(() => {
    if (!vehicle) {
      setDocumentUrls({});
      return;
    }
    const docsWithFile = (vehicle.documents ?? []).filter((d: { file_id: string | null }) => d.file_id);
    const maintenanceWithInvoice = (vehicle.maintenance_logs ?? []).filter(
      (log: { invoice_file_id: string | null }) => log.invoice_file_id
    );
    const gasWithInvoice = (vehicle.gas_logs ?? []).filter(
      (log: { invoice_file_id: string | null }) => log.invoice_file_id
    );
    if (docsWithFile.length === 0 && maintenanceWithInvoice.length === 0 && gasWithInvoice.length === 0) {
      setDocumentUrls({});
      return;
    }
    let cancelled = false;
    const urlMap: Record<string, string> = {};
    const fetchUrl = async (key: string, fileId: string) => {
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
    };
    Promise.all([
      ...docsWithFile.map((doc: { id: string; file_id: string }) => fetchUrl(doc.id, doc.file_id)),
      ...maintenanceWithInvoice.map((log: { id: string; invoice_file_id: string }) =>
        fetchUrl(`maintenance_${log.id}`, log.invoice_file_id)
      ),
      ...gasWithInvoice.map((log: { id: string; invoice_file_id: string }) =>
        fetchUrl(`gas_${log.id}`, log.invoice_file_id)
      ),
    ]).then(() => {
      if (!cancelled) setDocumentUrls(urlMap);
    });
    return () => {
      cancelled = true;
    };
  }, [vehicle]);

  if (!isOpen) return null;

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

  const getDocumentTypeLabel = (typeCode: string): string => {
    const map: Record<string, string> = {
      REGISTRATION: t("fleet.registration"),
      INSURANCE: t("fleet.insurance"),
      CHECKUP: t("fleet.periodicCheck"),
      OPERATING_CARD: t("fleet.operatingCard"),
    };
    return map[typeCode] ?? typeCode;
  };

  const calculateDaysSince = (dateString: string) => {
    const start = new Date(dateString);
    const diffTime = Math.abs(Date.now() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose} title={t("fleet.viewVehicle")} maxWidth="5xl">
      {loading || !vehicle ? (
        <div className="py-20 text-center text-zinc-400">{t("common.loading")}</div>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col gap-6 md:flex-row">
            <div className="flex w-full flex-col items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 p-6 md:w-1/4 dark:border-zinc-700 dark:bg-zinc-900/50">
              <div className="mb-4 h-32 w-32 rounded bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                <span className="text-4xl">{vehicle.type_code === "MOTORCYCLE" ? "🏍️" : "🚗"}</span>
              </div>
              <div className="text-center">
                <LicensePlate value={vehicle.license_plate} size="lg" />
                <div className="mt-2">
                  <StatusBadge status={vehicle.status_code} />
                </div>
              </div>
            </div>

            <div className="flex-1 rounded-lg border border-zinc-200 p-6 dark:border-zinc-700">
              {vehicle.status_code === "ACTIVE" && vehicle.current_driver ? (
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-primary uppercase tracking-wider">{t("fleet.currentDriver")}</h4>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <User className="h-8 w-8" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-primary">{vehicle.current_driver.full_name_ar}</div>
                      <div className="text-sm text-primary/60">{vehicle.current_driver.full_name_en}</div>
                      <div className="mt-1 text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded inline-block">
                        {vehicle.current_driver.employee_code}
                      </div>
                    </div>
                  </div>
                </div>
              ) : vehicle.status_code === "AVAILABLE" ? (
                <div className="flex h-full flex-col items-center justify-center text-center space-y-2">
                  <div className="text-2xl font-bold text-amber-600">{t("fleet.inWarehouse")}</div>
                  <div className="text-sm text-primary/60">
                    {t("fleet.idle")} - {calculateDaysSince(vehicle.idle_since || vehicle.updated_at)} {t("fleet.days")}
                  </div>
                </div>
              ) : vehicle.status_code === "MAINTENANCE" ? (
                <div className="flex h-full flex-col items-center justify-center text-center space-y-2">
                  <div className="text-2xl font-bold text-red-600">{t("fleet.inWorkshop")}</div>
                  {vehicle.maintenance_logs?.[0] && (
                    <>
                      <div className="font-semibold text-primary">{vehicle.maintenance_logs[0].workshop_name}</div>
                      <div className="text-sm text-primary/60">
                        {calculateDaysSince(vehicle.maintenance_logs[0].start_date)} {t("fleet.days")}
                      </div>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-y border-zinc-100 py-4 dark:border-zinc-800">
            {vehicle.status_code === "AVAILABLE" && (
              <>
                <button
                  onClick={() => onAssign?.(vehicle.id)}
                  className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
                >
                  <UserPlus className="h-4 w-4" />
                  {t("fleet.assignToEmployee")}
                </button>
                <button
                  onClick={() => onMaintenance?.(vehicle.id)}
                  className="flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                >
                  <Wrench className="h-4 w-4" />
                  {t("fleet.putInMaintenance")}
                </button>
              </>
            )}
            {vehicle.status_code === "ACTIVE" && (
              <>
                <button
                  onClick={() => onUnassign?.(vehicle.id)}
                  className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                >
                  <UserMinus className="h-4 w-4" />
                  {t("fleet.unassign")}
                </button>
                <button
                  onClick={() => onTransfer?.(vehicle.id)}
                  className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  {t("fleet.transferToEmployee")}
                </button>
                <button
                  onClick={() => onMaintenance?.(vehicle.id)}
                  className="flex items-center gap-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700"
                >
                  <Wrench className="h-4 w-4" />
                  {t("fleet.putInMaintenance")}
                </button>
              </>
            )}
            {vehicle.status_code === "MAINTENANCE" && (
              <button
                onClick={() => onMaintenance?.(vehicle.id)}
                className="flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
              >
                <Wrench className="h-4 w-4" />
                {t("fleet.exitMaintenance")}
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex border-b border-zinc-100 dark:border-zinc-800">
              <button
                onClick={() => setActiveTab("info")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "info" ? "border-b-2 border-primary text-primary" : "text-zinc-500 hover:text-primary"}`}
              >
                {t("fleet.vehicleInfo")}
              </button>
              <button
                onClick={() => setActiveTab("documents")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "documents" ? "border-b-2 border-primary text-primary" : "text-zinc-500 hover:text-primary"}`}
              >
                {t("fleet.documents")}
              </button>
              <button
                onClick={() => setActiveTab("logs")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "logs" ? "border-b-2 border-primary text-primary" : "text-zinc-500 hover:text-primary"}`}
              >
                {t("fleet.logs")}
              </button>
              <button
                onClick={() => setActiveTab("maintenance")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "maintenance" ? "border-b-2 border-primary text-primary" : "text-zinc-500 hover:text-primary"}`}
              >
                {t("fleet.maintenance")}
              </button>
              <button
                onClick={() => setActiveTab("gas")}
                className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "gas" ? "border-b-2 border-primary text-primary" : "text-zinc-500 hover:text-primary"}`}
              >
                {t("fleet.gas")}
              </button>
            </div>

            {activeTab === "info" && (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500 uppercase">{t("fleet.vehicleType")}</div>
                  <div className="font-medium">{t(`fleet.${vehicle.type_code.toLowerCase()}`)}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500 uppercase">{t("fleet.model")}</div>
                  <div className="font-medium">{vehicle.model} ({vehicle.year})</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500 uppercase">{t("fleet.vin")}</div>
                  <div className="font-medium font-mono">{vehicle.vin}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500 uppercase">{t("fleet.gpsTrackerId")}</div>
                  <div className="font-medium">{vehicle.gps_tracker_id || "-"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500 uppercase">{t("fleet.currentOdometer")}</div>
                  <div className="font-medium">{vehicle.current_odometer.toLocaleString()} km</div>
                </div>
                <div className="space-y-1 border-t border-zinc-100 pt-2 dark:border-zinc-800 col-span-full" />
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500 uppercase">{t("fleet.purchaseDate")}</div>
                  <div className="font-medium">{vehicle.purchase_date?.split("T")[0] || "-"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500 uppercase">{t("fleet.purchasePrice")}</div>
                  <div className="font-medium">{vehicle.purchase_price ? `${parseFloat(vehicle.purchase_price).toLocaleString()} SAR` : "-"}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-zinc-500 uppercase">{t("fleet.purchaseCondition")}</div>
                  <div className="font-medium">{t(`fleet.${vehicle.purchase_condition.toLowerCase()}`)}</div>
                </div>
              </div>
            )}

            {activeTab === "documents" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {!vehicle.documents?.length ? (
                  <div className="col-span-full rounded-md border border-dashed border-zinc-300 bg-white p-6 text-center text-primary/60 dark:border-zinc-600 dark:bg-zinc-800/50">
                    <FileText className="mx-auto h-10 w-10 text-primary/40" />
                    <p className="mt-2 text-sm">{t("fleet.noDocuments")}</p>
                  </div>
                ) : (
                  vehicle.documents?.map((doc: { id: string; type_code: string; number: string | null; expiry_date: string; issuer: string | null; file_id: string | null }) =>
                    documentUrls[doc.id] ? (
                      <CandidateImageCard
                        key={doc.id}
                        src={documentUrls[doc.id]}
                        alt={getDocumentTypeLabel(doc.type_code)}
                        label={`${getDocumentTypeLabel(doc.type_code)}${doc.number ? ` (${doc.number})` : ""} · ${formatDate(doc.expiry_date)}${doc.issuer ? ` · ${doc.issuer}` : ""}`}
                        downloadFilename={`${vehicle.license_plate}_${doc.type_code}`}
                        onView={() =>
                          setViewerState({
                            url: documentUrls[doc.id],
                            title: getDocumentTypeLabel(doc.type_code),
                            filename: `${vehicle.license_plate}_${doc.type_code}`,
                          })
                        }
                      />
                    ) : (
                      <DocumentPlaceholder
                        key={doc.id}
                        label={getDocumentTypeLabel(doc.type_code)}
                        detail={`${doc.number || "-"} · ${formatDate(doc.expiry_date)}${doc.issuer ? ` · ${doc.issuer}` : ""}`}
                      />
                    )
                  )
                )}
              </div>
            )}

            {activeTab === "logs" && (
              <div className="overflow-hidden rounded-md border border-zinc-100 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                    <tr className={`${locale === "ar" ? "text-right" : "text-left"}`}>
                      <th className="px-3 py-2">{t("common.date")}</th>
                      <th className="px-3 py-2">{t("fleet.logs")}</th>
                      <th className="px-3 py-2">{t("common.name")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicle.assignment_logs?.map((log: any) => (
                      <tr key={log.id} className="border-t border-zinc-100 dark:border-zinc-800">
                        <td className="px-3 py-2 whitespace-nowrap">{new Date(log.assigned_at).toLocaleString()}</td>
                        <td className="px-3 py-2">{t("fleet.assignToEmployee")}</td>
                        <td className="px-3 py-2 font-medium">{log.employee.full_name_ar}</td>
                      </tr>
                    ))}
                    {(!vehicle.assignment_logs || vehicle.assignment_logs.length === 0) && (
                      <tr>
                        <td colSpan={3} className="px-3 py-6 text-center text-zinc-400">
                          {t("common.noResults")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "maintenance" && (
              <div className="overflow-hidden rounded-md border border-zinc-100 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                    <tr className={`${locale === "ar" ? "text-right" : "text-left"}`}>
                      <th className="px-3 py-2">{t("fleet.startDate")}</th>
                      <th className="px-3 py-2">{t("fleet.endDate")}</th>
                      <th className="px-3 py-2">{t("fleet.workshopName")}</th>
                      <th className="px-3 py-2">{t("fleet.cost")}</th>
                      <th className="px-3 py-2">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicle.maintenance_logs?.map((log: any) => {
                      const invoiceKey = `maintenance_${log.id}`;
                      const invoiceUrl = documentUrls[invoiceKey];
                      const invoiceLabel = `${t("fleet.maintenanceInvoice")} – ${log.workshop_name} – ${formatDate(log.start_date)}`;
                      const invoiceFilename = `${vehicle.license_plate}_maintenance_${log.start_date.split("T")[0]}`;
                      return (
                        <tr key={log.id} className="border-t border-zinc-100 dark:border-zinc-800">
                          <td className="px-3 py-2 whitespace-nowrap">{log.start_date.split("T")[0]}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{log.end_date?.split("T")[0] || t("fleet.inWorkshop")}</td>
                          <td className="px-3 py-2">{log.workshop_name}</td>
                          <td className="px-3 py-2">{log.cost ? `${parseFloat(log.cost).toLocaleString()} SAR` : "-"}</td>
                          <td className="px-3 py-2">
                            {log.invoice_file_id ? (
                              invoiceUrl ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setViewerState({
                                        url: invoiceUrl,
                                        title: invoiceLabel,
                                        filename: invoiceFilename,
                                      })
                                    }
                                    className="rounded p-1.5 text-primary/70 hover:bg-zinc-100 hover:text-primary dark:hover:bg-zinc-700"
                                    title={t("common.view")}
                                    aria-label={t("common.view")}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => downloadFile(invoiceUrl, invoiceFilename)}
                                    className="rounded p-1.5 text-primary/70 hover:bg-zinc-100 hover:text-primary dark:hover:bg-zinc-700"
                                    title={t("common.download")}
                                    aria-label={t("common.download")}
                                  >
                                    <Download className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => printFile(invoiceUrl, invoiceLabel)}
                                    className="rounded p-1.5 text-primary/70 hover:bg-zinc-100 hover:text-primary dark:hover:bg-zinc-700"
                                    title={t("common.print")}
                                    aria-label={t("common.print")}
                                  >
                                    <Printer className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-primary/50">{t("common.loading")}</span>
                              )
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {(!vehicle.maintenance_logs || vehicle.maintenance_logs.length === 0) && (
                      <tr>
                        <td colSpan={5} className="px-3 py-6 text-center text-zinc-400">
                          {t("common.noResults")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === "gas" && (
              <div className="overflow-hidden rounded-md border border-zinc-100 dark:border-zinc-800">
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/50">
                    <tr className={`${locale === "ar" ? "text-right" : "text-left"}`}>
                      <th className="px-3 py-2">{t("fleet.date")}</th>
                      <th className="px-3 py-2">{t("fleet.gasQuantityLiters")}</th>
                      <th className="px-3 py-2">{t("fleet.gasCost")}</th>
                      <th className="px-3 py-2">{t("fleet.paymentMethod")}</th>
                      <th className="px-3 py-2">{t("fleet.notes")}</th>
                      <th className="px-3 py-2">{t("common.actions")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehicle.gas_logs?.map((log: { id: string; date: string; gas_quantity_liters: string | number; gas_cost: string | number; payment_method_code: string; notes: string | null; invoice_file_id: string | null }) => {
                      const invoiceKey = `gas_${log.id}`;
                      const invoiceUrl = documentUrls[invoiceKey];
                      const invoiceLabel = `${t("fleet.uploadInvoice")} – ${formatDate(log.date)}`;
                      const invoiceFilename = `${vehicle.license_plate}_gas_${log.date.split("T")[0]}`;
                      const paymentLabel =
                        log.payment_method_code === "CASH"
                          ? t("fleet.paymentCash")
                          : log.payment_method_code === "CARD"
                            ? t("fleet.paymentCard")
                            : t("fleet.paymentInvoice");
                      return (
                        <tr key={log.id} className="border-t border-zinc-100 dark:border-zinc-800">
                          <td className="px-3 py-2 whitespace-nowrap">{formatDate(log.date)}</td>
                          <td className="px-3 py-2">{Number(log.gas_quantity_liters).toLocaleString()} L</td>
                          <td className="px-3 py-2">{Number(log.gas_cost).toLocaleString()} SAR</td>
                          <td className="px-3 py-2">{paymentLabel}</td>
                          <td className="px-3 py-2 max-w-[12rem] truncate" title={log.notes ?? undefined}>{log.notes || "—"}</td>
                          <td className="px-3 py-2">
                            {log.invoice_file_id ? (
                              invoiceUrl ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setViewerState({
                                        url: invoiceUrl,
                                        title: invoiceLabel,
                                        filename: invoiceFilename,
                                      })
                                    }
                                    className="rounded p-1.5 text-primary/70 hover:bg-zinc-100 hover:text-primary dark:hover:bg-zinc-700"
                                    title={t("common.view")}
                                    aria-label={t("common.view")}
                                  >
                                    <Eye className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => downloadFile(invoiceUrl, invoiceFilename)}
                                    className="rounded p-1.5 text-primary/70 hover:bg-zinc-100 hover:text-primary dark:hover:bg-zinc-700"
                                    title={t("common.download")}
                                    aria-label={t("common.download")}
                                  >
                                    <Download className="h-4 w-4" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => printFile(invoiceUrl, invoiceLabel)}
                                    className="rounded p-1.5 text-primary/70 hover:bg-zinc-100 hover:text-primary dark:hover:bg-zinc-700"
                                    title={t("common.print")}
                                    aria-label={t("common.print")}
                                  >
                                    <Printer className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <span className="text-xs text-primary/50">{t("common.loading")}</span>
                              )
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {(!vehicle.gas_logs || vehicle.gas_logs.length === 0) && (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-zinc-400">
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

