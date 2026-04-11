import { computeConfigBonuses } from './payroll-generation.helpers';

describe('computeConfigBonuses', () => {
  const snapshot = {
    count_bonus_enabled: true,
    count_bonus_amount: 100,
    revenue_bonus_enabled: true,
    revenue_bonus_amount: 200,
  };

  it('adds count bonus when orders target is met', () => {
    expect(
      computeConfigBonuses(
        snapshot,
        'TARGET_TYPE_ORDERS',
        100,
        0,
        100,
        0,
      ),
    ).toBe(100);
  });

  it('adds revenue bonus when revenue target is met', () => {
    expect(
      computeConfigBonuses(
        snapshot,
        'TARGET_TYPE_REVENUE',
        0,
        5000,
        0,
        5000,
      ),
    ).toBe(200);
  });

  it('returns 0 when targets not met', () => {
    expect(
      computeConfigBonuses(
        snapshot,
        'TARGET_TYPE_ORDERS',
        50,
        0,
        100,
        0,
      ),
    ).toBe(0);
  });
});
