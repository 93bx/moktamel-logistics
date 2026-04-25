/**
 * Mirrors backend/src/common/payroll-tier-constants.ts for client-side validation.
 */

export type DeductionTier = {
  from: number;
  to: number;
  deduction: number;
};

export const MAX_DEDUCTION_TIERS = 9;

/** Minimum configurable tiers (must match backend MIN_DEDUCTION_TIERS). */
export const MIN_DEDUCTION_TIERS = 3;

/** Revenue deduction uses 1..8 contiguous bands (must match backend). */
export const MIN_REVENUE_DEDUCTION_TIERS = 1;

export const MAX_REVENUE_DEDUCTION_TIERS = 8;

export const DEFAULT_REVENUE_UNIT_AMOUNT = 16;

/** Legacy preset when stored config is empty (matches historical defaults). */
export const LEGACY_DEFAULT_ORDERS_TIERS: DeductionTier[] = [
  { from: 1, to: 50, deduction: 0 },
  { from: 51, to: 100, deduction: 0 },
  { from: 101, to: 150, deduction: 0 },
  { from: 151, to: 200, deduction: 0 },
  { from: 201, to: 250, deduction: 0 },
];

export function sortTiersAscending(tiers: DeductionTier[]): DeductionTier[] {
  return [...tiers].sort((a, b) => a.from - b.from);
}

export function sortTiersDescending(tiers: DeductionTier[]): DeductionTier[] {
  return [...tiers].sort((a, b) => b.from - a.from);
}

/** Forces tier[0].from = 1 and each next from = previous.to + 1; clamps to >= from. */
export function enforceContiguousFromChain(tiers: DeductionTier[]): DeductionTier[] {
  const s = sortTiersAscending(tiers);
  if (s.length === 0) return [];
  const out: DeductionTier[] = [];
  let nextFrom = 1;
  for (let i = 0; i < s.length; i++) {
    const to = Math.max(nextFrom, s[i].to);
    out.push({ from: nextFrom, to, deduction: s[i].deduction });
    nextFrom = to + 1;
  }
  return out;
}

/**
 * After boundary edits, keep each tier's `from` equal to `previous.to + 1` and
 * bump `to` when it would fall below `from`.
 */
function propagateContiguousFromBoundaries(s: DeductionTier[]): DeductionTier[] {
  const out = s.map((t) => ({ ...t }));
  for (let j = 1; j < out.length; j++) {
    const needFrom = out[j - 1].to + 1;
    out[j] = { ...out[j], from: needFrom };
    if (out[j].to < out[j].from) {
      out[j] = { ...out[j], to: out[j].from };
    }
  }
  return out;
}

/**
 * Apply a user edit to `from` at `ascIndex` (ascending order). Tier 0 always starts at 1.
 * Adjusts the previous tier's `to` to `from - 1` and propagates forward so the chain stays contiguous.
 */
export function applyTierFromAtIndex(
  tiers: DeductionTier[],
  ascIndex: number,
  newFrom: number,
): DeductionTier[] {
  const s = sortTiersAscending(tiers.map((t) => ({ ...t })));
  if (s.length === 0 || ascIndex < 0 || ascIndex >= s.length) {
    return s;
  }

  let f = Math.trunc(newFrom);
  if (!Number.isFinite(f)) return s;

  if (ascIndex === 0) {
    s[0].from = 1;
    s[0].to = Math.max(1, s[0].to);
    return propagateContiguousFromBoundaries(s);
  }

  const prev = s[ascIndex - 1];
  const cur = s[ascIndex];
  const minF = prev.from + 1;
  if (f < minF) f = minF;
  if (f > cur.to) f = cur.to;

  s[ascIndex - 1] = { ...prev, to: f - 1 };
  s[ascIndex] = { ...cur, from: f };

  return propagateContiguousFromBoundaries(s);
}

function isValidIntegerBound(n: number): boolean {
  return Number.isFinite(n) && Number.isInteger(n) && n >= 1;
}

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

/** Which tier row fields failed validation (ascending tier index). */
export type TierFieldKey = "from" | "to" | "deduction";

export type TierCellErrorMap = Partial<
  Record<number, Partial<Record<TierFieldKey, boolean>>>
>;

export type TierStructureIssueCode =
  | "count"
  | "startAtOne"
  | "bound"
  | "range"
  | "gapOrOverlap";

