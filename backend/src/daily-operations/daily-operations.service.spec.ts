import { BadRequestException } from '@nestjs/common';
import { OperatingPlatform } from '@prisma/client';
import { DailyOperationsService } from './daily-operations.service';

const todayIso = new Date().toISOString();
const futureIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

describe('DailyOperationsService', () => {
  const prisma: any = {
    company: {
      findUnique: jest.fn(),
    },
    employmentRecord: {
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    dailyOperation: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const audit = { log: jest.fn() };

  const service = new DailyOperationsService(prisma, audit as any);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.company.findUnique.mockResolvedValue({ timezone: 'Asia/Riyadh' });
    prisma.employmentRecord.findFirst.mockResolvedValue({ id: 'emp1' });
    prisma.dailyOperation.findFirst.mockResolvedValue(null);
    prisma.dailyOperation.create.mockResolvedValue({
      id: 'op1',
      company_id: 'c1',
      employment_record_id: 'emp1',
      date: todayIso,
      platform: 'JAHEZ',
      orders_count: 5,
      total_revenue: 100,
      cash_collected: 90,
      tips: 5,
      deduction_amount: 10,
      deduction_reason: 'late',
      status_code: 'FLAGGED_DEDUCTION',
    });
  });

  it('rejects future dates', async () => {
    await expect(
      service.createOne('c1', 'u1', {
        employment_record_id: 'emp1',
        date: futureIso,
        platform: OperatingPlatform.JAHEZ,
        orders_count: 1,
        total_revenue: 10,
        cash_collected: 10,
        tips: 0,
        deduction_amount: 0,
        submit_action: 'approve',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a flagged record when deduction exists', async () => {
    const result = await service.createOne('c1', 'u1', {
      employment_record_id: 'emp1',
      date: todayIso,
      platform: OperatingPlatform.JAHEZ,
      orders_count: 5,
      total_revenue: 100,
      cash_collected: 90,
      tips: 5,
      deduction_amount: 10,
      deduction_reason: 'late',
      submit_action: 'approve',
    });

    expect(prisma.dailyOperation.create).toHaveBeenCalled();
    expect(audit.log).toHaveBeenCalled();
    expect(result.status_code).toBe('FLAGGED_DEDUCTION');
  });
});
