"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Bell,
  Briefcase,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  FileBarChart,
  LayoutDashboard,
  Package,
  Receipt,
  Settings2,
  Truck,
  UserPlus,
  UsersRound,
  Wallet,
} from "lucide-react";
import { locales } from "@/i18n/routing";

/** Strip locale prefix so path works with localePrefix "as-needed" (e.g. /ar/dashboard -> /dashboard). */
function pathWithoutLocale(path: string): string {
  const segments = path.split("/").filter(Boolean);
  const first = segments[0] ?? "";
  if ((locales as readonly string[]).includes(first)) {
    return "/" + segments.slice(1).join("/") || "/";
  }
  return path || "/";
}

type NavItem = { href: string; label: string; Icon: LucideIcon };

type SideNavProps = {
  /** When false (mobile rail), only icons show until the user expands labels. */
  showLabels?: boolean;
};

export function SideNav({ showLabels = true }: SideNavProps) {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations();

  const currentPath = pathWithoutLocale(pathname);
  const isActive = (href: string) => {
    const hrefPath = pathWithoutLocale(href);
    return currentPath === hrefPath || currentPath.startsWith(hrefPath + "/");
  };

  const financeItems: NavItem[] = [
    { href: `/${locale}/cash-loans`, label: t("nav.cashLoans"), Icon: Banknote },
    { href: `/${locale}/payroll-config`, label: t("nav.payrollConfig"), Icon: Settings2 },
    { href: `/${locale}/salaries-payroll`, label: t("nav.salariesPayroll"), Icon: Receipt },
  ];

  const isFinanceGroupActive = financeItems.some((item) => isActive(item.href));

  const hrItems: NavItem[] = [
    { href: `/${locale}/recruitment`, label: t("nav.recruitment"), Icon: UserPlus },
    { href: `/${locale}/employment`, label: t("nav.employment"), Icon: Briefcase },
    { href: `/${locale}/documents`, label: t("nav.documents"), Icon: FileText },
    { href: `/${locale}/assets`, label: t("nav.assets"), Icon: Package },
    { href: `/${locale}/fleet`, label: t("nav.fleetManagement"), Icon: Truck },
  ];

  const isHRGroupActive = hrItems.some((item) => isActive(item.href));

  const [isFinanceOpen, setIsFinanceOpen] = useState(isFinanceGroupActive);
  const [isHROpen, setIsHROpen] = useState(isHRGroupActive);

  useEffect(() => {
    setIsFinanceOpen(isFinanceGroupActive);
  }, [isFinanceGroupActive]);

  useEffect(() => {
    setIsHROpen(isHRGroupActive);
  }, [isHRGroupActive]);

  const linkRow = showLabels
    ? "gap-3 px-3"
    : "justify-center px-2 md:justify-start md:gap-3 md:px-3";
  const groupRow = showLabels
    ? "justify-between gap-3 px-3"
    : "justify-center px-2 md:justify-between md:gap-3 md:px-3";
  const labelCls = showLabels ? "" : "sr-only md:not-sr-only";
  const chevronCls = showLabels ? "h-4 w-4 shrink-0" : "sr-only md:not-sr-only md:h-4 md:w-4 md:shrink-0";
  const groupMainCls = showLabels ? "flex min-w-0 flex-1 items-center gap-3" : "flex items-center gap-3 md:min-w-0 md:flex-1";

  const activeRow = (active: boolean) =>
    active
      ? "bg-white text-[#244473] dark:bg-black dark:text-[#244473]"
      : "text-primary-50 hover:bg-primary-600 dark:text-primary-100 dark:hover:bg-primary-800";

  const nestedWrap = showLabels ? "ml-4 mt-1 space-y-1" : "mt-1 space-y-1 max-md:ml-0 md:ml-4";

  return (
    <nav className="mt-5 space-y-1">
      <Link
        href={`/${locale}/dashboard`}
        className={`flex items-center rounded-md py-2 text-base transition-colors ${linkRow} ${activeRow(isActive(`/${locale}/dashboard`))}`}
      >
        <LayoutDashboard className="h-5 w-5 shrink-0" aria-hidden />
        <span className={`min-w-0 truncate ${labelCls}`}>{t("nav.dashboard")}</span>
      </Link>

      <div className="border-t border-primary-600 dark:border-primary-700" />

      <Link
        href={`/${locale}/daily-operations`}
        className={`flex items-center rounded-md py-2 text-base transition-colors ${linkRow} ${activeRow(isActive(`/${locale}/daily-operations`))}`}
      >
        <ClipboardList className="h-5 w-5 shrink-0" aria-hidden />
        <span className={`min-w-0 truncate ${labelCls}`}>{t("nav.dailyOperations")}</span>
      </Link>
      <Link
        href={`/${locale}/reports`}
        className={`flex items-center rounded-md py-2 text-base transition-colors ${linkRow} ${activeRow(isActive(`/${locale}/reports`))}`}
      >
        <FileBarChart className="h-5 w-5 shrink-0" aria-hidden />
        <span className={`min-w-0 truncate ${labelCls}`}>{t("nav.reports")}</span>
      </Link>

      <div>
        <button
          type="button"
          onClick={() => setIsFinanceOpen(!isFinanceOpen)}
          className={`flex w-full items-center rounded-md py-2 text-base transition-colors ${groupRow} ${activeRow(isFinanceGroupActive)}`}
        >
          <span className={groupMainCls}>
            <Wallet className="h-5 w-5 shrink-0" aria-hidden />
            <span className={`min-w-0 truncate ${labelCls}`}>{t("nav.finance")}</span>
          </span>
          {isFinanceOpen ? (
            <ChevronDown className={chevronCls} aria-hidden />
          ) : (
            <ChevronRight className={chevronCls} aria-hidden />
          )}
        </button>

        {isFinanceOpen && (
          <div className={nestedWrap}>
            {financeItems.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center rounded-md py-2 text-base transition-colors ${linkRow} ${activeRow(isActive(href))}`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className={`min-w-0 truncate ${labelCls}`}>{label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-primary-600 dark:border-primary-700" />

      <div>
        <button
          type="button"
          onClick={() => setIsHROpen(!isHROpen)}
          className={`flex w-full items-center rounded-md py-2 text-base transition-colors ${groupRow} ${activeRow(isHRGroupActive)}`}
        >
          <span className={groupMainCls}>
            <UsersRound className="h-5 w-5 shrink-0" aria-hidden />
            <span className={`min-w-0 truncate ${labelCls}`}>{t("nav.humanResources")}</span>
          </span>
          {isHROpen ? (
            <ChevronDown className={chevronCls} aria-hidden />
          ) : (
            <ChevronRight className={chevronCls} aria-hidden />
          )}
        </button>

        {isHROpen && (
          <div className={nestedWrap}>
            {hrItems.map(({ href, label, Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center rounded-md py-2 text-base transition-colors ${linkRow} ${activeRow(isActive(href))}`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className={`min-w-0 truncate ${labelCls}`}>{label}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-primary-600 dark:border-primary-700" />

      <Link
        href={`/${locale}/notifications`}
        className={`flex items-center rounded-md py-2 text-base transition-colors ${linkRow} ${activeRow(isActive(`/${locale}/notifications`))}`}
      >
        <Bell className="h-5 w-5 shrink-0" aria-hidden />
        <span className={`min-w-0 truncate ${labelCls}`}>{t("nav.notifications")}</span>
      </Link>
    </nav>
  );
}
