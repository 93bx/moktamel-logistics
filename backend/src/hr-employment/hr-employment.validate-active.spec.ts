import { BadRequestException } from '@nestjs/common';
import { HrEmploymentService } from './hr-employment.service';

describe('HrEmploymentService - validateActiveStatus', () => {
  let service: HrEmploymentService;
  let mockPrisma: any;
  let mockAudit: any;

  // Base valid employee data with all required fields
  const baseValidData = {
    status_code: 'EMPLOYMENT_STATUS_ACTIVE',
    full_name_ar: 'أحمد محمد',
    full_name_en: 'Ahmed Mohamed',
    nationality: 'Saudi',
    gender: 'Male',
    date_of_birth: '1990-01-01',
    marital_status: 'Single',
    passport_number: 'A1234567',
    passport_issue_date: '2020-01-01',
    passport_expiry_date: '2030-01-01',
    iqama_number: '1234567890',
    iqama_issue_date: '2020-01-01',
    iqama_expiry_date: '2030-01-01',
    border_number: 'B123456',
    border_issue_date: '2020-01-01',
    border_expiry_date: '2030-01-01',
    recruitment_date: '2020-01-01',
    job_title: 'Driver',
    salary_amount: 3000,
    target_type: 'TARGET_TYPE_ORDERS',
    monthly_orders_target: 100,
    target_deduction_type: 'DEDUCTION_FIXED',
  };

  beforeEach(() => {
    mockPrisma = {
      employmentRecord: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      company: {
        findUnique: jest.fn(),
      },
      payrollConfig: {
        findUnique: jest.fn().mockResolvedValue({
          minimum_salary: 400,
        }),
      },
    };
    mockAudit = {
      log: jest.fn(),
    };
    service = new HrEmploymentService(mockPrisma, mockAudit);
  });

  describe('Target Type validation', () => {
    it('should reject activation without target_type', async () => {
      const data = {
        ...baseValidData,
        target_type: undefined,
      };

      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow('HR_EMPLOYMENT_ACTIVE_TARGET_TYPE');
    });

    it('should reject orders target without monthly_orders_target', async () => {
      const data = {
        ...baseValidData,
        target_type: 'TARGET_TYPE_ORDERS',
        monthly_orders_target: undefined,
        target_deduction_type: 'DEDUCTION_FIXED',
      };

      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow('HR_EMPLOYMENT_ACTIVE_ORDERS_TARGET');
    });

    it('should reject revenue target without monthly_target_amount', async () => {
      const data = {
        ...baseValidData,
        target_type: 'TARGET_TYPE_REVENUE',
        monthly_orders_target: undefined,
        monthly_target_amount: undefined,
        target_deduction_type: 'DEDUCTION_REVENUE_TIERS',
      };

      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow('HR_EMPLOYMENT_ACTIVE_REVENUE_TARGET');
    });
  });

  describe('Target Deduction Type validation', () => {
    it('should reject activation without target_deduction_type', async () => {
      const data = {
        ...baseValidData,
        target_deduction_type: undefined,
      };

      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow('HR_EMPLOYMENT_ACTIVE_DEDUCTION_TYPE');
    });
  });

  describe('Consistency rules', () => {
    it('should enforce DEDUCTION_REVENUE_TIERS when target_type is REVENUE', async () => {
      const data = {
        ...baseValidData,
        target_type: 'TARGET_TYPE_REVENUE',
        monthly_orders_target: undefined,
        monthly_target_amount: 5000,
        target_deduction_type: 'DEDUCTION_FIXED', // Invalid for revenue
      };

      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow('HR_EMPLOYMENT_REVENUE_REQUIRES_REVENUE_TIERS');
    });

    it('should reject DEDUCTION_REVENUE_TIERS when target_type is ORDERS', async () => {
      const data = {
        ...baseValidData,
        target_type: 'TARGET_TYPE_ORDERS',
        monthly_orders_target: 100,
        target_deduction_type: 'DEDUCTION_REVENUE_TIERS', // Invalid for orders
      };

      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow('HR_EMPLOYMENT_ORDERS_CANNOT_USE_REVENUE_TIERS');
    });
  });

  describe('Valid combinations', () => {
    it('should accept orders target with DEDUCTION_FIXED', async () => {
      const data = {
        ...baseValidData,
        target_type: 'TARGET_TYPE_ORDERS',
        monthly_orders_target: 100,
        target_deduction_type: 'DEDUCTION_FIXED',
      };

      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).resolves.not.toThrow();
    });

    it('should accept orders target with DEDUCTION_ORDERS_TIERS', async () => {
      const data = {
        ...baseValidData,
        target_type: 'TARGET_TYPE_ORDERS',
        monthly_orders_target: 100,
        target_deduction_type: 'DEDUCTION_ORDERS_TIERS',
      };

      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).resolves.not.toThrow();
    });

    it('should accept revenue target with DEDUCTION_REVENUE_TIERS', async () => {
      const data = {
        ...baseValidData,
        target_type: 'TARGET_TYPE_REVENUE',
        monthly_orders_target: undefined,
        monthly_target_amount: 5000,
        target_deduction_type: 'DEDUCTION_REVENUE_TIERS',
      };

      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).resolves.not.toThrow();
    });
  });

  describe('Salary validation', () => {
    it('should reject salary below company minimum', async () => {
      const data = {
        ...baseValidData,
        salary_amount: 300, // Below minimum of 400
      };

      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow('HR_EMPLOYMENT_SALARY_BELOW_MINIMUM');
    });

    it('should accept salary at company minimum', async () => {
      const data = {
        ...baseValidData,
        salary_amount: 400, // At minimum
      };

      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).resolves.not.toThrow();
    });

    it('should accept salary above company minimum', async () => {
      const data = {
        ...baseValidData,
        salary_amount: 5000, // Above minimum
      };

      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).resolves.not.toThrow();
    });

    it('should use default minimum of 400 if not configured', async () => {
      mockPrisma.payrollConfig.findUnique.mockResolvedValue(null);

      const data = {
        ...baseValidData,
        salary_amount: 300, // Below default minimum
      };

      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow('HR_EMPLOYMENT_SALARY_BELOW_MINIMUM');
    });
  });

  describe('Edge cases', () => {
    it('should handle null target values gracefully', async () => {
      const data = {
        ...baseValidData,
        monthly_orders_target: null, // Null instead of missing
      };

      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle zero target values', async () => {
      const data = {
        ...baseValidData,
        monthly_orders_target: 0, // Zero target
      };

      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow('HR_EMPLOYMENT_ACTIVE_ORDERS_TARGET');
    });

    it('should handle negative target values', async () => {
      const data = {
        ...baseValidData,
        monthly_orders_target: -10, // Negative target
      };

      await expect(
        service['validateActiveStatus'](data as any, 'c1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('Matrix of all valid combinations', () => {
    const validCombinations = [
      {
        name: 'Orders + Fixed',
        target_type: 'TARGET_TYPE_ORDERS',
        monthly_orders_target: 100,
        target_deduction_type: 'DEDUCTION_FIXED',
      },
      {
        name: 'Orders + Orders Tiers',
        target_type: 'TARGET_TYPE_ORDERS',
        monthly_orders_target: 100,
        target_deduction_type: 'DEDUCTION_ORDERS_TIERS',
      },
      {
        name: 'Revenue + Revenue Tiers',
        target_type: 'TARGET_TYPE_REVENUE',
        monthly_orders_target: undefined,
        monthly_target_amount: 5000,
        target_deduction_type: 'DEDUCTION_REVENUE_TIERS',
      },
    ];

    validCombinations.forEach((combo) => {
      it(`should accept ${combo.name}`, async () => {
        const data = {
          ...baseValidData,
          ...combo,
        };

        await expect(
          service['validateActiveStatus'](data as any, 'c1'),
        ).resolves.not.toThrow();
      });
    });

    const invalidCombinations = [
      {
        name: 'Orders + Revenue Tiers',
        target_type: 'TARGET_TYPE_ORDERS',
        monthly_orders_target: 100,
        target_deduction_type: 'DEDUCTION_REVENUE_TIERS',
        expectedError: 'HR_EMPLOYMENT_ORDERS_CANNOT_USE_REVENUE_TIERS',
      },
      {
        name: 'Revenue + Fixed',
        target_type: 'TARGET_TYPE_REVENUE',
        monthly_orders_target: undefined,
        monthly_target_amount: 5000,
        target_deduction_type: 'DEDUCTION_FIXED',
        expectedError: 'HR_EMPLOYMENT_REVENUE_REQUIRES_REVENUE_TIERS',
      },
      {
        name: 'Revenue + Orders Tiers',
        target_type: 'TARGET_TYPE_REVENUE',
        monthly_orders_target: undefined,
        monthly_target_amount: 5000,
        target_deduction_type: 'DEDUCTION_ORDERS_TIERS',
        expectedError: 'HR_EMPLOYMENT_REVENUE_REQUIRES_REVENUE_TIERS',
      },
    ];

    invalidCombinations.forEach((combo) => {
      it(`should reject ${combo.name}`, async () => {
        const data = {
          ...baseValidData,
          target_type: combo.target_type,
          monthly_orders_target: combo.monthly_orders_target,
          monthly_target_amount: combo.monthly_target_amount,
          target_deduction_type: combo.target_deduction_type,
        };

        await expect(
          service['validateActiveStatus'](data as any, 'c1'),
        ).rejects.toThrow(BadRequestException);
        await expect(
          service['validateActiveStatus'](data as any, 'c1'),
        ).rejects.toThrow(combo.expectedError);
      });
    });
  });
});
