"use client";

import { useState, useEffect, useRef, Fragment } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  ChevronDown,
  ChevronUp,
  Info,
  AlertTriangle,
  AlertCircle,
  Check,
} from "lucide-react";
import {
  getNotificationTypeConfig,
  getRelevantPage,
} from "@/data/notificationTypes";
import type { NotificationItem } from "@/app/[locale]/(app)/notifications/page";

type NotificationRow = NotificationItem & { read_at: string | null };

export function NotificationsPageClient({
  locale,
  items,
  total,
  page,
  pageSize,
  expandId,
}: {
  locale: string;
  items: NotificationRow[];
  total: number;
  page: number;
  pageSize: number;
  expandId: string | null;
}) {
  const t = useTranslations();
  const [expandedId, setExpandedId] = useState<string | null>(expandId);
  const [readState, setReadState] = useState<Record<string, boolean>>({});
  const expandedRef = useRef<HTMLTableRowElement>(null);

  useEffect(() => {
    if (expandId && items.some((n) => n.id === expandId)) {
      setExpandedId(expandId);
    }
  }, [expandId, items]);

  useEffect(() => {
    if (expandedRef.current && expandedId) {
      expandedRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [expandedId]);

  const isRead = (n: NotificationRow) =>
    readState[n.id] ?? (n.read_at != null && n.read_at !== "");

  const handleMarkAsRead = async (id: string) => {
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.ok) setReadState((prev) => ({ ...prev, [id]: true }));
    } catch {
      // ignore
    }
  };

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "WARNING":
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      default:
        return <Info className="h-4 w-4 text-primary/60" />;
    }
  };

  const textDir = locale === "ar" ? "rtl" : "ltr";
  const isRtl = locale === "ar";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-primary" dir={textDir}>
          <thead className="border-b border-zinc-200 dark:border-zinc-700">
            <tr className={isRtl ? "text-right" : "text-left"}>
              <th className="px-3 py-3 font-semibold">
                {t("notifications.table.name")}
              </th>
              <th className="px-3 py-3 font-semibold">
                {t("notifications.table.priority")}
              </th>
              <th className="px-3 py-3 font-semibold">
                {t("notifications.table.description")}
              </th>
              <th className="px-3 py-3 font-semibold">
                {t("notifications.table.relevantPage")}
              </th>
              <th className="px-3 py-3 font-semibold">
                {t("notifications.table.actions")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((n) => {
              const config = getNotificationTypeConfig(n.type_code);
              const name = config
                ? t(config.nameKey)
                : n.type_code;
              const shortDesc = config
                ? t(config.shortDescriptionKey, n.payload as Record<string, string | number> ?? {})
                : "";
              const longDesc = config
                ? t(config.longDescriptionKey, n.payload as Record<string, string | number> ?? {})
                : "";
              const relevantPath = getRelevantPage(
                n.type_code,
                locale,
                n.payload
              );
              const actionLabel = config
                ? t(config.actionLabelKey)
                : t("notifications.table.viewAll");
              const severityLabel = t(`notifications.severity.${n.severity}`);
              const unread = !isRead(n);
              const expanded = expandedId === n.id;

              return (
                <Fragment key={n.id}>
                  <tr
                    key={n.id}
                    ref={expanded ? expandedRef : undefined}
                    className={`border-b border-zinc-100 dark:border-zinc-700 ${
                      unread ? "bg-primary/5 dark:bg-primary/10" : ""
                    } ${isRtl ? "text-right" : "text-left"}`}
                  >
                    <td className="px-3 py-2 font-medium">{name}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        {severityIcon(n.severity)}
                        {severityLabel}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-xs truncate" title={shortDesc}>
                      {shortDesc || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={relevantPath}
                        className="text-primary-600 hover:underline dark:text-primary-400"
                      >
                        {t("notifications.table.relevantPage")}
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={relevantPath}
                          className="rounded border border-zinc-200 px-2 py-1 text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                        >
                          {actionLabel}
                        </Link>
                        {unread && (
                          <button
                            type="button"
                            onClick={() => handleMarkAsRead(n.id)}
                            className="inline-flex items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-primary hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                          >
                            <Check className="h-3 w-3" />
                            {t("notifications.table.markAsRead")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId((id) => (id === n.id ? null : n.id))
                          }
                          className="inline-flex items-center rounded p-1 text-primary hover:bg-zinc-100 dark:hover:bg-zinc-700"
                          aria-expanded={expanded}
                        >
                          {expanded ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded && (
                    <tr
                      key={`${n.id}-expanded`}
                      className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50"
                    >
                      <td
                        colSpan={5}
                        className={`px-3 py-3 text-sm ${isRtl ? "text-right" : "text-left"}`}
                      >
                        {longDesc || shortDesc || "—"}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {items.length === 0 && (
        <div className="p-6 text-center text-sm text-primary/60">
          {t("common.noNotifications")}
        </div>
      )}
      {total > 0 && (
        <div
          className={`flex items-center justify-between border-t border-zinc-200 px-3 py-2 text-sm text-primary/80 dark:border-zinc-700 ${
            isRtl ? "flex-row-reverse" : ""
          }`}
        >
          <span>
            {t("common.total")}: {total} ({t("common.page")} {page})
          </span>
          <div className="flex gap-2">
            <Link
              href={`/${locale}/notifications?page=${page - 1}${expandId ? `&expand=${expandId}` : ""}`}
              className={`rounded border border-zinc-200 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 ${
                page <= 1 ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {t("common.prev")}
            </Link>
            <Link
              href={`/${locale}/notifications?page=${page + 1}${expandId ? `&expand=${expandId}` : ""}`}
              className={`rounded border border-zinc-200 px-3 py-1 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800 ${
                page * pageSize >= total ? "pointer-events-none opacity-50" : ""
              }`}
            >
              {t("common.next")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
