import { SalariesPayrollPageClient } from "@/components/SalariesPayrollPageClient";
import { parseMonthFromSearchParams } from "@/lib/dashboard";
import type { PayrollSortKey } from "@/lib/types/salaries-payroll";

const SORT_VALUES: PayrollSortKey[] = [
  "default",
  "revenue",
  "salary_due",
  "deductions",
  "loans",
];

function parseSort(param: string | undefined): PayrollSortKey | undefined {
  if (!param) return undefined;
  return SORT_VALUES.includes(param as PayrollSortKey)
    ? (param as PayrollSortKey)
    : undefined;
}

export default async function SalariesPayrollPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string; sort?: string }>;
}) {
  const { locale } = await params;
  const sp = await searchParams;
  const month = parseMonthFromSearchParams(sp.month);
  const sort = parseSort(sp.sort);

  return (
    <div className="space-y-2">
      <SalariesPayrollPageClient locale={locale} month={month} sort={sort} />
    </div>
  );
}
