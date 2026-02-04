"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { UserMenu } from "./UserMenu";
import { NotificationBell } from "./NotificationBell";

export function Header() {
  const pathname = usePathname();
  const t = useTranslations();

  // Determine page title based on current route
  const getPageTitle = () => {
    if (pathname.includes("/dashboard")) return t("nav.dashboard");
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
        <NotificationBell />
        <UserMenu />
      </div>
    </header>
  );
}

