import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { backendApi, AuthError } from "@/lib/backendApi";
import { getTranslations } from "next-intl/server";

type Metric = {
  id: string;
  metric_code: string;
  date: string;
  value: string;
  dimensions: any;
};

export default async function AnalyticsPage({
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

  // Initially show empty / last 30 days once metric jobs exist.
  const now = new Date();
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const to = now.toISOString();

  let metrics: Metric[];
  try {
    metrics = await backendApi<Metric[]>({
      path: `/analytics/metrics/daily?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    });
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
      <h1 className="text-xl font-semibold text-primary">{t("nav.analytics")}</h1>
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-800">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-primary">
            <thead className="border-b border-zinc-200 text-left dark:border-zinc-700">
              <tr>
                <th className="px-3 py-2">{t("common.metric")}</th>
                <th className="px-3 py-2">{t("common.date")}</th>
                <th className="px-3 py-2">{t("common.value")}</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.id} className="border-b border-zinc-100 dark:border-zinc-700">
                  <td className="px-3 py-2 font-medium">{m.metric_code}</td>
                  <td className="px-3 py-2">{new Date(m.date).toISOString().slice(0, 10)}</td>
                  <td className="px-3 py-2">{m.value}</td>
                </tr>
              ))}
              {metrics.length === 0 ? (
                <tr>
                  <td className="px-3 py-6 text-center text-primary/60" colSpan={3}>
                    {t("common.noMetrics")}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


