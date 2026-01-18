import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { backendApi, AuthError, ConfigurationError, ApiError } from "@/lib/backendApi";
import { RecruitmentPageClient } from "@/components/RecruitmentPageClient";

type CandidateListItem = {
  id: string;
  full_name_ar: string;
  full_name_en: string | null;
  nationality: string;
  passport_no: string;
  job_title_code: string | null;
  status_code: string;
  responsible_office: string;
  avatar_file_id: string | null;
  visa_deadline_at: string | null;
  visa_sent_at: string | null;
  expected_arrival_at: string | null;
  created_at: string;
  updated_at: string;
};

type StatsData = {
  underProcedureCount: number;
  olderThan45DaysCount: number;
  arrivingWithin7DaysCount: number;
};

export default async function RecruitmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status_code?: string; page?: string }>;
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
    items: CandidateListItem[];
    total: number;
    page: number;
    page_size: number;
  };
  let stats: StatsData;

  try {
    [data, stats] = await Promise.all([
      backendApi<{
        items: CandidateListItem[];
        total: number;
        page: number;
        page_size: number;
      }>({
        path: `/hr/recruitment/candidates?q=${encodeURIComponent(sp.q ?? "")}&status_code=${encodeURIComponent(
          sp.status_code ?? "",
        )}&page=${page}&page_size=25`,
      }),
      backendApi<StatsData>({
        path: `/hr/recruitment/stats`,
      }),
    ]);
  } catch (error) {
    // If it's an auth error, redirect to login
    if (error instanceof AuthError) {
      redirect(`/${locale}/login`);
    }
    // If it's a configuration error, provide helpful message
    if (error instanceof ConfigurationError) {
      console.error("Configuration error in recruitment page:", error.message, error.details);
      throw new Error(
        `Configuration Error: ${error.message}. ` +
        `Please check your Vercel environment variables.`
      );
    }
    // Re-throw other errors (including ApiError which has better context)
    throw error;
  }

  return (
    <RecruitmentPageClient
      locale={locale}
      data={data}
      stats={stats}
      searchParams={sp}
      page={page}
    />
  );
}

