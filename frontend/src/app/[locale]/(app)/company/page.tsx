import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

export default async function CompanyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });

  // Server-side auth check
  const cookieStore = await cookies();
  const access = cookieStore.get("moktamel_access")?.value;
  if (!access) {
    redirect(`/${locale}/login`);
  }
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold text-primary">{t("nav.companies")}</h1>
      <p className="text-sm text-primary/80">
        Company settings UI will be implemented next (Phase 1/2).
      </p>
    </div>
  );
}


