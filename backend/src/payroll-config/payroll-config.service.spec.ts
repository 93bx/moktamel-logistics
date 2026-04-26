import { getDefaultRevenueTiers } from '../common/payroll-tier-constants';
import { PayrollConfigService } from './payroll-config.service';

describe('PayrollConfigService', () => {
  it('treats Decimal-like revenue_unit_amount as valid number in configuration status', () => {
    const service = new PayrollConfigService({} as any, {} as any, {} as any);

    const status = (service as any).checkConfigurationStatus({
      minimum_salary: 1000,
      tip_recipient: 'REPRESENTATIVE',
      count_bonus_enabled: false,
      count_bonus_amount: null,
      revenue_bonus_enabled: false,
      revenue_bonus_amount: null,
      deduction_per_order: 1,
      orders_deduction_tiers: [
        { from: 1, to: 10, deduction: 1 },
        { from: 11, to: 20, deduction: 1 },
        { from: 21, to: 30, deduction: 1 },
      ],
      revenue_deduction_tiers: getDefaultRevenueTiers(),
      revenue_unit_amount: {
        valueOf: () => '16',
        toString: () => '16',
      },
    });

    expect(status.revenueTiers).toBe('COMPLETE');
  });
});
