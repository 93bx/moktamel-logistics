/**
 * Fixed tier ranges for progressive deduction calculations.
 * These are global constants used across the system.
 */

export type DeductionTier = {
  from: number;
  to: number;
  deduction: number;
};

/**
 * Fixed orders deficit tier ranges (missing orders from target).
 * User can only edit the deduction amount per tier.
 * Progressive stacking: each tier applies its rate to orders within its range.
 */
export const ORDERS_TIER_RANGES: Array<{ from: number; to: number }> = [
  { from: 1, to: 50 },
  { from: 51, to: 100 },
  { from: 101, to: 150 },
  { from: 151, to: 200 },
  { from: 201, to: 250 },
];

/**
 * Get default orders deduction tiers with zero deductions.
 * Used for initialization and validation.
 */
export function getDefaultOrdersTiers(): DeductionTier[] {
  return ORDERS_TIER_RANGES.map((range) => ({
    ...range,
    deduction: 0,
  }));
}

/**
 * Validate that orders tiers match the expected structure.
 * Returns true if valid, false otherwise.
 */
export function validateOrdersTiersStructure(
  tiers: DeductionTier[] | null | undefined,
): boolean {
  if (!tiers || tiers.length !== ORDERS_TIER_RANGES.length) {
    return false;
  }

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const expected = ORDERS_TIER_RANGES[i];
    if (tier.from !== expected.from || tier.to !== expected.to) {
      return false;
    }
    if (tier.deduction < 0) {
      return false;
    }
  }

  return true;
}

/** Number of configurable revenue deficit bands (flat deduction each). */
export const REVENUE_TIER_COUNT = 9;

/**
 * Generate revenue deduction tiers from a unit amount.
 * Each tier is a SAR band of the revenue deficit; deduction is a flat amount per band crossed.
 *
 * @param unitAmount - Band width in SAR (e.g., 800)
 * @param tierDeductions - Exactly REVENUE_TIER_COUNT flat deduction amounts (SAR) per band
 */
export function generateRevenueTiers(
  unitAmount: number,
  tierDeductions: number[],
): DeductionTier[] {
  if (tierDeductions.length !== REVENUE_TIER_COUNT) {
    throw new Error(
      `Revenue tiers must have exactly ${REVENUE_TIER_COUNT} deduction amounts`,
    );
  }

  return tierDeductions.map((deduction, index) => ({
    from: index * unitAmount + 1,
    to: (index + 1) * unitAmount,
    deduction,
  }));
}

/**
 * Validate revenue tiers structure.
 * Checks that tiers are consecutive and based on a consistent unit amount.
 */
export function validateRevenueTiersStructure(
  tiers: DeductionTier[] | null | undefined,
  unitAmount: number | null | undefined,
): boolean {
  if (
    !tiers ||
    tiers.length !== REVENUE_TIER_COUNT ||
    !unitAmount ||
    unitAmount <= 0
  ) {
    return false;
  }

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const expectedFrom = i * unitAmount + 1;
    const expectedTo = (i + 1) * unitAmount;

    if (tier.from !== expectedFrom || tier.to !== expectedTo) {
      return false;
    }
    if (tier.deduction < 0) {
      return false;
    }
  }

  return true;
}
