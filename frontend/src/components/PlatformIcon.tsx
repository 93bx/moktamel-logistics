"use client";

import { useTranslations } from "next-intl";
import { ShoppingBag, Truck, Zap, Coffee } from "lucide-react";

export function PlatformIcon({ platform }: { platform: string }) {
  const t = useTranslations();

  const getPlatformInfo = (p: string) => {
    switch (p.toUpperCase()) {
      case "JAHEZ":
        return {
          label: t("common.platformJahez"),
          icon: ShoppingBag,
          color: "text-red-600 dark:text-red-400",
        };
      case "NONE":
        return {
          label: t("common.platformNone"),
          icon: ShoppingBag,
          color: "text-zinc-500 dark:text-zinc-400",
        };
      case "HUNGERSTATION":
        return {
          label: t("common.platformHungerstation"),
          icon: Zap,
          color: "text-amber-500 dark:text-amber-400",
        };
      case "NINJA":
        return {
          label: t("common.platformNinja"),
          icon: Truck,
          color: "text-zinc-900 dark:text-zinc-100",
        };
      case "KEETA":
        return {
          label: t("common.platformKeeta"),
          icon: Coffee,
          color: "text-emerald-600 dark:text-emerald-400",
        };
      default:
        return {
          label: p,
          icon: ShoppingBag,
          color: "text-zinc-400",
        };
    }
  };

  const { label, icon: Icon, color } = getPlatformInfo(platform);

  return (
    <div className={`flex items-center gap-1.5 text-sm font-medium ${color}`}>
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </div>
  );
}

