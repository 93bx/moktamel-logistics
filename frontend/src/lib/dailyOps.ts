export function buildDateRange(date?: string | null) {
  if (!date) return { from: "", to: "" };
  const normalized = date.slice(0, 10);
  if (isNaN(Date.parse(normalized))) return { from: "", to: "" };
  return {
    from: `${normalized}T00:00:00.000Z`,
    to: `${normalized}T23:59:59.999Z`,
  };
}

/** UTC range for a month (YYYY-MM). First day 00:00:00 to last day 23:59:59. */
export function monthToDateRange(month: string): { from: string; to: string } {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return { from: "", to: "" };
  const [y, m] = month.split("-").map(Number);
  if (m < 1 || m > 12) return { from: "", to: "" };
  const from = `${month}-01T00:00:00.000Z`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}T23:59:59.999Z`;
  return { from, to };
}


