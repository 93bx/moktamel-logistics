import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/bfa58f2a-7ab1-463f-905a-0dfca7fc2a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard/page.tsx:10',message:'DashboardPage locale from params',data:{locale},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  const t = await getTranslations({ locale });
  
  // #region agent log
  const navDashboard = t("nav.dashboard");
  const dashboardWelcome = t("dashboard.welcome");
  fetch('http://127.0.0.1:7243/ingest/bfa58f2a-7ab1-463f-905a-0dfca7fc2a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'dashboard/page.tsx:12',message:'DashboardPage translations result',data:{locale,translatedNavDashboard:navDashboard,translatedWelcome:dashboardWelcome},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A,D'})}).catch(()=>{});
  // #endregion

  // Server-side auth check
  const cookieStore = await cookies();
  const access = cookieStore.get("moktamel_access")?.value;
  if (!access) {
    redirect(`/${locale}/login`);
  }

  return (
    <div className="space-y-2">
      <h1 className="text-xl font-semibold text-primary">{t("nav.dashboard")}</h1>
      <p className="text-sm text-primary/80">
        {t("dashboard.welcome")}
      </p>
    </div>
  );
}


