import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { backendApi, AuthError, ConfigurationError, ApiError } from "@/lib/backendApi";
import { FleetPageClient } from "@/components/FleetPageClient";

export type VehicleListItem = {
  id: string;
  type_code: string;
  license_plate: string;
  model: string;
  year: number;
  current_odometer: number;
  status_code: string;
  current_driver_id: string | null;
  current_driver: {
    id: string;
    full_name_ar: string;
    full_name_en: string | null;
    employee_code: string | null;
  } | null;
  documents: Array<{
    type_code: string;
    expiry_date: string;
  }>;
  created_at: string;
};

export type FleetStatsData = {
  totalFleet: number;
  onDuty: number;
  idle: number;
  inWorkshop: number;
  nearExpiry: number;
};

export default async function FleetPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; page?: string; status?: string }>;
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

  let data: { items: VehicleListItem[]; total: number; page: number; page_size: number };
  let stats: FleetStatsData;

  try {
    [data, stats] = await Promise.all([
      backendApi<{
        items: VehicleListItem[];
        total: number;
        page: number;
        page_size: number;
      }>({
        path: `/fleet/vehicles?q=${encodeURIComponent(sp.q ?? "")}&status_code=${sp.status ?? ""}&page=${page}&page_size=25`,
      }),
      backendApi<FleetStatsData>({ path: `/fleet/stats` }),
    ]);
  } catch (e: any) {
    if (e instanceof AuthError) {
      redirect(`/${locale}/login`);
    }
    // If it's a configuration error, provide helpful message
    if (e instanceof ConfigurationError) {
      console.error("Configuration error in fleet page:", e.message, e.details);
      throw new Error(
        `Configuration Error: ${e.message}. ` +
        `Please check your Vercel environment variables.`
      );
    }
    throw e;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-primary">{t("fleet.title")}</h1>
      <FleetPageClient locale={locale} data={data} stats={stats} searchParams={sp} page={page} />
    </div>
  );
}

