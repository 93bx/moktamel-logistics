import {
  getKSAMonthBounds,
  getKSAMonthIdentifier,
  getCurrentKSAMonth,
} from './ksa-month';

describe('KSA Month Utilities', () => {
  describe('getKSAMonthBounds', () => {
    it('should return correct bounds for January 2024', () => {
      const { start, end } = getKSAMonthBounds(2024, 1);

      // January 1, 2024 00:00:00 KSA = Dec 31, 2023 21:00:00 UTC
      expect(start.toISOString()).toBe('2023-12-31T21:00:00.000Z');

      // January 31, 2024 23:59:59.999 KSA = Jan 31, 2024 20:59:59.999 UTC
      expect(end.toISOString()).toBe('2024-01-31T20:59:59.999Z');
    });

    it('should return correct bounds for February 2024 (leap year)', () => {
      const { start, end } = getKSAMonthBounds(2024, 2);

      // February 1, 2024 00:00:00 KSA = Jan 31, 2024 21:00:00 UTC
      expect(start.toISOString()).toBe('2024-01-31T21:00:00.000Z');

      // February 29, 2024 23:59:59.999 KSA (leap year)
      expect(end.toISOString()).toBe('2024-02-29T20:59:59.999Z');
    });

    it('should return correct bounds for February 2023 (non-leap year)', () => {
      const { start, end } = getKSAMonthBounds(2023, 2);

      expect(start.toISOString()).toBe('2023-01-31T21:00:00.000Z');
      // February 28, 2023 23:59:59.999 KSA (non-leap year)
      expect(end.toISOString()).toBe('2023-02-28T20:59:59.999Z');
    });

    it('should return correct bounds for December 2024 (year boundary)', () => {
      const { start, end } = getKSAMonthBounds(2024, 12);

      // December 1, 2024 00:00:00 KSA
      expect(start.toISOString()).toBe('2024-11-30T21:00:00.000Z');

      // December 31, 2024 23:59:59.999 KSA
      expect(end.toISOString()).toBe('2024-12-31T20:59:59.999Z');
    });

    it('should return correct bounds for March 2024', () => {
      const { start, end } = getKSAMonthBounds(2024, 3);

      // March 1, 2024 00:00:00 KSA
      expect(start.toISOString()).toBe('2024-02-29T21:00:00.000Z');

      // March 31, 2024 23:59:59.999 KSA
      expect(end.toISOString()).toBe('2024-03-31T20:59:59.999Z');
    });

    it('should throw error for invalid month (0)', () => {
      expect(() => getKSAMonthBounds(2024, 0)).toThrow('Invalid month');
    });

    it('should throw error for invalid month (13)', () => {
      expect(() => getKSAMonthBounds(2024, 13)).toThrow('Invalid month');
    });

    it('should throw error for invalid month (-1)', () => {
      expect(() => getKSAMonthBounds(2024, -1)).toThrow('Invalid month');
    });

    it('should handle year boundaries correctly', () => {
      const dec2023 = getKSAMonthBounds(2023, 12);
      const jan2024 = getKSAMonthBounds(2024, 1);

      // December end should be before January start
      expect(dec2023.end.getTime()).toBeLessThan(jan2024.start.getTime());

      // They should be consecutive (no gap, no overlap)
      const gapMs = jan2024.start.getTime() - dec2023.end.getTime();
      expect(gapMs).toBe(1); // 1 millisecond gap
    });
  });

  describe('getKSAMonthIdentifier', () => {
    it('should return the start instant as identifier', () => {
      const identifier = getKSAMonthIdentifier(2024, 3);
      const { start } = getKSAMonthBounds(2024, 3);

      expect(identifier.getTime()).toBe(start.getTime());
    });

    it('should return consistent identifiers for same month', () => {
      const id1 = getKSAMonthIdentifier(2024, 6);
      const id2 = getKSAMonthIdentifier(2024, 6);

      expect(id1.getTime()).toBe(id2.getTime());
    });

    it('should return different identifiers for different months', () => {
      const jan = getKSAMonthIdentifier(2024, 1);
      const feb = getKSAMonthIdentifier(2024, 2);

      expect(jan.getTime()).not.toBe(feb.getTime());
    });
  });

  describe('getCurrentKSAMonth', () => {
    it('should return a valid month object', () => {
      const { year, month } = getCurrentKSAMonth();

      expect(typeof year).toBe('number');
      expect(typeof month).toBe('number');
      expect(year).toBeGreaterThan(2020);
      expect(year).toBeLessThan(2100);
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
    });

    it('should account for KSA timezone offset', () => {
      // Mock a UTC time that's late in the day (e.g., 22:00 UTC)
      // In KSA (UTC+3), this would be 01:00 the next day
      const mockDate = new Date('2024-03-31T22:00:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation(() => mockDate as any);

      const { year, month } = getCurrentKSAMonth();

      // At 22:00 UTC on March 31, it's April 1 in KSA
      expect(year).toBe(2024);
      expect(month).toBe(4);

      jest.restoreAllMocks();
    });
  });

  describe('Integration: bounds should cover entire month without gaps', () => {
    it('should have consecutive months with no gaps', () => {
      const months = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

      for (let i = 0; i < months.length - 1; i++) {
        const current = getKSAMonthBounds(2024, months[i]);
        const next = getKSAMonthBounds(2024, months[i + 1]);

        const gapMs = next.start.getTime() - current.end.getTime();
        expect(gapMs).toBe(1); // Exactly 1ms gap (end is inclusive to .999)
      }
    });

    it('should span exactly the right number of days', () => {
      const { start, end } = getKSAMonthBounds(2024, 1);
      const durationMs = end.getTime() - start.getTime() + 1; // +1 because end is inclusive
      const durationDays = durationMs / (1000 * 60 * 60 * 24);

      // January has 31 days
      expect(Math.round(durationDays)).toBe(31);
    });
  });
});
