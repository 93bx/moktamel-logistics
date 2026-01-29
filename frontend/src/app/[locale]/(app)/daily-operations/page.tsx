import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { backendApi, AuthError, ConfigurationError, ApiError } from "@/lib/backendApi";
import { DailyOperationsPageClient } from "@/components/DailyOperationsPageClient";
import { buildDateRange } from "@/lib/dailyOps";

type OperatingPlatform = "NONE" | "JAHEZ" | "HUNGERSTATION" | "NINJA" | "KEETA";

type DailyOperationListItem = {
  id: string;
  date: string;
  platform: OperatingPlatform;
  orders_count: number;
  total_revenue: string | number;
  cash_collected: string | number;
  cash_received?: string | number;
  difference_amount?: string | number;
  tips: string | number;
  deduction_amount: string | number;
  deduction_reason: string | null;
  loan_amount?: string | number;
  loan_reason?: string | null;
  is_draft?: boolean;
  approved_at?: string | null;
  approved_by_user_id?: string | null;
  status_code: string;
  employment_record: {
    id: string;
    employee_no: string | null;
    avatar_file_id?: string | null;
    recruitment_candidate: { full_name_ar: string; full_name_en: string | null } | null;
  } | null;
};

type StatsData = {
  totalOrders: number;
  activeEmployees: number;
  totalSales: number;
  totalDeductions: number;
};

export default async function DailyOperationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; date?: string; page?: string }>;
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
  const { from: dateFrom, to: dateTo } = buildDateRange(sp.date ?? null);

  let data: { items: DailyOperationListItem[]; total: number; page: number; page_size: number };
  let stats: StatsData;

  try {
    [data, stats] = await Promise.all([
      backendApi<{
        items: DailyOperationListItem[];
        total: number;
        page: number;
        page_size: number;
      }>({
        path: `/operations/daily/records?q=${encodeURIComponent(sp.q ?? "")}&date_from=${encodeURIComponent(
          dateFrom,
        )}&date_to=${encodeURIComponent(dateTo)}&page=${page}&page_size=25`,
      }),
      backendApi<StatsData>({
        path: `/operations/daily/stats${sp.date ? `?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}` : ""}`,
      }),
    ]);
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/${locale}/login`);
    }
    // If it's a configuration error, provide helpful message
    if (error instanceof ConfigurationError) {
      console.error("Configuration error in daily-operations page:", error.message, error.details);
      throw new Error(
        `Configuration Error: ${error.message}. ` +
        `Please check your Vercel environment variables.`
      );
    }
    // If it's an API error, it already has good context
    if (error instanceof ApiError) {
      console.error("API error in daily-operations page:", error.message, {
        status: error.status,
        path: error.path,
        payload: error.payload,
      });
      throw error;
    }
    // Log the error for debugging
    console.error("Daily operations page error:", error);
    // Re-throw with more context
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStatus = (error as any)?.status;
    throw new Error(`Failed to load daily operations: ${errorMessage}${errorStatus ? ` (Status: ${errorStatus})` : ""}`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-primary">{t("nav.dailyOperations")}</h1>
      <DailyOperationsPageClient locale={locale} data={data} stats={stats} searchParams={sp} page={page} />
    </div>
  );
}


