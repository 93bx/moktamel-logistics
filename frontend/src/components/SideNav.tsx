"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, ChevronRight } from "lucide-react";

export function SideNav() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations();
  const [isHROpen, setIsHROpen] = useState(true);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const hrItems = [
    { href: `/${locale}/recruitment`, label: t("nav.recruitment") },
    { href: `/${locale}/employment`, label: t("nav.employment") },
    { href: `/${locale}/assets`, label: t("nav.assets") },
    { href: `/${locale}/fleet`, label: t("nav.fleetManagement") },
  ];

  const isHRGroupActive = hrItems.some((item) => isActive(item.href));

  return (
    <nav className="mt-5 space-y-1">
      {/* Dashboard */}
      <Link
        href={`/${locale}/dashboard`}
        className={`block rounded-md px-3 py-2 text-base transition-colors ${
          isActive(`/${locale}/dashboard`)
            ? "bg-white text-[#244473] dark:bg-black dark:text-[#244473]"
            : "text-primary-50 hover:bg-primary-600 dark:text-primary-100 dark:hover:bg-primary-800"
        }`}
      >
        {t("nav.dashboard")}
      </Link>

      <div className="border-t border-primary-600 dark:border-primary-700" />

      {/* Daily Operations */}
      <Link
        href={`/${locale}/daily-operations`}
        className={`block rounded-md px-3 py-2 text-base transition-colors ${
          isActive(`/${locale}/daily-operations`)
            ? "bg-white text-[#244473] dark:bg-black dark:text-[#244473]"
            : "text-primary-50 hover:bg-primary-600 dark:text-primary-100 dark:hover:bg-primary-800"
        }`}
      >
        {t("nav.dailyOperations")}
      </Link>

      <Link
        href={`/${locale}/cash-loans`}
        className={`block rounded-md px-3 py-2 text-base transition-colors ${
          isActive(`/${locale}/cash-loans`)
            ? "bg-white text-[#244473] dark:bg-black dark:text-[#244473]"
            : "text-primary-50 hover:bg-primary-600 dark:text-primary-100 dark:hover:bg-primary-800"
        }`}
      >
        {t("nav.cashLoans")}
      </Link>

      <Link
        href={`/${locale}/payroll-config`}
        className={`block rounded-md px-3 py-2 text-base transition-colors ${
          isActive(`/${locale}/payroll-config`)
            ? "bg-white text-[#244473] dark:bg-black dark:text-[#244473]"
            : "text-primary-50 hover:bg-primary-600 dark:text-primary-100 dark:hover:bg-primary-800"
        }`}
      >
        {t("nav.payrollConfig")}
      </Link>

      <Link
        href={`/${locale}/salaries-payroll`}
        className={`block rounded-md px-3 py-2 text-base transition-colors ${
          isActive(`/${locale}/salaries-payroll`)
            ? "bg-white text-[#244473] dark:bg-black dark:text-[#244473]"
            : "text-primary-50 hover:bg-primary-600 dark:text-primary-100 dark:hover:bg-primary-800"
        }`}
      >
        {t("nav.salariesPayroll")}
      </Link>

      <div className="border-t border-primary-600 dark:border-primary-700" />

      {/* Human Resources Group */}
      <div>
        <button
          onClick={() => setIsHROpen(!isHROpen)}
          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-base transition-colors ${
            isHRGroupActive
              ? "bg-white text-[#244473] dark:bg-black dark:text-[#244473]"
              : "text-primary-50 hover:bg-primary-600 dark:text-primary-100 dark:hover:bg-primary-800"
          }`}
        >
          <span>{t("nav.humanResources")}</span>
          {isHROpen ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {isHROpen && (
          <div className="ml-4 mt-1 space-y-1">
            {hrItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-base transition-colors ${
                  isActive(item.href)
                    ? "bg-white text-[#244473] dark:bg-black dark:text-[#244473]"
                    : "text-primary-50 hover:bg-primary-600 dark:text-primary-100 dark:hover:bg-primary-800"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-primary-600 dark:border-primary-700" />

      {/* Notifications */}
      <Link
        href={`/${locale}/notifications`}
        className={`block rounded-md px-3 py-2 text-base transition-colors ${
          isActive(`/${locale}/notifications`)
            ? "bg-white text-[#244473] dark:bg-black dark:text-[#244473]"
            : "text-primary-50 hover:bg-primary-600 dark:text-primary-100 dark:hover:bg-primary-800"
        }`}
      >
        {t("nav.notifications")}
      </Link>

      <div className="border-t border-primary-600 dark:border-primary-700" />

      {/* Analytics */}
      <Link
        href={`/${locale}/analytics`}
        className={`block rounded-md px-3 py-2 text-base transition-colors ${
          isActive(`/${locale}/analytics`)
            ? "bg-white text-[#244473] dark:bg-black dark:text-[#244473]"
            : "text-primary-50 hover:bg-primary-600 dark:text-primary-100 dark:hover:bg-primary-800"
        }`}
      >
        {t("nav.analytics")}
      </Link>
    </nav>
  );
}

