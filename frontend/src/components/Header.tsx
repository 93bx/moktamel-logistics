"use client";

import { usePathname, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { UserMenu } from "./UserMenu";

export function Header() {
  const router = useRouter();
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations();

  // Determine page title based on current route
  const getPageTitle = () => {
    if (pathname.includes("/dashboard")) return t("nav.dashboard");
    if (pathname.includes("/company")) return t("nav.companies");
    if (pathname.includes("/recruitment")) return t("nav.recruitment");
    if (pathname.includes("/employment")) return t("nav.employment");
    if (pathname.includes("/notifications")) return t("nav.notifications");
    if (pathname.includes("/analytics")) return t("nav.analytics");
    if (pathname.includes("/profile")) return t("common.profile");
    return t("app.title");
  };

  return (
    <header className="flex items-center justify-between border-b border-primary-700 bg-primary px-4 py-3 dark:border-primary-800 dark:bg-primary-900">
      <h1 className="text-lg font-semibold text-primary-50 dark:text-primary-100">
        {getPageTitle()}
      </h1>
      <div className="flex items-center gap-2">
        <ThemeSwitcher />
        <LanguageSwitcher />
        <button
          onClick={() => router.push(`/${locale}/notifications`)}
          className="rounded-md p-2 text-primary-50 hover:bg-primary-600 hover:text-white dark:text-primary-100 dark:hover:bg-primary-800"
          aria-label={t("common.notifications")}
          title={t("common.notifications")}
        >
          <Bell className="h-5 w-5" />
        </button>
        <UserMenu />
      </div>
    </header>
  );
}

