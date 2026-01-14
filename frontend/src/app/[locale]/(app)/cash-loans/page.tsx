import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { backendApi, AuthError } from "@/lib/backendApi";
import { CashLoansPageClient } from "@/components/CashLoansPageClient";
import { currentMonthRange } from "@/lib/cashLoans";

type EmployeeRow = {
  id: string;
  employee_no: string | null;
  full_name_ar: string;
  full_name_en: string;
  total_revenue: number;
  total_cash_collected: number;
  total_cash_not_collected: number;
  total_loans: number;
  total_deductions: number;
  status: "BALANCED" | "UNBALANCED";
};

type StatsResponse = {
  myWallet: number;
  cashNotCollected: number;
  totalLoans: number;
  cashCollected: number;
};

export default async function CashLoansPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string; status?: string; date_from?: string; date_to?: string; page?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const t = await getTranslations({ locale });

  const cookieStore = await cookies();
  const access = cookieStore.get("moktamel_access")?.value;
  if (!access) redirect(`/${locale}/login`);

  const page = Math.max(1, Number(sp.page ?? "1") || 1);
  const { from: fromIso, to: toIso, startDate: fromDefault, endDate: toDefault } = currentMonthRange();

  const dateFrom = sp.date_from || fromIso;
  const dateTo = sp.date_to || toIso;

  let list: { items: EmployeeRow[]; total: number; page: number; page_size: number };
  let stats: StatsResponse;

  try {
    [list, stats] = await Promise.all([
      backendApi({
        path: `/finance/cash-loans/employees?q=${encodeURIComponent(sp.q ?? "")}&status=${encodeURIComponent(sp.status ?? "")}&date_from=${encodeURIComponent(
          dateFrom,
        )}&date_to=${encodeURIComponent(dateTo)}&page=${page}&page_size=25`,
      }),
      backendApi({ path: `/finance/cash-loans/stats?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}` }),
    ]);
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/${locale}/login`);
    }
    throw error;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-primary">{t("cashLoans.title")}</h1>
      <CashLoansPageClient locale={locale} list={list} stats={stats} searchParams={sp} page={page} defaultDateFrom={dateFrom} defaultDateTo={dateTo} />
    </div>
  );
}