export type TierStructureIssue = {
  code: TierStructureIssueCode;
  rowIndex?: number;
};

/**
 * Maps gaps, overlaps, invalid bounds, and wrong start (not 1) onto `from` / `to` cells.
 */
export function getDeficitTierStructureCellErrors(
  tiers: DeductionTier[] | null | undefined,
): { isValid: boolean; cells: TierCellErrorMap } {
  const cells: TierCellErrorMap = {};
  const mark = (i: number, k: TierFieldKey) => {
    cells[i] = { ...cells[i], [k]: true };
  };

  if (!tiers || tiers.length === 0) {
    return { isValid: false, cells };
  }

  if (
    tiers.length < MIN_DEDUCTION_TIERS ||
    tiers.length > MAX_DEDUCTION_TIERS
  ) {
    const sorted = sortTiersAscending(tiers);
    sorted.forEach((_, i) => {
      mark(i, "from");
      mark(i, "to");
    });
    return { isValid: false, cells };
  }

  const sorted = sortTiersAscending(tiers);
  let ok = true;

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (!isValidIntegerBound(t.from)) {
      mark(i, "from");
      ok = false;
    }
    if (!isValidIntegerBound(t.to)) {
      mark(i, "to");
      ok = false;
    }
    if (
      isValidIntegerBound(t.from) &&
      isValidIntegerBound(t.to) &&
      t.from > t.to
    ) {
      mark(i, "from");
      mark(i, "to");
      ok = false;
    }
  }

  if (sorted[0].from !== 1) {
    mark(0, "from");
    ok = false;
  }

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].from !== sorted[i - 1].to + 1) {
      mark(i, "from");
      mark(i - 1, "to");
      ok = false;
    }
  }

  return { isValid: ok, cells };
}

function collectTierStructureIssues(
  tiers: DeductionTier[] | null | undefined,
  minCount: number,
  maxCount: number,
): TierStructureIssue[] {
  const issues: TierStructureIssue[] = [];
  const seen = new Set<string>();
  const push = (code: TierStructureIssueCode, rowIndex?: number) => {
    const key = `${code}:${rowIndex ?? -1}`;
    if (!seen.has(key)) {
      seen.add(key);
      issues.push({ code, rowIndex });
    }
  };

  if (!tiers || tiers.length === 0) {
    push("count");
    return issues;
  }

  if (tiers.length < minCount || tiers.length > maxCount) {
    push("count");
  }

  const sorted = sortTiersAscending(tiers);
  if (sorted[0]?.from !== 1) {
    push("startAtOne", 0);
  }

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (!isValidIntegerBound(t.from) || !isValidIntegerBound(t.to)) {
      push("bound", i);
      continue;
    }
    if (t.from > t.to) {
      push("range", i);
    }
    if (i > 0 && sorted[i].from !== sorted[i - 1].to + 1) {
      push("gapOrOverlap", i);
    }
  }

  return issues;
}

export function getOrdersTierStructureIssues(
  tiers: DeductionTier[] | null | undefined,
): TierStructureIssue[] {
  return collectTierStructureIssues(tiers, MIN_DEDUCTION_TIERS, MAX_DEDUCTION_TIERS);
}

export function getRevenueTierStructureIssues(
  tiers: DeductionTier[] | null | undefined,
): TierStructureIssue[] {
  return collectTierStructureIssues(
    tiers,
    MIN_REVENUE_DEDUCTION_TIERS,
    MAX_REVENUE_DEDUCTION_TIERS,
  );
}

/**
 * Like {@link getDeficitTierStructureCellErrors} but revenue requires exactly eight contiguous bands.
 */
