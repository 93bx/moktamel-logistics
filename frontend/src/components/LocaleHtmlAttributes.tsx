"use client";

import { useEffect } from "react";

export function LocaleHtmlAttributes({ locale }: { locale: "en" | "ar" }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  }, [locale]);

  return null;
}


