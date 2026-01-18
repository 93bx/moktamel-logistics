import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { backendApi, AuthError, ConfigurationError, ApiError } from "@/lib/backendApi";
import { AssetsPageClient } from "@/components/AssetsPageClient";

type AssetListItem = {
  id: string;
  employee_no: string | null;
  recruitment_candidate: { full_name_ar: string; full_name_en: string | null; passport_no: string; nationality: string } | null;
  assets: Array<{
    id: string;
    status_code: string;
    receive_date: string;
    condition_code: string;
    asset: { id: string; type: string; name: string; price: string; vehicle_id: string | null };
    created_at: string;
  }>;
  contract_end_at: string | null;
};

type StatsData = {
  assetsValue: number;
  custodians: number;
  deductions: number;
  pendingRecovery: number;
};

export default async function AssetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale });

  const cookieStore = await cookies();
  const access = cookieStore.get("moktamel_access")?.value;
  if (!access) {
    redirect(`/${locale}/login`);
  }

  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  let data: { items: AssetListItem[]; total: number; page: number; page_size: number };
  let stats: StatsData;

  try {
    [data, stats] = await Promise.all([
      backendApi<{
        items: AssetListItem[];
        total: number;
        page: number;
        page_size: number;
      }>({
        path: `/hr/assets/assignments?q=${encodeURIComponent(sp.q ?? "")}&page=${page}&page_size=25`,
      }),
      backendApi<StatsData>({ path: `/hr/assets/stats` }),
    ]);
  } catch (e: any) {
    if (e instanceof AuthError) {
      redirect(`/${locale}/login`);
    }
    // If it's a configuration error, provide helpful message
    if (e instanceof ConfigurationError) {
      console.error("Configuration error in assets page:", e.message, e.details);
      throw new Error(
        `Configuration Error: ${e.message}. ` +
        `Please check your Vercel environment variables.`
      );
    }
    throw e;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-primary">{t("nav.assets")}</h1>
      <AssetsPageClient locale={locale} data={data} stats={stats} searchParams={sp} page={page} />
    </div>
  );
}


