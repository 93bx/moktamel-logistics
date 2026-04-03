import { SalariesPayrollCalculationService } from './salaries-payroll.calculation.service';
import { CalculationInput } from './salaries-payroll.calculation.service';

describe('SalariesPayrollCalculationService', () => {
  let service: SalariesPayrollCalculationService;

  beforeEach(() => {
    service = new SalariesPayrollCalculationService();
  });

  describe('Orders-based target with Fixed Deduction', () => {
    it('should apply no deduction when target is met', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 100,
        monthlyRevenueTarget: 0,
        ordersCount: 100,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_FIXED',
        ordersTiers: [],
        revenueTiers: [],
        deductionPerOrder: 10,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      expect(result.totalDeductions).toBe(0);
      expect(result.salaryAfterDeductions).toBe(3000);
    });

    it('should apply fixed deduction when target is missed', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 100,
        monthlyRevenueTarget: 0,
        ordersCount: 90,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_FIXED',
        ordersTiers: [],
        revenueTiers: [],
        deductionPerOrder: 10,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Missing 10 orders * 10 SAR = 100 SAR deduction
      expect(result.totalDeductions).toBe(100);
      expect(result.salaryAfterDeductions).toBe(2900);
    });

    it('should not deduct more than base salary', () => {
      const input: CalculationInput = {
        baseSalary: 500,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 100,
        monthlyRevenueTarget: 0,
        ordersCount: 0,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_FIXED',
        ordersTiers: [],
        revenueTiers: [],
        deductionPerOrder: 10,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Missing 100 orders * 10 SAR = 1000 SAR deduction, salary floored at 0
      expect(result.totalDeductions).toBe(1000);
      expect(result.salaryAfterDeductions).toBe(0);
    });
  });

  describe('Orders-based target with Orders Tiers', () => {
    const ordersTiers = [
      { from: 1, to: 10, deduction: 5 },
      { from: 11, to: 20, deduction: 10 },
      { from: 21, to: 50, deduction: 15 },
    ];

    it('should apply no deduction when target is met', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 100,
        monthlyRevenueTarget: 0,
        ordersCount: 100,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_ORDERS_TIERS',
        ordersTiers,
        revenueTiers: [],
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      expect(result.totalDeductions).toBe(0);
      expect(result.salaryAfterDeductions).toBe(3000);
    });

    it('should apply tier 1 deduction for small gap', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 100,
        monthlyRevenueTarget: 0,
        ordersCount: 95,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_ORDERS_TIERS',
        ordersTiers,
        revenueTiers: [],
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Missing 5 orders, falls in tier 1 (1-10): 5 SAR deduction
      expect(result.totalDeductions).toBe(5);
      expect(result.salaryAfterDeductions).toBe(2995);
    });

    it('should apply tier 2 deduction for medium gap', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 100,
        monthlyRevenueTarget: 0,
        ordersCount: 85,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_ORDERS_TIERS',
        ordersTiers,
        revenueTiers: [],
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Missing 15 orders, falls in tier 2 (11-20): 10 SAR deduction
      expect(result.totalDeductions).toBe(10);
      expect(result.salaryAfterDeductions).toBe(2990);
    });

    it('should apply tier 3 deduction for large gap', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 100,
        monthlyRevenueTarget: 0,
        ordersCount: 70,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_ORDERS_TIERS',
        ordersTiers,
        revenueTiers: [],
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Missing 30 orders, falls in tier 3 (21-50): 15 SAR deduction
      expect(result.totalDeductions).toBe(15);
      expect(result.salaryAfterDeductions).toBe(2985);
    });

    it('should apply highest tier for gap beyond tiers', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 100,
        monthlyRevenueTarget: 0,
        ordersCount: 0,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_ORDERS_TIERS',
        ordersTiers,
        revenueTiers: [],
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Missing 100 orders, beyond tier 3, use highest tier: 15 SAR deduction
      expect(result.totalDeductions).toBe(15);
      expect(result.salaryAfterDeductions).toBe(2985);
    });
  });

  describe('Revenue-based target with Revenue Tiers', () => {
    const revenueTiers = [
      { from: 1, to: 500, deduction: 50 },
      { from: 501, to: 1000, deduction: 100 },
      { from: 1001, to: 2000, deduction: 150 },
    ];

    it('should apply no deduction when revenue target is met', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_REVENUE',
        monthlyOrdersTarget: 0,
        monthlyRevenueTarget: 5000,
        ordersCount: 0,
        totalRevenue: 5000,
        workingDays: 30,
        deductionType: 'DEDUCTION_REVENUE_TIERS',
        ordersTiers: [],
        revenueTiers,
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      expect(result.totalDeductions).toBe(0);
      expect(result.salaryAfterDeductions).toBe(3000);
    });

    it('should apply tier 1 deduction for small revenue gap', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_REVENUE',
        monthlyOrdersTarget: 0,
        monthlyRevenueTarget: 5000,
        ordersCount: 0,
        totalRevenue: 4700,
        workingDays: 30,
        deductionType: 'DEDUCTION_REVENUE_TIERS',
        ordersTiers: [],
        revenueTiers,
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Missing 300 SAR, falls in tier 1 (1-500): 50 SAR deduction
      expect(result.totalDeductions).toBe(50);
      expect(result.salaryAfterDeductions).toBe(2950);
    });

    it('should apply tier 2 deduction for medium revenue gap', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_REVENUE',
        monthlyOrdersTarget: 0,
        monthlyRevenueTarget: 5000,
        ordersCount: 0,
        totalRevenue: 4200,
        workingDays: 30,
        deductionType: 'DEDUCTION_REVENUE_TIERS',
        ordersTiers: [],
        revenueTiers,
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Missing 800 SAR, falls in tier 2 (501-1000): 100 SAR deduction
      expect(result.totalDeductions).toBe(100);
      expect(result.salaryAfterDeductions).toBe(2900);
    });

    it('should apply tier 3 deduction for large revenue gap', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_REVENUE',
        monthlyOrdersTarget: 0,
        monthlyRevenueTarget: 5000,
        ordersCount: 0,
        totalRevenue: 3500,
        workingDays: 30,
        deductionType: 'DEDUCTION_REVENUE_TIERS',
        ordersTiers: [],
        revenueTiers,
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Missing 1500 SAR, falls in tier 3 (1001-2000): 150 SAR deduction
      expect(result.totalDeductions).toBe(150);
      expect(result.salaryAfterDeductions).toBe(2850);
    });

    it('should apply highest tier for revenue gap beyond tiers', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_REVENUE',
        monthlyOrdersTarget: 0,
        monthlyRevenueTarget: 5000,
        ordersCount: 0,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_REVENUE_TIERS',
        ordersTiers: [],
        revenueTiers,
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Missing 5000 SAR, beyond tier 3, use highest tier: 150 SAR deduction
      expect(result.totalDeductions).toBe(150);
      expect(result.salaryAfterDeductions).toBe(2850);
    });
  });

  describe('Complex scenarios with bonuses and loan installments', () => {
    it('should add bonuses and subtract loan installments', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 100,
        monthlyRevenueTarget: 0,
        ordersCount: 100,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_FIXED',
        ordersTiers: [],
        revenueTiers: [],
        deductionPerOrder: 0,
        scheduledLoanInstallments: 200,
        totalBonus: 300,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Base: 3000, Bonus: +300, Loan: -200 = 3100
      expect(result.salaryAfterDeductions).toBe(3100);
    });

    it('should apply deduction, bonus, and loan together', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 100,
        monthlyRevenueTarget: 0,
        ordersCount: 90,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_FIXED',
        ordersTiers: [],
        revenueTiers: [],
        deductionPerOrder: 10,
        scheduledLoanInstallments: 200,
        totalBonus: 300,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Base: 3000, Deduction: -100, Bonus: +300, Loan: -200 = 3000
      expect(result.totalDeductions).toBe(100);
      expect(result.salaryAfterDeductions).toBe(3000);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero base salary', () => {
      const input: CalculationInput = {
        baseSalary: 0,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 100,
        monthlyRevenueTarget: 0,
        ordersCount: 90,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_FIXED',
        ordersTiers: [],
        revenueTiers: [],
        deductionPerOrder: 10,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Deduction still calculated even with zero base, but salary floored at 0
      expect(result.totalDeductions).toBe(100);
      expect(result.salaryAfterDeductions).toBe(0);
    });

    it('should handle exceeding target (bonus scenario)', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 100,
        monthlyRevenueTarget: 0,
        ordersCount: 120,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_FIXED',
        ordersTiers: [],
        revenueTiers: [],
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // No deduction when target is exceeded
      expect(result.totalDeductions).toBe(0);
      expect(result.salaryAfterDeductions).toBe(3000);
    });

    it('should handle empty tiers gracefully', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 100,
        monthlyRevenueTarget: 0,
        ordersCount: 90,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_ORDERS_TIERS',
        ordersTiers: [],
        revenueTiers: [],
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // No tiers defined, so no deduction
      expect(result.totalDeductions).toBe(0);
      expect(result.salaryAfterDeductions).toBe(3000);
    });
  });

  describe('Target type matrix', () => {
    it('should use orders count when target type is orders', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 100,
        monthlyRevenueTarget: 5000,
        ordersCount: 90,
        totalRevenue: 6000,
        workingDays: 30,
        deductionType: 'DEDUCTION_FIXED',
        ordersTiers: [],
        revenueTiers: [],
        deductionPerOrder: 10,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Should use orders (90 vs 100), not revenue (6000 vs 5000)
      expect(result.totalDeductions).toBe(100);
    });

    it('should use revenue when target type is revenue', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_REVENUE',
        monthlyOrdersTarget: 100,
        monthlyRevenueTarget: 5000,
        ordersCount: 120,
        totalRevenue: 4000,
        workingDays: 30,
        deductionType: 'DEDUCTION_REVENUE_TIERS',
        ordersTiers: [],
        revenueTiers: [{ from: 1, to: 2000, deduction: 200 }],
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Should use revenue (4000 vs 5000), not orders (120 vs 100)
      expect(result.totalDeductions).toBe(200);
    });
  });

  describe('Deduction type matrix', () => {
    it('should use fixed deduction when type is DEDUCTION_FIXED', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 100,
        monthlyRevenueTarget: 0,
        ordersCount: 90,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_FIXED',
        ordersTiers: [{ from: 1, to: 20, deduction: 500 }],
        revenueTiers: [],
        deductionPerOrder: 10,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Should use fixed (10 * 10 = 100), not tiers (500)
      expect(result.totalDeductions).toBe(100);
    });

    it('should use orders tiers when type is DEDUCTION_ORDERS_TIERS', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 100,
        monthlyRevenueTarget: 0,
        ordersCount: 90,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_ORDERS_TIERS',
        ordersTiers: [{ from: 1, to: 20, deduction: 500 }],
        revenueTiers: [],
        deductionPerOrder: 10,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Should use tiers (500), not fixed (100)
      expect(result.totalDeductions).toBe(500);
    });

    it('should use revenue tiers when type is DEDUCTION_REVENUE_TIERS', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_REVENUE',
        monthlyOrdersTarget: 0,
        monthlyRevenueTarget: 5000,
        ordersCount: 0,
        totalRevenue: 4000,
        workingDays: 30,
        deductionType: 'DEDUCTION_REVENUE_TIERS',
        ordersTiers: [],
        revenueTiers: [{ from: 1, to: 2000, deduction: 200 }],
        deductionPerOrder: 10,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Should use revenue tiers (200), not fixed
      expect(result.totalDeductions).toBe(200);
    });
  });
});
