/** Mitigate CSV/Excel formula injection (leading =, +, -, @). */
export function sanitizeExcelCellValue(value: string): string {
  if (value.length === 0) return value;
  const c = value[0];
  if (c === '=' || c === '+' || c === '-' || c === '@' || c === '\t') {
    return `'${value}`;
  }
  return value;
}
