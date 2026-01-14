"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Languages } from "lucide-react";

export function LanguageSwitcher() {
  const locale = useLocale();
  const t = useTranslations();
  const pathname = usePathname();
  const other = locale === "ar" ? "en" : "ar";

  // Replace the locale in the current pathname
  // Handle both /en/... and /ar/... patterns, and also handle root paths
  let newPathname: string;
  if (pathname.startsWith(`/${locale}/`)) {
    newPathname = pathname.replace(`/${locale}/`, `/${other}/`);
  } else if (pathname === `/${locale}`) {
    newPathname = `/${other}`;
  } else if (pathname.startsWith("/")) {
    // If pathname doesn't have locale prefix, add it
    newPathname = `/${other}${pathname}`;
  } else {
    newPathname = `/${other}/${pathname}`;
  }

  return (
    <Link
      className="flex items-center gap-1 rounded-md p-2 text-primary-50 hover:bg-primary-600 hover:text-white dark:text-primary-100 dark:hover:bg-primary-800"
      href={newPathname}
      prefetch={false}
      title={t("common.language")}
    >
      <Languages className="h-5 w-5" />
      <span className="text-sm font-medium uppercase">{other}</span>
    </Link>
  );
}


