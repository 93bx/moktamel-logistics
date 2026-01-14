"use client";

import { useTranslations } from "next-intl";

export function StatusBadge({ status }: { status: string }) {
  const t = useTranslations();

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "EMPLOYMENT_STATUS_ACTIVE":
      case "ACTIVE":
        return {
          label: t("common.statusActive"),
          className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
        };
      case "IN_PROGRESS":
        return {
          label: t("common.statusInProgress"),
          className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
        };
      case "INCOMPLETE_FILE":
        return {
          label: t("common.statusIncompleteFile"),
          className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
        };
      case "NOT_ASSIGNED":
        return {
          label: t("common.statusNotAssigned"),
          className: "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-900/30 dark:text-zinc-400 dark:border-zinc-800",
        };
      case "IN_TRAINING":
        return {
          label: t("common.statusInTraining"),
          className: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800",
        };
      case "COMPLETE_FILE":
        return {
          label: t("common.statusCompleteFile"),
          className: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800",
        };
      case "ASSIGNED":
        return {
          label: t("common.statusAssigned"),
          className: "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800",
        };
      case "EMPLOYMENT_STATUS_UNDER_PROCEDURE":
        return {
          label: t("common.statusInProgress"),
          className: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800",
        };
      case "EMPLOYMENT_STATUS_READY_FOR_WORK":
        return {
          label: t("common.readyForWork"),
          className: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800",
        };
      case "AVAILABLE":
        return {
          label: t("fleet.idle"),
          className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800",
        };
      case "MAINTENANCE":
        return {
          label: t("fleet.inWorkshop"),
          className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
        };
      case "EMPLOYMENT_STATUS_LOST_CONTACT":
      case "LOST_CONTACT":
        return {
          label: t("common.lostContact"),
          className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
        };
      case "EMPLOYMENT_STATUS_ESCAPED":
      case "ESCAPED":
        return {
          label: t("common.escaped"),
          className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
        };
      case "DEACTIVATED":
        return {
          label: t("common.deactivated") || "Deactivated",
          className: "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-900/30 dark:text-zinc-400 dark:border-zinc-800",
        };
      default:
        return {
          label: status,
          className: "bg-zinc-100 text-zinc-800 border-zinc-200 dark:bg-zinc-900/30 dark:text-zinc-400 dark:border-zinc-800",
        };
    }
  };

  const { label, className } = getStatusInfo(status);

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium shadow-sm ${className}`}>
      {label}
    </span>
  );
}

