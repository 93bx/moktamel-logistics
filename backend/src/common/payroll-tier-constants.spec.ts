import {
  getDefaultRevenueTiers,
  validateDeficitTiersStructure,
  validateOrdersTiersStructure,
  validateRevenueBandsStructure,
  validateRevenueTiersStructure,
} from './payroll-tier-constants';

describe('payroll-tier-constants validation', () => {
  describe('validateDeficitTiersStructure', () => {
    it('accepts contiguous tiers from 1 (min 3 bands)', () => {
      expect(
        validateDeficitTiersStructure([
          { from: 1, to: 50, deduction: 0 },
          { from: 51, to: 100, deduction: 0 },
          { from: 101, to: 150, deduction: 0 },
        ]),
      ).toBe(true);
    });

    it('rejects fewer than 3 tiers', () => {
      expect(
        validateDeficitTiersStructure([
          { from: 1, to: 50, deduction: 0 },
          { from: 51, to: 100, deduction: 0 },
        ]),
      ).toBe(false);
    });

    it('rejects when not starting at 1', () => {
      expect(
        validateDeficitTiersStructure([
          { from: 2, to: 100, deduction: 0 },
        ]),
      ).toBe(false);
    });

    it('rejects gaps', () => {
      expect(
        validateDeficitTiersStructure([
          { from: 1, to: 50, deduction: 0 },
          { from: 52, to: 100, deduction: 0 },
          { from: 101, to: 150, deduction: 0 },
        ]),
      ).toBe(false);
    });

    it('rejects overlaps', () => {
      expect(
        validateDeficitTiersStructure([
          { from: 1, to: 60, deduction: 0 },
          { from: 50, to: 100, deduction: 0 },
          { from: 101, to: 150, deduction: 0 },
        ]),
      ).toBe(false);
    });

    it('rejects more than 9 tiers', () => {
      const tiers = Array.from({ length: 10 }, (_, i) => ({
        from: i * 10 + 1,
        to: (i + 1) * 10,
        deduction: 0,
      }));
      expect(validateDeficitTiersStructure(tiers)).toBe(false);
    });
  });

  describe('validateRevenueBandsStructure', () => {
    it('accepts one tier and up to eight tiers', () => {
      expect(
        validateRevenueBandsStructure([{ from: 1, to: 800, deduction: 9 }]),
      ).toBe(true);
      const eight = Array.from({ length: 8 }, (_, i) => ({
        from: i * 800 + 1,
        to: (i + 1) * 800,
        deduction: 9 - Math.min(i, 4),
      }));
      expect(validateRevenueBandsStructure(eight)).toBe(true);
    });

    it('rejects wrong tier count (zero or above eight)', () => {
      expect(validateRevenueBandsStructure([])).toBe(false);
      const nine = Array.from({ length: 9 }, (_, i) => ({
        from: i * 800 + 1,
        to: (i + 1) * 800,
        deduction: 1,
      }));
      expect(validateRevenueBandsStructure(nine)).toBe(false);
    });

    it('rejects gaps', () => {
      const t = getDefaultRevenueTiers();
      const bad = [...t];
      bad[1] = { ...bad[1], from: 802 };
      expect(validateRevenueBandsStructure(bad)).toBe(false);
    });
  });

  describe('validateRevenueTiersStructure', () => {
    const okTiers = getDefaultRevenueTiers();

    it('requires positive unit amount', () => {
      expect(validateRevenueTiersStructure(okTiers, null)).toBe(false);
      expect(validateRevenueTiersStructure(okTiers, 0)).toBe(false);
    });

    it('accepts valid contiguous bands + unit', () => {
      expect(validateRevenueTiersStructure(okTiers, 16)).toBe(true);
    });
  });

  describe('validateOrdersTiersStructure', () => {
    it('rejects negative deduction', () => {
      expect(
        validateOrdersTiersStructure([
          { from: 1, to: 10, deduction: -1 },
          { from: 11, to: 20, deduction: 0 },
          { from: 21, to: 30, deduction: 0 },
        ]),
      ).toBe(false);
    });
  });
});
