import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { backendApi, AuthError, ConfigurationError, ApiError } from "@/lib/backendApi";
import { EmploymentNewButton } from "@/components/EmploymentNewButton";
import { EmploymentPageClient } from "@/components/EmploymentPageClient";

type EmploymentListItem = {
  id: string;
  recruitment_candidate_id: string | null;
  employee_no: string | null;
  employee_code: string | null;
  full_name_ar: string | null;
  full_name_en: string | null;
  iqama_no: string | null;
  custody_status: string | null;
  start_date_at: string | null;
  contract_end_at: string | null;
  iqama_expiry_at: string | null;
  passport_expiry_at: string | null;
  medical_expiry_at: string | null;
  license_expiry_at: string | null;
  status_code: string;
  salary_amount: string | null;
  salary_currency_code: string | null;
  cost_center_code: string | null;
  assigned_platform: string | null;
  avatar_file_id: string | null;
  assets?: Array<{ id: string; asset: { type: string; name: string } }>;
  created_at: string;
  updated_at: string;
  recruitment_candidate: {
    full_name_ar: string;
    full_name_en: string | null;
  } | null;
};

type StatsData = {
  totalEmployees: number;
  employeesOnDuty: number;
  employeesOnboarding: number;
  documentsExpiringSoon: number;
  employeesLostOrEscaped: number;
};

export default async function EmploymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ 
    q?: string; 
    status_code?: string; 
    platform?: string;
    has_assets?: string;
    page?: string 
  }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale });

  // Server-side auth check
  const cookieStore = await cookies();
  const access = cookieStore.get("moktamel_access")?.value;
  if (!access) {
    redirect(`/${locale}/login`);
  }

  const page = Math.max(1, Number(sp.page ?? "1") || 1);

  let data: {
    items: EmploymentListItem[];
    total: number;
    page: number;
    page_size: number;
  };
  let stats: StatsData;

  try {
    const queryParams = new URLSearchParams();
    if (sp.q) queryParams.set("q", sp.q);
    if (sp.status_code) queryParams.set("status_code", sp.status_code);
    if (sp.platform) queryParams.set("platform", sp.platform);
    if (sp.has_assets) queryParams.set("has_assets", sp.has_assets);
    queryParams.set("page", page.toString());
    queryParams.set("page_size", "25");

    [data, stats] = await Promise.all([
      backendApi<{
        items: EmploymentListItem[];
        total: number;
        page: number;
        page_size: number;
      }>({
        path: `/hr/employment/records?${queryParams.toString()}`,
      }),
      backendApi<StatsData>({
        path: `/hr/employment/stats`,
      }),
    ]);
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/${locale}/login`);
    }
    // If it's a configuration error, provide helpful message
    if (error instanceof ConfigurationError) {
      console.error("Configuration error in employment page:", error.message, error.details);
      throw new Error(
        `Configuration Error: ${error.message}. ` +
        `Please check your Vercel environment variables.`
      );
    }
    throw error;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-primary">{t("nav.employment")}</h1>
        <EmploymentNewButton locale={locale} />
      </div>

      {/* Part 1: Quick Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label={t("common.totalEmployees")} value={stats.totalEmployees} />
        <StatCard label={t("common.employeesOnDuty")} value={stats.employeesOnDuty} />
        <StatCard label={t("common.employeesOnboarding")} value={stats.employeesOnboarding} />
        <StatCard label={t("common.documentsExpiringSoon")} value={stats.documentsExpiringSoon} />
        <StatCard label={t("common.employeesLostOrEscaped")} value={stats.employeesLostOrEscaped} />
      </div>

      {/* Part 2: Controls Row */}
      <form className="flex flex-wrap items-center gap-2" action={`/${locale}/employment`} method="get">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder={t("common.searchEmployeeCostCenter")}
          className="w-full max-w-xs rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800"
        />
        <select
          name="status_code"
          defaultValue={sp.status_code ?? ""}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="">{t("common.allStatuses")}</option>
          <option value="EMPLOYMENT_STATUS_ACTIVE">{t("common.statusActive")}</option>
          <option value="EMPLOYMENT_STATUS_UNDER_PROCEDURE">{t("common.statusInProgress")}</option>
          <option value="INCOMPLETE_FILE">{t("common.statusIncompleteFile")}</option>
          <option value="NOT_ASSIGNED">{t("common.statusNotAssigned")}</option>
          <option value="IN_TRAINING">{t("common.statusInTraining")}</option>
          <option value="COMPLETE_FILE">{t("common.statusCompleteFile")}</option>
          <option value="ASSIGNED">{t("common.statusAssigned")}</option>
        </select>
        <select
          name="platform"
          defaultValue={sp.platform ?? ""}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-primary dark:border-zinc-700 dark:bg-zinc-800"
        >
          <option value="">{t("dailyOps.tablePlatform")}</option>
          <option value="JAHEZ">{t("common.platformJahez")}</option>
          <option value="HUNGERSTATION">{t("common.platformHungerstation")}</option>
          <option value="NINJA">{t("common.platformNinja")}</option>
          <option value="KEETA">{t("common.platformKeeta")}</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-primary">
          <input
            type="checkbox"
            name="has_assets"
            value="true"
            defaultChecked={sp.has_assets === "true"}
            className="h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary"
          />
          {t("common.hasAssets")}
        </label>
        <button className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-600">
          {t("common.filter")}
        </button>
      </form>

      {/* Part 3: Employees Table Client */}
      <EmploymentPageClient
        locale={locale}
        initialItems={data.items}
        total={data.total}
        page={data.page}
        pageSize={data.page_size}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="text-sm text-primary/60">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-primary">{value}</div>
    </div>
  );
}
