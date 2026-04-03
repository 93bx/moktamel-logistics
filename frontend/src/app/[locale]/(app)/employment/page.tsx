import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { backendApi, AuthError, ConfigurationError } from "@/lib/backendApi";
import type { EmploymentListItem } from "@/lib/types/employment";
import { EmploymentExcelMenu } from "@/components/EmploymentExcelMenu";
import { EmploymentNewButton } from "@/components/EmploymentNewButton";
import { EmploymentPageClient } from "@/components/EmploymentPageClient";
import {
  EmploymentStatCards,
  type EmploymentStatCardItem,
} from "@/components/EmploymentStatCards";

type StatsData = {
  totalEmployees: number;
  employeesOnDuty: number;
  employeesOnboarding: number;
  employeesDeserted: number;
  employeesDeactivated: number;
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

  function buildEmploymentUrl(opts: { status_code?: string | null; page?: number }) {
    const params = new URLSearchParams();
    if (sp.q) params.set("q", sp.q);
    if (sp.platform) params.set("platform", sp.platform);
    if (sp.has_assets) params.set("has_assets", sp.has_assets);
    if (opts.status_code != null && opts.status_code) params.set("status_code", opts.status_code);
    if (opts.page != null && opts.page > 1) params.set("page", String(opts.page));
    const qs = params.toString();
    return `/${locale}/employment${qs ? `?${qs}` : ""}`;
  }

  const statCardDefs = [
    {
      key: "total",
      statusCode: null as string | null,
      kind: "total" as const,
      label: t("common.totalEmployees"),
      value: stats.totalEmployees,
      tip: t("common.employmentStatTipTotalEmployees"),
    },
    {
      key: "active",
      statusCode: "EMPLOYMENT_STATUS_ACTIVE" as const,
      kind: "active" as const,
      label: t("common.employeesOnDuty"),
      value: stats.employeesOnDuty,
      tip: t("common.employmentStatTipOnDuty"),
    },
    {
      key: "onboarding",
      statusCode: "EMPLOYMENT_STATUS_UNDER_PROCEDURE" as const,
      kind: "onboarding" as const,
      label: t("common.employeesOnboarding"),
      value: stats.employeesOnboarding,
      tip: t("common.employmentStatTipOnboarding"),
    },
    {
      key: "deserted",
      statusCode: "EMPLOYMENT_STATUS_DESERTED" as const,
      kind: "deserted" as const,
      label: t("common.employeesDeserted"),
      value: stats.employeesDeserted,
      tip: t("common.employmentStatTipDeserted"),
    },
    {
      key: "deactivated",
      statusCode: "EMPLOYMENT_STATUS_DEACTIVATED" as const,
      kind: "deactivated" as const,
      label: t("common.employeesDeactivated"),
      value: stats.employeesDeactivated,
      tip: t("common.employmentStatTipDeactivated"),
    },
  ];

  const statCards: EmploymentStatCardItem[] = statCardDefs.map((def) => {
    const isActive =
      def.statusCode === null ? !sp.status_code : sp.status_code === def.statusCode;
    const href = isActive
      ? buildEmploymentUrl({ status_code: null, page: 1 })
      : buildEmploymentUrl({ status_code: def.statusCode ?? undefined, page: 1 });
    return {
      key: def.key,
      href,
      isActive,
      label: def.label,
      value: def.value,
      tip: def.tip,
      kind: def.kind,
    };
  });

  return (
    <div className="space-y-4">
      {/* Part 1: Quick Stats Cards (click to filter; click again to clear) */}
      <EmploymentStatCards locale={locale} cards={statCards} />

      {/* Part 2: Controls Row */}
      <div className="flex items-center justify-between gap-2">
        <form className="flex items-center gap-2 bg-[#244473] p-2 rounded-md w-full max-w-2xl" action={`/${locale}/employment`} method="get">
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
            <option value="EMPLOYMENT_STATUS_DRAFT">{t("common.statusDraft")}</option>
            <option value="EMPLOYMENT_STATUS_UNDER_PROCEDURE">{t("common.statusInProgress")}</option>
            <option value="EMPLOYMENT_STATUS_ACTIVE">{t("common.statusActive")}</option>
            <option value="EMPLOYMENT_STATUS_DEACTIVATED">{t("common.deactivated")}</option>
            <option value="EMPLOYMENT_STATUS_DESERTED">{t("common.deserted")}</option>
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
          <button className="rounded-md bg-white px-4 py-2 text-sm font-bold text-primary hover:bg-white/80">
            {t("common.filter")}
          </button>
        </form>
        <div className="flex shrink-0 items-center gap-2">
          <EmploymentExcelMenu />
          <EmploymentNewButton locale={locale} />
        </div>
      </div>

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
