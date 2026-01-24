import { getTranslations } from "next-intl/server";
import { SalariesPayrollPageClient } from "@/components/SalariesPayrollPageClient";

export default async function SalariesPayrollPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-primary">{t("salariesPayroll.title")}</h1>
      <SalariesPayrollPageClient locale={locale} initialMonth={currentMonth} />
    </div>
  );
}


