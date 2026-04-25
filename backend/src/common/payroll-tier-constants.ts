/**
 * Deduction tiers for progressive payroll calculations.
 * Tiers use deficit coordinates: the first missing order/SAR of shortfall is 1, then 2, …
 * Revenue shortfall is consumed sequentially from the highest band (largest `from`) downward;
 * overflow beyond defined bands uses the strictest band (starts at 1).
 */

export type DeductionTier = {
  from: number;
  to: number;
  deduction: number;
};

/** Maximum configurable tiers for orders and revenue deduction. */
export const MAX_DEDUCTION_TIERS = 9;

/** Minimum configurable tiers (product rule). */
export const MIN_DEDUCTION_TIERS = 3;

/** Revenue deduction uses 1..8 contiguous bands. */
export const MIN_REVENUE_DEDUCTION_TIERS = 1;

export const MAX_REVENUE_DEDUCTION_TIERS = 8;

/** Default SAR per unit block for revenue tier deduction (configurable). */
export const DEFAULT_REVENUE_UNIT_AMOUNT = 16;

/** @deprecated Legacy preset; use custom contiguous tiers (1–9) in config. */
export const ORDERS_TIER_RANGES: Array<{ from: number; to: number }> = [
  { from: 1, to: 50 },
  { from: 51, to: 100 },
  { from: 101, to: 150 },
  { from: 151, to: 200 },
  { from: 201, to: 250 },
];

export function sortTiersAscending(tiers: DeductionTier[]): DeductionTier[] {
  return [...tiers].sort((a, b) => a.from - b.from);
}

export function sortTiersDescending(tiers: DeductionTier[]): DeductionTier[] {
  return [...tiers].sort((a, b) => b.from - a.from);
}

function isValidIntegerBound(n: number): boolean {
  return Number.isFinite(n) && Number.isInteger(n) && n >= 1;
}

/**
 * Validates contiguous deficit bands: sorted ascending by `from`, starting at 1, no gaps or overlaps.
 */
export function validateDeficitTiersStructure(
  tiers: DeductionTier[] | null | undefined,
): boolean {
  if (
    !tiers ||
    tiers.length < MIN_DEDUCTION_TIERS ||
    tiers.length > MAX_DEDUCTION_TIERS
  ) {
    return false;
  }

  const sorted = sortTiersAscending(tiers);

  if (sorted[0].from !== 1) {
    return false;
  }

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (!isValidIntegerBound(t.from) || !isValidIntegerBound(t.to)) {
      return false;
    }
    if (t.from > t.to) {
      return false;
    }
    if (i > 0 && sorted[i].from !== sorted[i - 1].to + 1) {
      return false;
    }
  }

  return true;
}

/**
 * Orders: contiguous tiers + non-negative deduction per missing order in each band.
 */
export function validateOrdersTiersStructure(
  tiers: DeductionTier[] | null | undefined,
): boolean {
  if (!validateDeficitTiersStructure(tiers)) {
    return false;
  }
  const sorted = sortTiersAscending(tiers!);
  for (const t of sorted) {
    if (t.deduction < 0 || !Number.isFinite(t.deduction)) {
      return false;
    }
  }
  return true;
}

/**
 * Contiguous deficit bands for revenue: exactly eight rows, from 1, no gaps or overlaps.
 */
export function validateRevenueBandsStructure(
  tiers: DeductionTier[] | null | undefined,
): boolean {
  if (
    !tiers ||
    tiers.length < MIN_REVENUE_DEDUCTION_TIERS ||
    tiers.length > MAX_REVENUE_DEDUCTION_TIERS
  ) {
    return false;
  }

  const sorted = sortTiersAscending(tiers);

  if (sorted[0].from !== 1) {
    return false;
  }

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (!isValidIntegerBound(t.from) || !isValidIntegerBound(t.to)) {
      return false;
    }
    if (t.from > t.to) {
      return false;
    }
    if (i > 0 && sorted[i].from !== sorted[i - 1].to + 1) {
      return false;
    }
  }

  return true;
}

/**
 * Revenue: eight contiguous tiers + positive unit amount + non-negative deduction (SAR per unit SAR of shortfall in band).
 */
export function validateRevenueTiersStructure(
  tiers: DeductionTier[] | null | undefined,
  unitAmount: number | null | undefined,
): boolean {
  if (
    unitAmount == null ||
    !Number.isFinite(unitAmount) ||
    unitAmount <= 0
  ) {
    return false;
  }
  if (!validateRevenueBandsStructure(tiers)) {
    return false;
  }
  const sorted = sortTiersAscending(tiers!);
  for (const t of sorted) {
    if (t.deduction < 0 || !Number.isFinite(t.deduction)) {
      return false;
    }
  }
  return true;
}

/** Default orders tiers for empty config (meets minimum tier count). */
export function getDefaultOrdersTiers(): DeductionTier[] {
  return [
    { from: 1, to: 1, deduction: 0 },
    { from: 2, to: 2, deduction: 0 },
    { from: 3, to: 3, deduction: 0 },
  ];
}

/** Default revenue shortfall bands (1–6399 SAR); higher bands use lower per-unit deduction. */
export function getDefaultRevenueTiers(): DeductionTier[] {
  return [
    { from: 1, to: 800, deduction: 9 },
    { from: 801, to: 1600, deduction: 8 },
    { from: 1601, to: 2400, deduction: 7 },
    { from: 2401, to: 3200, deduction: 6 },
    { from: 3201, to: 4000, deduction: 5 },
  ];
}