export function getRevenueTierStructureCellErrors(
  tiers: DeductionTier[] | null | undefined,
): { isValid: boolean; cells: TierCellErrorMap } {
  const cells: TierCellErrorMap = {};
  const mark = (i: number, k: TierFieldKey) => {
    cells[i] = { ...cells[i], [k]: true };
  };

  if (!tiers || tiers.length === 0) {
    return { isValid: false, cells };
  }

  if (
    tiers.length < MIN_REVENUE_DEDUCTION_TIERS ||
    tiers.length > MAX_REVENUE_DEDUCTION_TIERS
  ) {
    const sorted = sortTiersAscending(tiers);
    sorted.forEach((_, i) => {
      mark(i, "from");
      mark(i, "to");
    });
    return { isValid: false, cells };
  }

  const sorted = sortTiersAscending(tiers);
  let ok = true;

  for (let i = 0; i < sorted.length; i++) {
    const t = sorted[i];
    if (!isValidIntegerBound(t.from)) {
      mark(i, "from");
      ok = false;
    }
    if (!isValidIntegerBound(t.to)) {
      mark(i, "to");
      ok = false;
    }
    if (
      isValidIntegerBound(t.from) &&
      isValidIntegerBound(t.to) &&
      t.from > t.to
    ) {
      mark(i, "from");
      mark(i, "to");
      ok = false;
    }
  }

  if (sorted[0].from !== 1) {
    mark(0, "from");
    ok = false;
  }

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].from !== sorted[i - 1].to + 1) {
      mark(i, "from");
      mark(i - 1, "to");
      ok = false;
    }
  }

  return { isValid: ok, cells };
}

export function getOrdersTierCellErrors(
  tiers: DeductionTier[] | null | undefined,
): { isValid: boolean; cells: TierCellErrorMap } {
  const s = getDeficitTierStructureCellErrors(tiers);
  if (!tiers?.length) {
    return { isValid: false, cells: s.cells };
  }
  const sorted = sortTiersAscending(tiers);
  const cells: TierCellErrorMap = { ...s.cells };
  const mark = (i: number, k: TierFieldKey) => {
    cells[i] = { ...cells[i], [k]: true };
  };
  let dedOk = true;
  for (let i = 0; i < sorted.length; i++) {
    const d = sorted[i].deduction;
    if (!Number.isFinite(d) || d < 0) {
      mark(i, "deduction");
      dedOk = false;
    }
  }
  return { isValid: s.isValid && dedOk, cells };
}

/**
 * When `unitAmount` is positive, validates tiers like orders. When unit is missing/zero,
 * tier rows are not required (save may clear revenue). Invalid numeric unit (e.g. negative) sets `unitFieldInvalid`.
 */
export function getRevenueTiersCellErrors(
  tiers: DeductionTier[] | null | undefined,
  unitAmount: number | null | undefined,
): { isValid: boolean; cells: TierCellErrorMap; unitFieldInvalid: boolean } {
  const hasPositiveUnit =
    unitAmount != null &&
    Number.isFinite(unitAmount) &&
    unitAmount > 0;

  if (!hasPositiveUnit) {
    const unitBad =
      unitAmount != null &&
      (!Number.isFinite(unitAmount) || unitAmount < 0);
    return {
      isValid: !unitBad,
      cells: {},
      unitFieldInvalid: unitBad,
    };
  }

  const s = getRevenueTierStructureCellErrors(tiers);
  if (!tiers?.length) {
    return { isValid: false, cells: s.cells, unitFieldInvalid: false };
  }
  const sorted = sortTiersAscending(tiers);
  const cells: TierCellErrorMap = { ...s.cells };
  const mark = (i: number, k: TierFieldKey) => {
    cells[i] = { ...cells[i], [k]: true };
  };
  let dedOk = true;
  for (let i = 0; i < sorted.length; i++) {
    const d = sorted[i].deduction;
    if (!Number.isFinite(d) || d < 0) {
      mark(i, "deduction");
      dedOk = false;
    }
  }
  return { isValid: s.isValid && dedOk, cells, unitFieldInvalid: false };
}

export function ensureOrdersTiers(
  tiers: DeductionTier[] | null | undefined,
): DeductionTier[] {
  if (tiers && tiers.length > 0) {
    return sortTiersAscending(tiers);
  }
  return LEGACY_DEFAULT_ORDERS_TIERS.map((t) => ({ ...t }));
}

export function getDefaultRevenueTiers(): DeductionTier[] {
  return [
    { from: 1, to: 800, deduction: 9 },
    { from: 801, to: 1600, deduction: 8 },
    { from: 1601, to: 2400, deduction: 7 },
    { from: 2401, to: 3200, deduction: 6 },
    { from: 3201, to: 4000, deduction: 5 },
  ];
}

export function ensureRevenueTiers(
  tiers: DeductionTier[] | null | undefined,
  unitAmount: number,
): DeductionTier[] {
  if (tiers && tiers.length > 0) {
    return sortTiersAscending(tiers);
  }
  if (!unitAmount || unitAmount <= 0) {
    return [];
  }
  return getDefaultRevenueTiers();
}

