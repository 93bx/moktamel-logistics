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

      // Progressive: 5 orders in tier 1 (rate 5) → 5 × 5 = 25
      expect(result.totalDeductions).toBe(25);
      expect(result.salaryAfterDeductions).toBe(2975);
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

      // Progressive: tier1 10×5=50 + tier2 5×10=50 = 100
      expect(result.totalDeductions).toBe(100);
      expect(result.salaryAfterDeductions).toBe(2900);
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

      // Progressive: 10×5 + 10×10 + 10×15 = 300
      expect(result.totalDeductions).toBe(300);
      expect(result.salaryAfterDeductions).toBe(2700);
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

      // Progressive through tiers then excess at last rate: 50+100+450+50×15 = 1350
      expect(result.totalDeductions).toBe(1350);
      expect(result.salaryAfterDeductions).toBe(1650);
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

      // Flat bands (unit 500): first band 50 + second band (partial) 100 = 150
      expect(result.totalDeductions).toBe(150);
      expect(result.salaryAfterDeductions).toBe(2850);
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

      // Flat bands: 500→50 + 500→100 + 500→150 = 300
      expect(result.totalDeductions).toBe(300);
      expect(result.salaryAfterDeductions).toBe(2700);
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

      // Flat bands: 500+500+1000 of defined tiers then 6×500 at last flat 150 → 1200
      expect(result.totalDeductions).toBe(1200);
      expect(result.salaryAfterDeductions).toBe(1800);
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

      // Progressive orders tiers: 10 missing × rate 500 = 5000 (not fixed 100)
      expect(result.totalDeductions).toBe(5000);
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

  describe('Progressive Stacking - Orders (New Behavior)', () => {
    const progressiveOrdersTiers = [
      { from: 1, to: 50, deduction: 5 },
      { from: 51, to: 100, deduction: 6 },
      { from: 101, to: 150, deduction: 7 },
      { from: 151, to: 200, deduction: 8 },
      { from: 201, to: 250, deduction: 9 },
    ];

    it('should apply progressive stacking for 165 missing orders (user example)', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 400,
        monthlyRevenueTarget: 0,
        ordersCount: 235,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_ORDERS_TIERS',
        ordersTiers: progressiveOrdersTiers,
        revenueTiers: [],
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Missing: 165 orders
      // Tier 1 (1-50): 50 orders × 5 = 250
      // Tier 2 (51-100): 50 orders × 6 = 300
      // Tier 3 (101-150): 50 orders × 7 = 350
      // Tier 4 (151-200): 15 orders × 8 = 120
      // Total: 250 + 300 + 350 + 120 = 1020
      expect(result.totalDeductions).toBe(1020);
      expect(result.targetDifference).toBe(-165);
    });

    it('should handle deficit within first tier only', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 100,
        monthlyRevenueTarget: 0,
        ordersCount: 75,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_ORDERS_TIERS',
        ordersTiers: progressiveOrdersTiers,
        revenueTiers: [],
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Missing: 25 orders (all in tier 1)
      // Tier 1 (1-50): 25 orders × 5 = 125
      expect(result.totalDeductions).toBe(125);
    });

    it('should handle deficit spanning exactly two tiers', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 150,
        monthlyRevenueTarget: 0,
        ordersCount: 50,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_ORDERS_TIERS',
        ordersTiers: progressiveOrdersTiers,
        revenueTiers: [],
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Missing: 100 orders
      // Tier 1 (1-50): 50 orders × 5 = 250
      // Tier 2 (51-100): 50 orders × 6 = 300
      // Total: 550
      expect(result.totalDeductions).toBe(550);
    });

    it('should handle deficit exceeding all tiers (use last tier rate)', () => {
      const input: CalculationInput = {
        baseSalary: 5000,
        targetType: 'TARGET_TYPE_ORDERS',
        monthlyOrdersTarget: 500,
        monthlyRevenueTarget: 0,
        ordersCount: 200,
        totalRevenue: 0,
        workingDays: 30,
        deductionType: 'DEDUCTION_ORDERS_TIERS',
        ordersTiers: progressiveOrdersTiers,
        revenueTiers: [],
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);

      // Missing: 300 orders
      // Tier 1 (1-50): 50 × 5 = 250
      // Tier 2 (51-100): 50 × 6 = 300
      // Tier 3 (101-150): 50 × 7 = 350
      // Tier 4 (151-200): 50 × 8 = 400
      // Tier 5 (201-250): 50 × 9 = 450
      // Excess (251-300): 50 × 9 (last tier rate) = 450
      // Total: 250 + 300 + 350 + 400 + 450 + 450 = 2200
      expect(result.totalDeductions).toBe(2200);
    });
  });

  describe('Revenue deficit — flat deduction per SAR band crossed (9 tiers)', () => {
    const unit = 800;
    const nineTiersExample = [
      { from: 1, to: 800, deduction: 100 },
      { from: 801, to: 1600, deduction: 150 },
      { from: 1601, to: 2400, deduction: 200 },
      { from: 2401, to: 3200, deduction: 250 },
      { from: 3201, to: 4000, deduction: 300 },
      { from: 4001, to: 4800, deduction: 350 },
      { from: 4801, to: 5600, deduction: 400 },
      { from: 5601, to: 6400, deduction: 450 },
      { from: 6401, to: 7200, deduction: 500 },
    ];

    it('matches product example (3000 SAR deficit → 700)', () => {
      const input: CalculationInput = {
        baseSalary: 5000,
        targetType: 'TARGET_TYPE_REVENUE',
        monthlyOrdersTarget: 0,
        monthlyRevenueTarget: 10000,
        ordersCount: 0,
        totalRevenue: 7000,
        workingDays: 30,
        deductionType: 'DEDUCTION_REVENUE_TIERS',
        ordersTiers: [],
        revenueTiers: nineTiersExample,
        revenueUnitAmount: unit,
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);
      expect(result.totalDeductions).toBe(700);
    });

    it('applies first band flat only for partial first band (350 SAR deficit)', () => {
      const input: CalculationInput = {
        baseSalary: 3000,
        targetType: 'TARGET_TYPE_REVENUE',
        monthlyOrdersTarget: 0,
        monthlyRevenueTarget: 5000,
        ordersCount: 0,
        totalRevenue: 4650,
        workingDays: 30,
        deductionType: 'DEDUCTION_REVENUE_TIERS',
        ordersTiers: [],
        revenueTiers: nineTiersExample,
        revenueUnitAmount: unit,
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);
      expect(result.totalDeductions).toBe(100);
    });

    it('sums flat amounts across multiple bands (1200 deficit, 500 SAR unit, 9 tiers)', () => {
      const u = 500;
      const tiers = Array.from({ length: 9 }, (_, i) => ({
        from: i * u + 1,
        to: (i + 1) * u,
        deduction: 10 * (i + 1),
      }));
      const input: CalculationInput = {
        baseSalary: 5000,
        targetType: 'TARGET_TYPE_REVENUE',
        monthlyOrdersTarget: 0,
        monthlyRevenueTarget: 10000,
        ordersCount: 0,
        totalRevenue: 8800,
        workingDays: 30,
        deductionType: 'DEDUCTION_REVENUE_TIERS',
        ordersTiers: [],
        revenueTiers: tiers,
        revenueUnitAmount: u,
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);
      // 1200 deficit: 500+500+200 → tiers 10+20+30 = 60
      expect(result.totalDeductions).toBe(60);
    });

    it('uses last tier flat for each extra band after the 9th', () => {
      const input: CalculationInput = {
        baseSalary: 20000,
        targetType: 'TARGET_TYPE_REVENUE',
        monthlyOrdersTarget: 0,
        monthlyRevenueTarget: 50000,
        ordersCount: 0,
        totalRevenue: 40000,
        workingDays: 30,
        deductionType: 'DEDUCTION_REVENUE_TIERS',
        ordersTiers: [],
        revenueTiers: nineTiersExample,
        revenueUnitAmount: unit,
        deductionPerOrder: 0,
        scheduledLoanInstallments: 0,
        totalBonus: 0,
        averageCost: 0,
      };

      const result = service.calculate(input);
      // deficit 10000: nine bands 2700 + four last-tier 500 = 4700
      expect(result.totalDeductions).toBe(4700);
    });
  });
});
