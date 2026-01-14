"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "./Modal";
import { StatusBadge } from "./StatusBadge";
import { User, Wrench, ArrowRightLeft, UserMinus, UserPlus } from "lucide-react";

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
  const [activeTab, setActiveTab] = useState<"info" | "logs" | "maintenance">("info");
  const [loading, setLoading] = useState(false);
  const [vehicle, setVehicle] = useState<any>(null);

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

  if (!isOpen) return null;

  const calculateDaysSince = (dateString: string) => {
    const start = new Date(dateString);
    const diffTime = Math.abs(Date.now() - start.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
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
                <div className="text-2xl font-bold font-mono tracking-wider">{vehicle.license_plate}</div>
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
                    </tr>
                  </thead>
                  <tbody>
                    {vehicle.maintenance_logs?.map((log: any) => (
                      <tr key={log.id} className="border-t border-zinc-100 dark:border-zinc-800">
                        <td className="px-3 py-2 whitespace-nowrap">{log.start_date.split("T")[0]}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{log.end_date?.split("T")[0] || t("fleet.inWorkshop")}</td>
                        <td className="px-3 py-2">{log.workshop_name}</td>
                        <td className="px-3 py-2">{log.cost ? `${parseFloat(log.cost).toLocaleString()} SAR` : "-"}</td>
                      </tr>
                    ))}
                    {(!vehicle.maintenance_logs || vehicle.maintenance_logs.length === 0) && (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-zinc-400">
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
  );
}

