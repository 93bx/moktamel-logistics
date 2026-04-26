/**
 * KSA (Asia/Riyadh) month boundary utilities for payroll calculations.
 * All dates are returned as UTC Date objects representing the exact instants
 * in KSA timezone for use with Prisma queries.
 */

/**
 * Get the start and end Date objects for a given month in KSA timezone.
 * Returns UTC Date objects representing:
 * - start: 00:00:00.000 on the 1st day of the month in Asia/Riyadh
 * - end: 23:59:59.999 on the last day of the month in Asia/Riyadh
 *
 * @param year - The year (e.g., 2024)
 * @param month - The month (1-12)
 * @returns Object with start and end Date objects in UTC
 */
export function getKSAMonthBounds(
  year: number,
  month: number,
): {
  start: Date;
  end: Date;
} {
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}. Must be between 1 and 12.`);
  }

  // KSA timezone is UTC+3 (no DST)
  const KSA_OFFSET_HOURS = 3;

  // Start of month in KSA: YYYY-MM-01 00:00:00 Asia/Riyadh
  // Convert to UTC by subtracting the offset
  const startUTC = new Date(
    Date.UTC(year, month - 1, 1, 0, 0, 0, 0) -
      KSA_OFFSET_HOURS * 60 * 60 * 1000,
  );

  // End of month in KSA: last day 23:59:59.999 Asia/Riyadh
  // Get the last day of the month
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endUTC = new Date(
    Date.UTC(year, month - 1, lastDay, 23, 59, 59, 999) -
      KSA_OFFSET_HOURS * 60 * 60 * 1000,
  );

  return { start: startUTC, end: endUTC };
}

/**
 * Get the normalized first-of-month Date for a given year/month in KSA timezone.
 * This is used as the canonical month identifier in PayrollRun.month.
 *
 * @param year - The year
 * @param month - The month (1-12)
 * @returns Date object representing 00:00:00 UTC on the 1st of the month in KSA
 */
export function getKSAMonthIdentifier(year: number, month: number): Date {
  const { start } = getKSAMonthBounds(year, month);
  // Return the start instant as the month identifier
  return start;
}

/**
 * Get the current month and year in KSA timezone.
 *
 * @returns Object with year and month (1-12) in KSA timezone
 */
export function getCurrentKSAMonth(): { year: number; month: number } {
  const now = new Date();
  // Convert current UTC time to KSA time
  const ksaTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  return {
    year: ksaTime.getUTCFullYear(),
    month: ksaTime.getUTCMonth() + 1,
  };
}
