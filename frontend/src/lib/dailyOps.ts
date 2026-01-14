export function buildDateRange(date?: string | null) {
  if (!date) return { from: "", to: "" };
  const normalized = date.slice(0, 10);
  if (isNaN(Date.parse(normalized))) return { from: "", to: "" };
  return {
    from: `${normalized}T00:00:00.000Z`,
    to: `${normalized}T23:59:59.999Z`,
  };
}


