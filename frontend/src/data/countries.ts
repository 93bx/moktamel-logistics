/**
 * Country list for nationality selection (ISO 3166-1 alpha-2).
 * English names are stored in API; display uses name_en or name_ar by locale.
 */

export type Country = {
  readonly code: string;
  readonly name_en: string;
  readonly name_ar: string;
};

export const countries: readonly Country[] = [
  { code: "AF", name_en: "Afghanistan", name_ar: "أفغانستان" },
  { code: "AL", name_en: "Albania", name_ar: "ألبانيا" },
  { code: "DZ", name_en: "Algeria", name_ar: "الجزائر" },
  { code: "BD", name_en: "Bangladesh", name_ar: "بنغلاديش" },
  { code: "BH", name_en: "Bahrain", name_ar: "البحرين" },
  { code: "EG", name_en: "Egypt", name_ar: "مصر" },
  { code: "ET", name_en: "Ethiopia", name_ar: "إثيوبيا" },
  { code: "GH", name_en: "Ghana", name_ar: "غانا" },
  { code: "IN", name_en: "India", name_ar: "الهند" },
  { code: "ID", name_en: "Indonesia", name_ar: "إندونيسيا" },
  { code: "IQ", name_en: "Iraq", name_ar: "العراق" },
  { code: "JO", name_en: "Jordan", name_ar: "الأردن" },
  { code: "KE", name_en: "Kenya", name_ar: "كينيا" },
  { code: "KW", name_en: "Kuwait", name_ar: "الكويت" },
  { code: "LB", name_en: "Lebanon", name_ar: "لبنان" },
  { code: "LY", name_en: "Libya", name_ar: "ليبيا" },
  { code: "MY", name_en: "Malaysia", name_ar: "ماليزيا" },
  { code: "MR", name_en: "Mauritania", name_ar: "موريتانيا" },
  { code: "MA", name_en: "Morocco", name_ar: "المغرب" },
  { code: "NP", name_en: "Nepal", name_ar: "نيبال" },
  { code: "NG", name_en: "Nigeria", name_ar: "نيجيريا" },
  { code: "OM", name_en: "Oman", name_ar: "عُمان" },
  { code: "PK", name_en: "Pakistan", name_ar: "باكستان" },
  { code: "PS", name_en: "Palestine", name_ar: "فلسطين" },
  { code: "PH", name_en: "Philippines", name_ar: "الفلبين" },
  { code: "QA", name_en: "Qatar", name_ar: "قطر" },
  { code: "SA", name_en: "Saudi Arabia", name_ar: "المملكة العربية السعودية" },
  { code: "SN", name_en: "Senegal", name_ar: "السنغال" },
  { code: "LK", name_en: "Sri Lanka", name_ar: "سريلانكا" },
  { code: "SD", name_en: "Sudan", name_ar: "السودان" },
  { code: "SY", name_en: "Syria", name_ar: "سوريا" },
  { code: "TZ", name_en: "Tanzania", name_ar: "تنزانيا" },
  { code: "TN", name_en: "Tunisia", name_ar: "تونس" },
  { code: "TR", name_en: "Turkey", name_ar: "تركيا" },
  { code: "UG", name_en: "Uganda", name_ar: "أوغندا" },
  { code: "AE", name_en: "United Arab Emirates", name_ar: "الإمارات العربية المتحدة" },
  { code: "YE", name_en: "Yemen", name_ar: "اليمن" },
  { code: "ZM", name_en: "Zambia", name_ar: "زامبيا" },
  { code: "CN", name_en: "China", name_ar: "الصين" },
  { code: "TH", name_en: "Thailand", name_ar: "تايلاند" },
  { code: "VN", name_en: "Vietnam", name_ar: "فيتنام" },
  { code: "MM", name_en: "Myanmar", name_ar: "ميانمار" },
  { code: "SO", name_en: "Somalia", name_ar: "الصومال" },
  { code: "DJ", name_en: "Djibouti", name_ar: "جيبوتي" },
  { code: "ER", name_en: "Eritrea", name_ar: "إريتريا" },
  { code: "SS", name_en: "South Sudan", name_ar: "جنوب السودان" },
  { code: "CI", name_en: "Ivory Coast", name_ar: "ساحل العاج" },
  { code: "ML", name_en: "Mali", name_ar: "مالي" },
  { code: "NE", name_en: "Niger", name_ar: "النيجر" },
  { code: "BF", name_en: "Burkina Faso", name_ar: "بوركينا فاسو" },
  { code: "GW", name_en: "Guinea-Bissau", name_ar: "غينيا بيساو" },
  { code: "GM", name_en: "Gambia", name_ar: "غامبيا" },
  { code: "GN", name_en: "Guinea", name_ar: "غينيا" },
  { code: "SL", name_en: "Sierra Leone", name_ar: "سيراليون" },
  { code: "LR", name_en: "Liberia", name_ar: "ليبيريا" },
  { code: "TG", name_en: "Togo", name_ar: "توغو" },
  { code: "BJ", name_en: "Benin", name_ar: "بنين" },
  { code: "CM", name_en: "Cameroon", name_ar: "الكاميرون" },
  { code: "CD", name_en: "Democratic Republic of the Congo", name_ar: "جمهورية الكونغو الديمقراطية" },
  { code: "RW", name_en: "Rwanda", name_ar: "رواندا" },
  { code: "MW", name_en: "Malawi", name_ar: "ملاوي" },
  { code: "MZ", name_en: "Mozambique", name_ar: "موزمبيق" },
  { code: "ZW", name_en: "Zimbabwe", name_ar: "زيمبابوي" },
  { code: "ZA", name_en: "South Africa", name_ar: "جنوب أفريقيا" },
  { code: "GB", name_en: "United Kingdom", name_ar: "المملكة المتحدة" },
  { code: "US", name_en: "United States", name_ar: "الولايات المتحدة" },
  { code: "FR", name_en: "France", name_ar: "فرنسا" },
  { code: "DE", name_en: "Germany", name_ar: "ألمانيا" },
  { code: "IT", name_en: "Italy", name_ar: "إيطاليا" },
  { code: "ES", name_en: "Spain", name_ar: "إسبانيا" },
  { code: "RU", name_en: "Russia", name_ar: "روسيا" },
  { code: "AU", name_en: "Australia", name_ar: "أستراليا" },
  { code: "CA", name_en: "Canada", name_ar: "كندا" },
  { code: "BR", name_en: "Brazil", name_ar: "البرازيل" },
  { code: "AR", name_en: "Argentina", name_ar: "الأرجنتين" },
  { code: "MX", name_en: "Mexico", name_ar: "المكسيك" },
  { code: "KR", name_en: "South Korea", name_ar: "كوريا الجنوبية" },
  { code: "JP", name_en: "Japan", name_ar: "اليابان" },
  { code: "IR", name_en: "Iran", name_ar: "إيران" },
] as const;

const nameEnToCountry = new Map<string, Country>(
  countries.map((c) => [c.name_en, c])
);

/**
 * Find a country by English name (used when value is stored from API).
 */
export function getCountryByNameEn(name: string | null | undefined): Country | undefined {
  if (name == null || !name.trim()) return undefined;
  return nameEnToCountry.get(name.trim());
}

/**
 * Get display name for a country by locale.
 */
export function getCountryDisplayName(
  country: Country,
  locale: "ar" | "en"
): string {
  return locale === "ar" ? country.name_ar : country.name_en;
}

/**
 * Get flag image URL (Flagcdn.com). Use lowercase code.
 */
export function getFlagUrl(code: string, size: "w40" | "h20" = "w40"): string {
  return `https://flagcdn.com/${size}/${code.toLowerCase()}.png`;
}

/**
 * Filter countries by query (matches name_en and name_ar, case-insensitive).
 */
export function filterCountries(query: string): readonly Country[] {
  const q = query.trim();
  if (!q) return countries;
  const qLower = q.toLowerCase();
  return countries.filter(
    (c) =>
      c.name_en.toLowerCase().includes(qLower) || c.name_ar.includes(q)
  );
}
