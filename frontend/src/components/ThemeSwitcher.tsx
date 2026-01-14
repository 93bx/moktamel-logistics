"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Moon, Sun } from "lucide-react";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const t = useTranslations();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        className="rounded-md p-2 text-primary-50 hover:bg-primary-600 hover:text-white dark:text-primary-100 dark:hover:bg-primary-800"
        aria-label={t("common.theme")}
      >
        <Sun className="h-5 w-5" />
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="rounded-md p-2 text-primary-50 hover:bg-primary-600 hover:text-white dark:text-primary-100 dark:hover:bg-primary-800"
      aria-label={t("common.theme")}
      title={theme === "dark" ? t("common.lightMode") : t("common.darkMode")}
    >
      {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
    </button>
  );
}

