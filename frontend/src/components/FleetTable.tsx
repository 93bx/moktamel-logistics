"use client";

import { useTranslations } from "next-intl";
import Tooltip from "@mui/material/Tooltip";
import { Eye, Pencil, Trash2, UserPlus, ArrowRightLeft, Wrench, Fuel, FileText, Shield, Activity, CreditCard } from "lucide-react";
import { VehicleListItem } from "@/app/[locale]/(app)/fleet/page";
import { StatusBadge } from "./StatusBadge";
import { LicensePlate } from "./LicensePlate";

export function FleetTable({
  locale,
  items,
  onView,
  onEdit,
  onDelete,
  onAssign,
  onTransfer,
  onMaintenance,
  onGas,
}: {
  locale: string;
  items: VehicleListItem[];
  onView: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onAssign?: (id: string) => void;
  onTransfer?: (id: string) => void;
  onMaintenance?: (id: string) => void;
  onGas?: (id: string) => void;
}) {
  const t = useTranslations();

  const getDocIconColor = (expiryDate: string) => {
    const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 40) return "text-red-500";
    if (days < 80) return "text-amber-500";
    return "text-emerald-500";
  };

  const getDocStatus = (expiryDate: string) => {
    const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { labelKey: "fleet.docExpired", colorClass: "text-red-500" as const };
    if (days < 40) return { labelKey: "fleet.daysLeft", colorClass: "text-red-500" as const, days };
    if (days < 80) return { labelKey: "fleet.daysLeft", colorClass: "text-amber-500" as const, days };
    return { labelKey: "fleet.daysLeft", colorClass: "text-emerald-500" as const, days };
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-primary">
          <thead className="border-b border-zinc-200 text-left dark:border-zinc-700">
            <tr className={`${locale === "ar" ? "text-right" : "text-left"}`}>
              <th className="px-3 py-3">{t("fleet.vehicleInfo")}</th>
              <th className="px-3 py-3">{t("fleet.licensePlate")}</th>
              <th className="px-3 py-3">{t("common.status")}</th>
              <th className="px-3 py-3">{t("fleet.currentOdometer")}</th>
              <th className="px-3 py-3">{t("fleet.documents")}</th>
              <th className="px-3 py-3">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((v) => (
              <tr
                key={v.id}
                className={`border-b border-zinc-100 dark:border-zinc-700 ${locale === "ar" ? "text-right" : "text-left"}`}
              >
                <td className="px-3 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 flex-shrink-0 rounded bg-zinc-100 dark:bg-zinc-700 flex items-center justify-center overflow-hidden">
                      {v.status_code === "ACTIVE" && v.current_driver?.avatar_file_id ? (
                        <img
                          src={`/api/files/${v.current_driver.avatar_file_id}/view`}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold text-zinc-400">
                          {v.type_code === "MOTORCYCLE" ? "🏍️" : "🚗"}
                        </span>
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{v.model}</div>
                      <div className="text-xs text-primary/60">{v.year}</div>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3"><LicensePlate value={v.license_plate} size="sm" /></td>
                <td className="px-3 py-3">
                  <div className="inline-flex w-fit flex-col gap-1 items-start">
                    <StatusBadge status={v.status_code} />
                    {v.status_code === "ACTIVE" && v.current_driver && (
                      <span className="text-xs text-primary/60">
                        {locale === "ar"
                          ? v.current_driver.full_name_ar
                          : (v.current_driver.full_name_en ?? v.current_driver.full_name_ar)}
                        {v.current_driver.employee_code ? ` (${v.current_driver.employee_code})` : ""}
                      </span>
                    )}
                    {v.status_code === "AVAILABLE" && (
                      <span className="text-xs text-primary/60">{t("fleet.inWarehouse")}</span>
                    )}
                    {v.status_code === "MAINTENANCE" && (
                      <span className="text-xs text-primary/60">
                        {v.maintenance_logs?.[0]?.workshop_name ?? t("fleet.inWorkshop")}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-3">{v.current_odometer.toLocaleString()} km</td>
                <td className="px-3 py-3">
                  <div className="flex gap-1.5">
                    {/* Simplified: we check the 4 doc types */}
                    {["REGISTRATION", "INSURANCE", "CHECKUP", "OPERATING_CARD"].map((type) => {
                      const doc = v.documents.find((d) => d.type_code === type);
                      if (!doc && type === "OPERATING_CARD" && v.type_code !== "MOTORCYCLE") return null;

                      const docLabelKey =
                        type === "REGISTRATION" ? "fleet.registration" :
                        type === "INSURANCE" ? "fleet.insurance" :
                        type === "CHECKUP" ? "fleet.periodicCheck" : "fleet.operatingCard";

                      const colorClass = doc ? getDocIconColor(doc.expiry_date) : "text-zinc-300 dark:text-zinc-600";
                      const status = doc ? getDocStatus(doc.expiry_date) : null;
                      const statusText = status
                        ? "days" in status && status.days !== undefined
                          ? t("fleet.daysLeft", { count: status.days })
                          : t("fleet.docExpired")
                        : t("fleet.docNotUploaded");
                      const statusColorClass = status?.colorClass ?? "text-zinc-400";

                      const tooltipContent = (
                        <div className="flex flex-col gap-0.5 py-0.5">
                          <span className="font-medium text-zinc-100">{t(docLabelKey)}</span>
                          <span className={statusColorClass}>{statusText}</span>
                        </div>
                      );

                      const Icon = type === "REGISTRATION" ? FileText :
                                   type === "INSURANCE" ? Shield :
                                   type === "CHECKUP" ? Activity : CreditCard;

                      return (
                        <Tooltip
                          key={type}
                          title={tooltipContent}
                          arrow
                          placement="top"
                          slotProps={{
                            popper: {
                              sx: {
                                "& .MuiTooltip-tooltip": {
                                  backgroundColor: "rgb(39 39 42)",
                                  color: "rgb(244 244 245)",
                                  border: "1px solid rgb(63 63 70)",
                                  borderRadius: "8px",
                                  boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                                  padding: "10px 14px",
                                  fontSize: "0.8125rem",
                                },
                                "& .MuiTooltip-arrow": {
                                  color: "rgb(39 39 42)",
                                  "&::before": { border: "1px solid rgb(63 63 70)" },
                                },
                              },
                            },
                          }}
                        >
                          <span className="cursor-help inline-flex">
                            <Icon className={`h-4 w-4 ${colorClass}`} />
                          </span>
                        </Tooltip>
                      );
                    })}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onView(v.id)}
                      className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                      title={t("common.view")}
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {onEdit && (
                      <button
                        onClick={() => onEdit(v.id)}
                        className="rounded-md p-1.5 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                        title={t("common.edit")}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {v.status_code === "AVAILABLE" && onAssign && (
                      <button
                        onClick={() => onAssign(v.id)}
                        className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                        title={t("fleet.assignToEmployee")}
                      >
                        <UserPlus className="h-4 w-4" />
                      </button>
                    )}
                    {v.status_code === "ACTIVE" && onTransfer && (
                      <button
                        onClick={() => onTransfer(v.id)}
                        className="rounded-md p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        title={t("fleet.transferToEmployee")}
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                      </button>
                    )}
                    {onMaintenance && (
                      <button
                        onClick={() => onMaintenance(v.id)}
                        className="rounded-md p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                        title={v.status_code === "MAINTENANCE" ? t("fleet.exitMaintenance") : t("fleet.putInMaintenance")}
                      >
                        <Wrench className="h-4 w-4" />
                      </button>
                    )}
                    {onGas && v.status_code !== "MAINTENANCE" && (
                      <button
                        onClick={() => onGas(v.id)}
                        className="rounded-md p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                        title={t("fleet.addGasRecord")}
                      >
                        <Fuel className="h-4 w-4" />
                      </button>
                    )}
                    {onDelete && v.status_code === "AVAILABLE" && (
                      <button
                        onClick={() => onDelete(v.id)}
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
            {items.length === 0 && (
              <tr>
                <td className="px-3 py-10 text-center text-primary/60" colSpan={6}>
                  {t("common.noResults")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

