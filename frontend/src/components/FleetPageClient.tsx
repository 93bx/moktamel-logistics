"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { VehicleListItem, FleetStatsData } from "@/app/[locale]/(app)/fleet/page";
import { FleetTable } from "./FleetTable";
import { VehicleFormModal } from "./VehicleFormModal";
import { VehicleViewModal } from "./VehicleViewModal";
import { VehicleAssignModal } from "./VehicleAssignModal";
import { VehicleTransferModal } from "./VehicleTransferModal";
import { VehicleMaintenanceModal } from "./VehicleMaintenanceModal";
import { GasFormModal } from "./GasFormModal";
import { CurrencyWithRiyal } from "./CurrencyWithRiyal";
import { useRouter } from "next/navigation";

export function FleetPageClient({
  locale,
  data,
  stats,
  searchParams,
  page,
}: {
  locale: string;
  data: { items: VehicleListItem[]; total: number; page: number; page_size: number };
  stats: FleetStatsData;
  searchParams: { q?: string; status?: string };
  page: number;
}) {
  const t = useTranslations();
  const router = useRouter();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showGasModal, setShowGasModal] = useState(false);
  const [gasPreFillVehicleId, setGasPreFillVehicleId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm(t("common.confirmDelete"))) return;
    try {
      const res = await fetch(`/api/fleet/vehicles/${id}`, { method: "DELETE" });
      if (res.ok) router.refresh();
      else {
        const body = await res.json().catch(() => ({}));
        const msg = body?.message ?? t("fleet.deleteOnlyWhenIdle");
        alert(msg);
      }
    } catch (e) {
      console.error(e);
      alert(t("fleet.deleteOnlyWhenIdle"));
    }
  };

  const handleUnassign = async (id: string) => {
    const odo = prompt(t("fleet.currentOdometer") + " (km)");
    if (!odo) return;
    try {
      const res = await fetch(`/api/fleet/vehicles/${id}/unassign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ odometer: parseFloat(odo) }),
      });
      if (res.ok) router.refresh();
      else alert("Unassign failed");
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="text-sm text-primary/60">{t("fleet.totalFleet")}</div>
          <div className="mt-1 text-2xl font-semibold text-primary">{stats.totalFleet}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="text-sm text-primary/60">{t("fleet.onDuty")}</div>
          <div className="mt-1 text-2xl font-semibold text-primary">{stats.onDuty}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="text-sm text-primary/60">{t("fleet.idle")}</div>
          <div className="mt-1 text-2xl font-semibold text-primary">{stats.idle}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="text-sm text-primary/60">{t("fleet.inWorkshop")}</div>
          <div className="mt-1 text-2xl font-semibold text-primary">{stats.inWorkshop}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
          <div className="text-sm text-primary/60">{t("fleet.maintenanceCostThisMonth")}</div>
          <div className="mt-1 text-2xl font-semibold text-primary">
            <CurrencyWithRiyal
              amount={stats.maintenanceCostThisMonth}
              formattedAmount={new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(stats.maintenanceCostThisMonth)}
              symbolSize="lg"
            />
          </div>
        </div>
      </div>

      {/* Controls Row */}
      <form 
        className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between" 
        action={`/${locale}/fleet`} 
        method="get"
      >
        <div className="flex w-full max-w-2xl gap-2">
          <input
            name="q"
            defaultValue={searchParams.q ?? ""}
            placeholder={t("common.search")}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary placeholder:text-primary/50 dark:border-zinc-700 dark:bg-zinc-800"
          />
          <select
            name="status"
            defaultValue={searchParams.status ?? ""}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800"
          >
            <option value="">{t("common.allStatuses")}</option>
            <option value="ACTIVE">{t("fleet.onDuty")}</option>
            <option value="AVAILABLE">{t("fleet.idle")}</option>
            <option value="MAINTENANCE">{t("fleet.inWorkshop")}</option>
          </select>
          <button
            type="submit"
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            {t("common.filter")}
          </button>
        </div>
        
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setGasPreFillVehicleId(null);
              setShowGasModal(true);
            }}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            {t("fleet.addGasRecord")}
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedVehicleId(null);
              setShowAddModal(true);
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white shadow hover:bg-primary/90"
          >
            {t("fleet.addVehicle")}
          </button>
        </div>
      </form>

      {/* Fleet Table */}
      <FleetTable 
        locale={locale} 
        items={data.items} 
        onView={(id) => {
          setSelectedVehicleId(id);
          setShowViewModal(true);
        }}
        onEdit={(id) => {
          setSelectedVehicleId(id);
          setShowEditModal(true);
        }}
        onDelete={handleDelete}
        onAssign={(id) => {
          setSelectedVehicleId(id);
          setShowAssignModal(true);
        }}
        onTransfer={(id) => {
          setSelectedVehicleId(id);
          setShowTransferModal(true);
        }}
        onMaintenance={(id) => {
          setSelectedVehicleId(id);
          setShowMaintenanceModal(true);
        }}
        onGas={(id) => {
          setGasPreFillVehicleId(id);
          setShowGasModal(true);
        }}
      />

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-primary/80">
        <div>
          {t("common.total")}: {data.total} ({t("common.page")} {data.page})
        </div>
        <div className="flex gap-2">
          <Link
            className={`rounded-md border border-zinc-200 px-3 py-1 text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
            href={`/${locale}/fleet?q=${encodeURIComponent(searchParams.q ?? "")}&status=${searchParams.status ?? ""}&page=${page - 1}`}
          >
            {t("common.prev")}
          </Link>
          <Link
            className={`rounded-md border border-zinc-200 px-3 py-1 text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 ${page * data.page_size >= data.total ? "pointer-events-none opacity-50" : ""}`}
            href={`/${locale}/fleet?q=${encodeURIComponent(searchParams.q ?? "")}&status=${searchParams.status ?? ""}&page=${page + 1}`}
          >
            {t("common.next")}
          </Link>
        </div>
      </div>

      <VehicleFormModal 
        isOpen={showAddModal || showEditModal} 
        onClose={() => {
          setShowAddModal(false);
          setShowEditModal(false);
          setSelectedVehicleId(null);
        }} 
        locale={locale} 
        vehicleId={selectedVehicleId} 
      />

      <VehicleViewModal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedVehicleId(null);
        }}
        locale={locale}
        vehicleId={selectedVehicleId}
        onAssign={(id) => {
          setShowViewModal(false);
          setShowAssignModal(true);
        }}
        onTransfer={(id) => {
          setShowViewModal(false);
          setShowTransferModal(true);
        }}
        onUnassign={handleUnassign}
        onMaintenance={(id) => {
          setShowViewModal(false);
          setShowMaintenanceModal(true);
        }}
      />

      <VehicleAssignModal
        isOpen={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setSelectedVehicleId(null);
        }}
        locale={locale}
        vehicleId={selectedVehicleId}
      />

      <VehicleTransferModal
        isOpen={showTransferModal}
        onClose={() => {
          setShowTransferModal(false);
          setSelectedVehicleId(null);
        }}
        locale={locale}
        vehicleId={selectedVehicleId}
      />

      <VehicleMaintenanceModal
        isOpen={showMaintenanceModal}
        onClose={() => {
          setShowMaintenanceModal(false);
          setSelectedVehicleId(null);
        }}
        locale={locale}
        vehicleId={selectedVehicleId}
      />

      <GasFormModal
        isOpen={showGasModal}
        onClose={() => {
          setShowGasModal(false);
          setGasPreFillVehicleId(null);
        }}
        locale={locale}
        vehicleId={gasPreFillVehicleId}
      />
    </div>
  );
}

