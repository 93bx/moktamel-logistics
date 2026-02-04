"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Bell, Info, AlertTriangle, AlertCircle, Check } from "lucide-react";
import { getNotificationTypeConfig } from "@/data/notificationTypes";

type PreviewItem = {
  id: string;
  type_code: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
};

export function NotificationBell() {
  const locale = useLocale();
  const router = useRouter();
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications/unread-count", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count ?? 0);
      }
    } catch {
      // ignore
    }
  }, []);

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications/preview?limit=10", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setPreviewItems(Array.isArray(data) ? data : []);
      } else {
        setPreviewItems([]);
      }
    } catch {
      setPreviewItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUnreadCount();
  }, [fetchUnreadCount]);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) fetchPreview();
  }, [open, fetchPreview]);

  const handleMarkAsRead = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.ok) {
        setPreviewItems((prev) => prev.filter((n) => n.id !== id));
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch {
      // ignore
    }
  };

  const handleRowClick = async (id: string) => {
    setOpen(false);
    try {
      const res = await fetch(
        `/api/notifications/page-for-id?id=${encodeURIComponent(id)}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        const page = data.page ?? 1;
        router.push(
          `/${locale}/notifications?page=${page}&expand=${encodeURIComponent(id)}`
        );
      } else {
        router.push(`/${locale}/notifications?expand=${encodeURIComponent(id)}`);
      }
    } catch {
      router.push(`/${locale}/notifications?expand=${encodeURIComponent(id)}`);
    }
  };

  const severityIcon = (severity: string) => {
    switch (severity) {
      case "CRITICAL":
        return <AlertCircle className="h-3.5 w-3 shrink-0 text-red-600" />;
      case "WARNING":
        return <AlertTriangle className="h-3.5 w-3 shrink-0 text-amber-600" />;
      default:
        return <Info className="h-3.5 w-3 shrink-0 text-primary/60" />;
    }
  };

  const isRtl = locale === "ar";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-md p-2 text-primary-50 hover:bg-primary-600 hover:text-white dark:text-primary-100 dark:hover:bg-primary-800"
        aria-label={t("common.notifications")}
        title={t("common.notifications")}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div
          className={`absolute top-full z-50 mt-1 w-80 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800 ${
            isRtl ? "left-0" : "right-0"
          }`}
        >
          <div className="max-h-96 overflow-y-auto p-2">
            {loading ? (
              <div className="py-4 text-center text-sm text-primary/60">
                {t("common.loading") || "Loading..."}
              </div>
            ) : previewItems.length === 0 ? (
              <div className="py-4 text-center text-sm text-primary/60">
                {t("common.noNotifications")}
              </div>
            ) : (
              <ul className="space-y-1">
                {previewItems.map((n) => {
                  const config = getNotificationTypeConfig(n.type_code);
                  const name = config ? t(config.nameKey) : n.type_code;
                  const shortDesc = config
                    ? t(config.shortDescriptionKey, (n.payload ?? {}) as Record<string, string | number>)
                    : "";
                  const severityLabel = t(
                    `notifications.severity.${n.severity}`
                  );
                  return (
                    <li
                      key={n.id}
                      className={`rounded-md border border-transparent hover:bg-zinc-100 dark:hover:bg-zinc-700/50 ${
                        isRtl ? "text-right" : "text-left"
                      }`}
                    >
                      <div className="flex items-start gap-2 p-2">
                        <div className="flex-1 min-w-0">
                          <button
                            type="button"
                            className={`w-full hover:opacity-90 ${isRtl ? "text-right" : "text-left"}`}
                            onClick={() => handleRowClick(n.id)}
                          >
                            <div className="flex items-center gap-1.5">
                              {severityIcon(n.severity)}
                              <span className="font-medium text-primary">
                                {name}
                              </span>
                              <span className="text-xs text-primary/60">
                                {severityLabel}
                              </span>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-primary/80">
                              {shortDesc || "—"}
                            </p>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleMarkAsRead(e, n.id)}
                          className="shrink-0 rounded p-1 text-primary/70 hover:bg-zinc-200 hover:text-primary dark:hover:bg-zinc-600"
                          title={t("notifications.table.markAsRead")}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div
            className={`border-t border-zinc-200 p-2 dark:border-zinc-700 ${
              isRtl ? "text-right" : "text-left"
            }`}
          >
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                router.push(`/${locale}/notifications`);
              }}
              className="text-sm text-primary-600 hover:underline dark:text-primary-400"
            >
              {t("notifications.table.viewAll")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
