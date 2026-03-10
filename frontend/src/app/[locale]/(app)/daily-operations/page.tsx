import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { backendApi, AuthError, ConfigurationError, ApiError } from "@/lib/backendApi";
import { parseMonthFromSearchParams } from "@/lib/dashboard";
import { monthToDateRange } from "@/lib/dailyOps";
import { DailyOperationsPageClient } from "@/components/DailyOperationsPageClient";

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
    platform_user_no?: string | null;
    recruitment_candidate: { full_name_ar: string; full_name_en: string | null } | null;
  } | null;
};

/** One row per employee with monthly aggregates (from GET records/by-employee). */
export type DailyOperationByEmployeeItem = {
  employment_record_id: string;
  employment_record: {
    id: string;
    employee_no: string | null;
    avatar_file_id?: string | null;
    platform_user_no?: string | null;
    recruitment_candidate: { full_name_ar: string; full_name_en: string | null } | null;
  } | null;
  orders_count: number;
  total_revenue: number;
  cash_collected: number;
  tips: number;
  deduction_amount: number;
  platform: OperatingPlatform | "MULTIPLE";
  status_code: string;
  records_count: number;
};

type StatsData = {
  totalOrders: number;
  activeEmployees: number;
  totalSales: number;
  totalDeductions: number;
};

export type MonthlyChartsData = {
  pie: { totalTarget: number; totalAchieved: number };
  byEmployee: Array<{
    employment_record_id: string;
    full_name_ar: string;
    full_name_en: string | null;
    orders_count: number;
    monthly_orders_target: number | null;
  }>;
};

export default async function DailyOperationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; month?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  const cookieStore = await cookies();
  const access = cookieStore.get("moktamel_access")?.value;
  if (!access) {
    redirect(`/${locale}/login`);
  }

  const month = parseMonthFromSearchParams(sp.month);
  const { from: dateFrom, to: dateTo } = monthToDateRange(month);
  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  type ByEmployeeResponse = {
    items: DailyOperationByEmployeeItem[];
    total: number;
    page: number;
    page_size: number;
  };
  let data: ByEmployeeResponse;
  let stats: StatsData;
  let chartsData: MonthlyChartsData | null = null;

  try {
    [data, stats, chartsData] = await Promise.all([
      backendApi<ByEmployeeResponse>({
        path: `/operations/daily/records/by-employee?date_from=${encodeURIComponent(
          dateFrom,
        )}&date_to=${encodeURIComponent(dateTo)}&q=${encodeURIComponent(sp.q ?? "")}&page=${page}&page_size=25`,
      }),
      backendApi<StatsData>({
        path: `/operations/daily/stats?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`,
      }),
      backendApi<MonthlyChartsData>({
        path: `/operations/daily/monthly-charts?month=${encodeURIComponent(month)}`,
      }).catch(() => null),
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
      <DailyOperationsPageClient
        locale={locale}
        data={data}
        stats={stats}
        chartsData={chartsData}
        searchParams={{ q: sp.q, month }}
        page={page}
        dateFrom={dateFrom}
        dateTo={dateTo}
      />
    </div>
  );
}


