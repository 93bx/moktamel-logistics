import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { backendApi, AuthError, ConfigurationError, ApiError } from "@/lib/backendApi";
import { parseMonthFromSearchParams } from "@/lib/dashboard";
import { DashboardPageClient } from "@/components/DashboardPageClient";

export type DashboardOverviewPayload = {
  meta: {
    selected_month: string;
    currency: string;
    timezone: string;
    generated_at: string;
  };
  kpis: {
    active_employees: KpiCard;
    total_orders: KpiCard;
    total_revenue: KpiCard;
    total_cash_collected: KpiCard;
    total_deductions: KpiCard;
    gas_per_order: KpiCard;
  };
  operations: {
    top10_by_orders: EmployeeRankRow[];
    worst10_by_orders: EmployeeRankRow[];
    top10_by_revenue: EmployeeRankRow[];
    worst10_by_revenue: EmployeeRankRow[];
    daily_performance: DailyPerformancePoint[];
  };
  platforms: PlatformRow[];
  cashFlow: {
    top10_uncollected: UncollectedRow[];
    daily_collected: DailyCollectedPoint[];
  };
  notifications: NotificationRow[];
  links: Record<string, string>;
};

type KpiCard = {
  current: number;
  previous: number;
  delta: number;
  pct_delta: number | null;
  trend: "up" | "down" | "neutral";
};

type EmployeeRankRow = {
  employment_record_id: string;
  full_name_ar: string;
  full_name_en: string | null;
  orders: number;
  revenue: number;
};

type DailyPerformancePoint = { date: string; orders: number; revenue: number };

type PlatformRow = {
  platform: string;
  orders: number;
  revenue: number;
  avg_order_value: number;
};

type UncollectedRow = {
  employment_record_id: string;
  full_name_ar: string;
  full_name_en: string | null;
  amount: number;
};

type DailyCollectedPoint = { date: string; amount: number };

type NotificationRow = {
  id: string;
  doc_name: string;
  association: string;
  entity_display_name: string;
  expiry_date: string;
  days_remaining: number;
  status_bucket: "expired" | "critical_5" | "warning_30";
  entity_type: string;
  entity_id: string;
  document_id: string;
  file_id: string | null;
};

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale });

  const cookieStore = await cookies();
  const access = cookieStore.get("moktamel_access")?.value;
  if (!access) {
    redirect(`/${locale}/login`);
  }

  const month = parseMonthFromSearchParams(sp.month);
  const path = `/dashboard/overview${month ? `?month=${encodeURIComponent(month)}` : ""}`;

  let payload: DashboardOverviewPayload;
  try {
    payload = await backendApi<DashboardOverviewPayload>({ path });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/${locale}/login`);
    }
    if (error instanceof ConfigurationError) {
      console.error("Configuration error in dashboard page:", error.message, error.details);
      throw new Error(
        `Configuration Error: ${error.message}. Please check your environment variables.`
      );
    }
    if (error instanceof ApiError) {
      console.error("API error in dashboard page:", error.message, {
        status: error.status,
        path: error.path,
        payload: error.payload,
      });
      throw error;
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to load dashboard: ${message}`);
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
      <div className="p-0 m-0">
        <DashboardPageClient locale={locale} payload={payload} />
      </div>
    </div>
  );
}
