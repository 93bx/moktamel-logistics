import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { backendApi, AuthError, ConfigurationError, ApiError } from "@/lib/backendApi";
import { PayrollConfigPageClient } from "@/components/PayrollConfigPageClient";

type PayrollConfigData = {
  calculation_method: 'ORDERS_COUNT' | 'REVENUE' | 'FIXED_DEDUCTION';
  monthly_target?: number | null;
  monthly_target_amount?: number | null;
  bonus_per_order?: number | null;
  minimum_salary?: number | null;
  unit_amount?: number | null;
  deduction_per_order?: number | null;
  deduction_tiers?: Array<{ from: number; to: number; deduction: number }> | null;
};

type PayrollStatsData = {
  activeEmployees: number;
  totalCosts: number;
  averageCost: number;
};

export default async function PayrollConfigPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale });

  const cookieStore = await cookies();
  const access = cookieStore.get("moktamel_access")?.value;
  if (!access) {
    redirect(`/${locale}/login`);
  }

  // Default to current month if not provided
  const now = new Date();
  const year = sp.year ? parseInt(sp.year, 10) : now.getFullYear();
  const month = sp.month ? parseInt(sp.month, 10) : now.getMonth() + 1;

  let config: PayrollConfigData;
  let stats: PayrollStatsData;

  try {
    [config, stats] = await Promise.all([
      backendApi<PayrollConfigData>({
        path: `/payroll-config/config?year=${year}&month=${month}`,
      }),
      backendApi<PayrollStatsData>({
        path: `/payroll-config/stats?year=${year}&month=${month}`,
      }),
    ]);
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/${locale}/login`);
    }
    if (error instanceof ConfigurationError) {
      console.error("Configuration error in payroll-config page:", error.message, error.details);
      throw new Error(
        `Configuration Error: ${error.message}. ` +
        `Please check your Vercel environment variables.`
      );
    }
    if (error instanceof ApiError) {
      console.error("API error in payroll-config page:", error.message, {
        status: error.status,
        path: error.path,
        payload: error.payload,
      });
      throw error;
    }
    console.error("Payroll config page error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStatus = (error as any)?.status;
    throw new Error(`Failed to load payroll config: ${errorMessage}${errorStatus ? ` (Status: ${errorStatus})` : ""}`);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-primary">{t("payrollConfig.pageTitle")}</h1>
      <PayrollConfigPageClient 
        locale={locale} 
        initialConfig={config} 
        initialStats={stats}
        initialYear={year}
        initialMonth={month}
      />
    </div>
  );
}


