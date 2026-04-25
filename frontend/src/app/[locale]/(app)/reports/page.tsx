import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  backendApi,
  ApiError,
  AuthError,
  ConfigurationError,
} from "@/lib/backendApi";
import { parseMonthFromSearchParams } from "@/lib/dashboard";
import { ReportsPageClient } from "@/components/ReportsPageClient";
import type { ReportCatalogItem } from "@/lib/types/reports";

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  const cookieStore = await cookies();
  const access = cookieStore.get("moktamel_access")?.value;
  if (!access) redirect(`/${locale}/login`);

  const month = parseMonthFromSearchParams(sp.month);
  let catalog: ReportCatalogItem[] = [];
  try {
    catalog = await backendApi<ReportCatalogItem[]>({ path: "/reports/catalog" });
  } catch (error) {
    if (error instanceof AuthError) redirect(`/${locale}/login`);
    if (error instanceof ApiError && error.status === 403) {
      redirect(`/${locale}/dashboard`);
    }
    if (error instanceof ConfigurationError) {
      throw new Error(`Configuration Error: ${error.message}`);
    }
    throw error;
  }

  return <ReportsPageClient locale={locale} month={month} catalog={catalog} />;
}
