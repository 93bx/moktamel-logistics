import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { backendApi, AuthError } from "@/lib/backendApi";
import { getTranslations } from "next-intl/server";

type Notification = {
  id: string;
  type_code: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  payload: any;
  read_at: string | null;
  created_at: string;
};

export default async function NotificationsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  // Server-side auth check
  const cookieStore = await cookies();
  const access = cookieStore.get("moktamel_access")?.value;
  if (!access) {
    redirect(`/${locale}/login`);
  }

  let items: Notification[];
  try {
    items = await backendApi<Notification[]>({ path: "/notifications" });
  } catch (error) {
    // If it's an auth error, redirect to login
    if (error instanceof AuthError) {
      redirect(`/${locale}/login`);
    }
    // Re-throw other errors
    throw error;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-primary">{t("nav.notifications")}</h1>
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <div className="divide-y divide-zinc-100 dark:divide-zinc-700">
          {items.map((n) => (
            <div key={n.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="font-medium text-primary">{n.type_code}</div>
                <div className="text-xs text-primary/60">{new Date(n.created_at).toISOString()}</div>
              </div>
              <div className="mt-1 text-sm text-primary/80">
                Severity: {n.severity} {n.read_at ? "(read)" : "(unread)"}
              </div>
              {n.payload ? (
                <pre className="mt-2 overflow-x-auto rounded-md bg-zinc-50 p-2 text-xs text-primary dark:bg-zinc-700">
                  {JSON.stringify(n.payload, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}
          {items.length === 0 ? (
            <div className="p-6 text-center text-sm text-primary/60">{t("common.noNotifications")}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}


