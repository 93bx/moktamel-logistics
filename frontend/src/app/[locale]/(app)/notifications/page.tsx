import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  backendApi,
  AuthError,
  ConfigurationError,
  ApiError,
} from "@/lib/backendApi";
import { getTranslations } from "next-intl/server";
import { NotificationsPageClient } from "@/components/NotificationsPageClient";

export type NotificationItem = {
  id: string;
  type_code: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  payload: Record<string, unknown> | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
};

type ListResponse = {
  items: NotificationItem[];
  total: number;
  page: number;
  page_size: number;
};

export default async function NotificationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string; expand?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale });

  const cookieStore = await cookies();
  const access = cookieStore.get("moktamel_access")?.value;
  if (!access) {
    redirect(`/${locale}/login`);
  }

  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const pageSize = 25;
  const expandId = sp.expand ?? null;

  let list: ListResponse;
  try {
    list = await backendApi<ListResponse>({
      path: `/notifications?page=${page}&page_size=${pageSize}`,
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/${locale}/login`);
    }
    if (error instanceof ConfigurationError) {
      console.error(
        "Configuration error in notifications page:",
        error.message,
        error.details
      );
      throw new Error(
        `Configuration Error: ${error.message}. Please check your Vercel environment variables.`
      );
    }
    throw error;
  }

  if (expandId && list.items.length > 0) {
    const isOnPage = list.items.some((n) => n.id === expandId);
    if (!isOnPage) {
      try {
        const { page: targetPage } = await backendApi<{ page: number }>({
          path: `/notifications/page-for-id?id=${encodeURIComponent(expandId)}`,
        });
        redirect(
          `/${locale}/notifications?page=${targetPage}&expand=${encodeURIComponent(expandId)}`
        );
      } catch {
        // If page-for-id fails, stay on current page
      }
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-primary">
        {t("nav.notifications")}
      </h1>
      <NotificationsPageClient
        locale={locale}
        items={list.items}
        total={list.total}
        page={list.page}
        pageSize={list.page_size}
        expandId={expandId}
      />
    </div>
  );
}
