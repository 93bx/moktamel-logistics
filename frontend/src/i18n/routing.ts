export const locales = ["en", "ar"] as const;
export type AppLocale = (typeof locales)[number];
export const defaultLocale: AppLocale = "ar";

export function isLocale(value: string): value is AppLocale {
  return (locales as readonly string[]).includes(value);
}


