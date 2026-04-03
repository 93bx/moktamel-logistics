"use client";

import Link from "next/link";
import {
  Ban,
  CheckCircle,
  CircleHelp,
  UserPlus,
  Users,
  UserX,
} from "lucide-react";

export type EmploymentStatCardItem = {
  key: string;
  href: string;
  isActive: boolean;
  label: string;
  value: number;
  tip: string;
  kind: "total" | "active" | "onboarding" | "deserted" | "deactivated";
};

const ICONS = {
  total: Users,
  active: CheckCircle,
  onboarding: UserPlus,
  deserted: UserX,
  deactivated: Ban,
} as const;

export function EmploymentStatCards({
  locale,
  cards,
}: {
  locale: string;
  cards: EmploymentStatCardItem[];
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map(({ key, href, isActive, label, value, tip, kind }) => {
        const Icon = ICONS[kind];
        return (
          <Link
            key={key}
            href={href}
            className={`group relative cursor-pointer rounded-lg border p-4 transition-colors dark:bg-zinc-800 ${
              isActive
                ? "border-primary bg-primary/5 ring-2 ring-primary/20 dark:bg-primary/10"
                : "border-zinc-200 bg-white dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700/50"
            }`}
          >
            <span
              className={`absolute top-2 ${locale === "ar" ? "left-2" : "right-2"} group/tip inline-flex items-center justify-center rounded-full bg-zinc-100 p-1 text-primary/60 shadow-sm ring-1 ring-zinc-200 transition-colors hover:bg-zinc-200 dark:bg-zinc-700 dark:text-zinc-200 dark:ring-zinc-600 dark:hover:bg-zinc-600`}
              aria-label={tip}
              tabIndex={0}
              onClick={(e) => e.preventDefault()}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <CircleHelp className="h-3.5 w-3.5" />
              <span
                className={`pointer-events-none absolute top-full z-20 mt-2 w-56 rounded-md border border-zinc-200 bg-white p-2 text-xs font-normal text-zinc-700 opacity-0 shadow-lg transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-visible/tip:opacity-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 ${locale === "ar" ? "left-0 text-right" : "right-0 text-left"}`}
                role="tooltip"
              >
                {tip}
              </span>
            </span>
            <div className="flex items-center gap-2 text-sm text-primary/70">
              <Icon className="h-4 w-4 shrink-0 text-primary/70" aria-hidden />
              <span>{label}</span>
            </div>
            <div className="mt-1 text-2xl font-semibold text-primary">{value}</div>
          </Link>
        );
      })}
    </div>
  );
}
