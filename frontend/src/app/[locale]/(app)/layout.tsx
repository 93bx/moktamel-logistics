import { redirect } from "next/navigation";
import Image from "next/image";
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/Header";
import { SideNav } from "@/components/SideNav";
import { isTokenOlderThanHours } from "@/lib/jwt";

export default async function AppLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  
  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/bfa58f2a-7ab1-463f-905a-0dfca7fc2a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'(app)/layout.tsx:15',message:'AppLayout locale from params',data:{locale},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  
  const t = await getTranslations({ locale });
  
  // #region agent log
  const navDashboard = t("nav.dashboard");
  const appTitle = t("app.title");
  fetch('http://127.0.0.1:7243/ingest/bfa58f2a-7ab1-463f-905a-0dfca7fc2a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'(app)/layout.tsx:17',message:'AppLayout translations result',data:{locale,translatedNavDashboard:navDashboard,translatedAppTitle:appTitle},timestamp:Date.now(),sessionId:'debug-session',runId:'post-fix',hypothesisId:'A,D'})}).catch(()=>{});
  // #endregion

  // Server-side auth check - redirect if not authenticated
  const cookieStore = await cookies();
  const access = cookieStore.get("moktamel_access")?.value;
  if (!access) {
    redirect(`/${locale}/login`);
  }

  // Check 8-hour rule: if token is >8 hours old, redirect to login
  if (isTokenOlderThanHours(access, 8)) {
    redirect(`/${locale}/login`);
  }

  const companyName = cookieStore.get("moktamel_company_name")?.value;

  return (
    <div className="min-h-screen bg-white text-primary dark:bg-black dark:text-primary">
      <div className="flex">
        <aside className="hidden min-h-screen w-64 flex-col border-r border-primary-700 bg-primary p-4 dark:border-primary-800 dark:bg-primary-900 md:flex">
          <div className="flex flex-1 flex-col min-h-0">
            <div className="text-lg font-semibold text-white truncate" title={companyName ?? t("app.title")}>
              {companyName ?? t("app.title")}
            </div>
            <SideNav />
          </div>
          <div className="mt-auto pt-4 flex justify-center">
            <Image
              src="/logo.png"
              alt="Moktamel Logistics"
              width={200}
              height={64}
              className="max-w-full h-auto object-contain"
            />
          </div>
        </aside>

        <div className="flex min-h-screen flex-1 flex-col">
          <Header />
          <main className="p-4 bg-zinc-50 dark:bg-zinc-900">{children}</main>
        </div>
      </div>
    </div>
  );
}