export function generateEqualRevenueBands(
  unitAmount: number,
  count: number,
): DeductionTier[] {
  const n = Math.min(Math.max(1, count), MAX_DEDUCTION_TIERS);
  return Array.from({ length: n }, (_, i) => ({
    from: i * unitAmount + 1,
    to: (i + 1) * unitAmount,
    deduction: 0,
  }));
}

/** Append one tier after the current last band (width 1). */
export function appendTierAfter(
  tiers: DeductionTier[],
): DeductionTier[] | null {
  const sorted = sortTiersAscending(tiers);
  if (sorted.length >= MAX_DEDUCTION_TIERS) {
    return null;
  }
  const last = sorted[sorted.length - 1];
  const nextFrom = last.to + 1;
  return [...sorted, { from: nextFrom, to: nextFrom, deduction: 0 }];
}

/** Remove the tier with the largest `to` and extend the new last tier through that `to`. */
export function removeLastAscendingTier(
  tiers: DeductionTier[],
): DeductionTier[] | null {
  const sorted = sortTiersAscending(tiers);
  if (sorted.length <= MIN_DEDUCTION_TIERS) {
    return null;
  }
  const removed = sorted[sorted.length - 1];
  const rest = sorted.slice(0, -1);
  const prev = rest[rest.length - 1];
  rest[rest.length - 1] = { ...prev, to: removed.to };
  return propagateContiguousFromBoundaries(rest);
}

/**
 * Remove one tier at `ascIndex` (ascending order) by merging its range into an adjacent band.
 * Keeps at least {@link MIN_DEDUCTION_TIERS} rows.
 */
export function removeTierAtAscendingIndex(
  tiers: DeductionTier[],
  ascIndex: number,
): DeductionTier[] | null {
  const s = sortTiersAscending(tiers.map((t) => ({ ...t })));
  if (s.length <= MIN_DEDUCTION_TIERS) {
    return null;
  }
  if (ascIndex < 0 || ascIndex >= s.length) {
    return null;
  }

  if (ascIndex === 0) {
    const merged: DeductionTier = {
      from: 1,
      to: s[1].to,
      deduction: s[0].deduction,
    };
    const rest = s.slice(2);
    return propagateContiguousFromBoundaries([merged, ...rest]);
  }

  const out = s.slice();
  out[ascIndex - 1] = { ...out[ascIndex - 1], to: out[ascIndex].to };
  out.splice(ascIndex, 1);
  return propagateContiguousFromBoundaries(out);
}

type ProgressiveUnitLine = {
  from: number;
  to: number | "infinity";
  applicableAmount: number;
  unitAmount: number;
  units: number;
  deductionPerUnit: number;
  tierDeduction: number;
  beyondDefined: boolean;
};

/** Sequential top-down: consume shortfall from highest band first; lines in descending `from` order. */
export function computeRevenueProgressiveUnitLines(
  deficit: number,
  tiers: DeductionTier[],
  unitAmount: number,
): { total: number; lines: ProgressiveUnitLine[] } {
  if (deficit <= 0 || tiers.length === 0 || unitAmount <= 0) {
    return { total: 0, lines: [] };
  }

  const sortedAsc = sortTiersAscending(tiers);
  const sortedDesc = sortTiersDescending(tiers);
  const strictest = sortedAsc[0];
  let remaining = deficit;
  let total = 0;
  const lines: ProgressiveUnitLine[] = [];

  for (const tier of sortedDesc) {
    if (remaining <= 0) break;
    const tierWidth = tier.to - tier.from + 1;
    const applicableAmount = Math.min(remaining, tierWidth);
    const units = applicableAmount / unitAmount;
    const tierDeduction = units * tier.deduction;
    total += tierDeduction;
    remaining -= applicableAmount;

    lines.push({
      from: tier.from,
      to: tier.to,
      applicableAmount,
      unitAmount,
      units,
      deductionPerUnit: tier.deduction,
      tierDeduction,
      beyondDefined: false,
    });
  }

  if (remaining > 0 && strictest) {
    const units = remaining / unitAmount;
    const tierDeduction = units * strictest.deduction;
    total += tierDeduction;

    lines.push({
      from: strictest.from,
      to: "infinity",
      applicableAmount: remaining,
      unitAmount,
      units,
      deductionPerUnit: strictest.deduction,
      tierDeduction,
      beyondDefined: true,
    });
  }

  return { total, lines };
}
