"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "./Modal";
import { Search, User } from "lucide-react";
import { useRouter } from "next/navigation";

interface VehicleAssignModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
  vehicleId: string | null;
}

export function VehicleAssignModal({ isOpen, onClose, locale, vehicleId }: VehicleAssignModalProps) {
  const t = useTranslations();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [odometer, setOdometer] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    if (query.length < 2) {
      return;
    }
    const delayDebounceFn = setTimeout(() => {
      setLoading(true);
      fetch(`/api/fleet/employees/search?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data) => {
          setEmployees(Array.isArray(data) ? data : []);
          setLoading(false);
        })
        .catch(() => {
          setLoading(false);
          setEmployees([]);
        });
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [query]);

  const onAssign = async () => {
    if (!selectedEmployeeId || !odometer) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/fleet/vehicles/${vehicleId}/assign`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ employee_id: selectedEmployeeId, odometer: parseFloat(odometer) }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.message);
        return;
      }
      onClose();
      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t("fleet.assignToEmployee")} maxWidth="2xl">
      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-primary">{t("fleet.currentOdometer")} (km)</label>
          <input
            type="number"
            value={odometer}
            onChange={(e) => setOdometer(e.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="0"
          />
        </div>

        <div className="relative">
          <label className="text-sm font-medium text-primary">{t("fleet.searchDriver")}</label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-md border border-zinc-200 bg-white pl-10 pr-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-900"
              placeholder={t("fleet.searchDriver")}
            />
          </div>
        </div>

        <div className="max-h-60 overflow-y-auto rounded-md border border-zinc-100 dark:border-zinc-800">
          {loading ? (
            <div className="p-4 text-center text-sm text-zinc-400">{t("common.loading")}</div>
          ) : employees.length === 0 && query.length >= 2 ? (
            <div className="p-4 text-center text-sm text-zinc-400">{t("common.noResults")}</div>
          ) : (
            employees.map((emp) => (
              <button
                key={emp.id}
                onClick={() => {
                  setSelectedEmployeeId(emp.id);
                  setQuery(`${emp.full_name_ar} (${emp.employee_code})`);
                  setEmployees([]);
                }}
                className={`flex w-full items-center gap-3 border-b border-zinc-50 p-3 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50 ${selectedEmployeeId === emp.id ? "bg-primary/5 border-primary/20" : ""}`}
              >
                <div className="h-10 w-10 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                  {emp.avatar_file_id ? (
                    <img src={`/api/files/${emp.avatar_file_id}/view`} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <User className="h-5 w-5 text-zinc-400" />
                  )}
                </div>
                <div className="flex-1 text-left">
                  <div className="font-medium">{emp.full_name_ar}</div>
                  <div className="text-xs text-primary/60">{emp.full_name_en}</div>
                </div>
                <div className="text-right text-xs">
                  <div className="font-mono">{emp.employee_code}</div>
                  <div className="text-primary/60">{emp.nationality}</div>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={onClose}
            className="rounded-md border border-zinc-200 px-4 py-2 text-sm text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onAssign}
            disabled={saving || !selectedEmployeeId || !odometer}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? t("common.saving") : t("fleet.assignToEmployee")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

