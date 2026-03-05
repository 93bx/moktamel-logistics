/**
 * Dashboard month and range helpers.
 * Month format: YYYY-MM. All ranges in UTC/ISO for API.
 */

export function getCurrentMonthYYYYMM(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function parseMonthFromSearchParams(monthParam: string | undefined): string {
  if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
    return getCurrentMonthYYYYMM();
  }
  return monthParam;
}

export function monthToQuery(month: string): string {
  return month ? `?month=${encodeURIComponent(month)}` : "";
}
