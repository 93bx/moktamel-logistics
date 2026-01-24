import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PayrollRunStatus, PayrollEmployeeStatus, PaymentMethod, DocumentSequenceType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SalariesPayrollCalculationService } from './salaries-payroll.calculation.service';
import { ListSalariesQueryDto, CreateSalaryReceiptDto } from './dto/salaries-payroll.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class SalariesPayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: SalariesPayrollCalculationService,
    private readonly audit: AuditService,
  ) {}

  private getMonthBounds(monthStr: string) {
    const [year, month] = monthStr.split('-').map(Number);
    const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    return { start, end };
  }

  async getList(company_id: string, query: ListSalariesQueryDto) {
    const { start, end } = this.getMonthBounds(query.month);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // 1. Ensure a PayrollRun exists for this month
    let run = await this.prisma.payrollRun.findUnique({
      where: { company_id_month: { company_id, month: start } },
    });

    if (!run) {
      run = await this.generateRun(company_id, start, end);
    } else if (run.status === PayrollRunStatus.DRAFT) {
      // For draft runs, we might want to refresh data from sources
      // but for now let's just return what's there. 
      // A "Refresh" button could trigger regeneration.
    }

    // 2. Build where clause
    const where: Prisma.PayrollRunEmployeeWhereInput = {
      company_id,
      payroll_run_id: run.id,
    };

    if (query.status && query.status !== 'ALL') {
      where.status = query.status as PayrollEmployeeStatus;
    }

    if (query.search) {
      where.OR = [
        { employee_code: { contains: query.search, mode: 'insensitive' } },
        { employee_name_ar: { contains: query.search, mode: 'insensitive' } },
        { employee_name_en: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    // 3. Fetch employees and quick stats
    const [employees, total, statsAgg] = await Promise.all([
      this.prisma.payrollRunEmployee.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { employee_code: 'asc' },
      }),
      this.prisma.payrollRunEmployee.count({ where }),
      this.prisma.payrollRunEmployee.aggregate({
        where: { company_id, payroll_run_id: run.id },
        _sum: {
          total_outstanding_loans: true,
          total_deductions: true,
          salary_after_deductions: true,
          total_revenue: true,
        },
        _count: {
          id: true,
        },
      }),
    ]);

    // Calculate "Total Salaries Due" (only for NOT_PAID)
    const salariesDueAgg = await this.prisma.payrollRunEmployee.aggregate({
      where: { company_id, payroll_run_id: run.id, status: 'NOT_PAID' },
      _sum: { salary_after_deductions: true },
    });

    return {
      quickStats: {
        activeEmployeesCount: statsAgg._count.id,
        totalLoansAmount: Number(statsAgg._sum.total_outstanding_loans ?? 0),
        totalDeductionsAmount: Number(statsAgg._sum.total_deductions ?? 0),
        totalSalariesDueAmount: Number(salariesDueAgg._sum.salary_after_deductions ?? 0),
        totalRevenueAmount: Number(statsAgg._sum.total_revenue ?? 0),
      },
      items: employees,
      pagination: {
        page,
        pageSize,
        total,
      },
    };
  }

  async getEmployeeDetail(company_id: string, payrollRunEmployeeId: string) {
    const employee = await this.prisma.payrollRunEmployee.findFirst({
      where: { id: payrollRunEmployeeId, company_id },
      include: {
        payroll_run: true,
        receipt: true,
      },
    });

    if (!employee) throw new NotFoundException('Payroll record not found');

    return employee;
  }

  async createReceipt(company_id: string, actor_user_id: string, payrollRunEmployeeId: string, data: CreateSalaryReceiptDto) {
    const employee = await this.prisma.payrollRunEmployee.findFirst({
      where: { id: payrollRunEmployeeId, company_id },
      include: { receipt: true, payroll_run: true },
    });

    if (!employee) throw new NotFoundException('Payroll record not found');
    if (employee.status === 'PAID' || employee.receipt) {
      throw new BadRequestException('PAYROLL_SALARIES_002: Salary already paid for this month');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Get next receipt number
      const sequence = await tx.documentSequence.upsert({
        where: {
          company_id_month_sequence_type: {
            company_id,
            month: employee.payroll_run.month,
            sequence_type: DocumentSequenceType.SALARY_RECEIPT,
          },
        },
        update: { current_number: { increment: 1 } },
        create: {
          company_id,
          month: employee.payroll_run.month,
          sequence_type: DocumentSequenceType.SALARY_RECEIPT,
          current_number: 1,
        },
      });

      const receiptNumber = `RCPT-${employee.payroll_run.month.toISOString().slice(0, 7)}-${String(
        sequence.current_number,
      ).padStart(4, '0')}`;

      // 2. Create receipt
      const receipt = await tx.salaryReceipt.create({
        data: {
          company_id,
          payroll_run_employee_id: payrollRunEmployeeId,
          receipt_number: receiptNumber,
          amount: data.amount,
          payment_method: data.paymentMethod,
          payment_date: new Date(data.paymentDate),
          attachment_url: data.attachmentUrl,
          created_by_user_id: actor_user_id,
        },
      });

      // 3. Update employee status
      await tx.payrollRunEmployee.update({
        where: { id: payrollRunEmployeeId },
        data: { status: 'PAID' },
      });

      await this.audit.log({
        company_id,
        actor_user_id,
        action: 'PAYROLL_RECEIPT_CREATE',
        entity_type: 'SALARY_RECEIPT',
        entity_id: receipt.id,
        new_values: receipt,
      });

      return receipt;
    });
  }

  private async generateRun(company_id: string, start: Date, end: Date) {
    // This should be done in a transaction or with care
    return this.prisma.$transaction(async (tx) => {
      // 1. Fetch active employees
      const employments = await tx.employmentRecord.findMany({
        where: {
          company_id,
          deleted_at: null,
          status_code: 'EMPLOYMENT_STATUS_ACTIVE',
          OR: [
            { start_date_at: null },
            { start_date_at: { lte: end } },
          ],
        },
        include: {
          recruitment_candidate: true,
        },
      });

      // 2. Fetch Payroll Config
      const config = await tx.payrollConfig.findUnique({
        where: { company_id },
      });

      if (!config) {
        throw new BadRequestException('PAYROLL_SALARIES_001: Payroll configuration not found for this company');
      }

      // 3. Create the run record
      const run = await tx.payrollRun.create({
        data: {
          company_id,
          month: start,
          status: 'DRAFT',
          generated_by_user_id: 'SYSTEM', // Replace with actual user ID if triggered manually
          created_by_user_id: 'SYSTEM',
        },
      });

      // 4. Calculate for each employee and create rows
      for (const emp of employments) {
        // Fetch operations data for the month
        const opsAgg = await tx.dailyOperation.aggregate({
          where: {
            company_id,
            employment_record_id: emp.id,
            date: { gte: start, lte: end },
            is_draft: false,
          },
          _sum: { orders_count: true, total_revenue: true, cash_collected: true, cash_received: true },
          _count: { id: true },
        });

        // Fetch loans data
        // For now, let's sum all approved loans that are not fully paid? 
        // Or as per requirement: "Total outstanding balance of all loans".
        const loansAgg = await tx.cashTransaction.aggregate({
          where: {
            company_id,
            employment_record_id: emp.id,
            type: 'LOAN',
            status: 'APPROVED',
          },
          _sum: { amount: true },
        });
        
        // Sum repayments (receipts tied to loans - assuming we have a way to distinguish)
        // If not, we'll just use total loans for now.
        const totalOutstandingLoans = Number(loansAgg._sum.amount ?? 0);

        // Scheduled installments (e.g. from AssetDeduction for this month)
        const installmentsAgg = await tx.assetDeduction.aggregate({
          where: {
            company_id,
            employment_record_id: emp.id,
            status_code: 'PENDING', // or based on date if we had a deduction date
            created_at: { gte: start, lte: end }, // Simplification
          },
          _sum: { amount: true },
        });

        // Unreceived cash
        const unreceivedCash = Number(opsAgg._sum.cash_collected ?? 0) - Number(opsAgg._sum.cash_received ?? 0);

        const calculation = this.calculator.calculate({
          baseSalary: Number(emp.salary_amount ?? 0),
          monthlyTarget: config.monthly_target ?? 0,
          ordersCount: opsAgg._sum.orders_count ?? 0,
          workingDays: opsAgg._count.id,
          deductionMethod: config.calculation_method,
          deductionTiers: config.deduction_tiers as any[],
          deductionPerOrder: Number(config.deduction_per_order ?? 0),
          scheduledLoanInstallments: Number(installmentsAgg._sum.amount ?? 0),
          totalBonus: 0, // Bonus logic can be added here
          totalRevenue: Number(opsAgg._sum.total_revenue ?? 0),
          averageCost: 0, // Should come from a cost calculation logic
        });

        await tx.payrollRunEmployee.create({
          data: {
            company_id,
            payroll_run_id: run.id,
            employee_id: emp.id,
            employee_code: emp.employee_code,
            employee_name_ar: emp.recruitment_candidate?.full_name_ar,
            employee_name_en: emp.recruitment_candidate?.full_name_en,
            status: 'NOT_PAID',
            base_salary: emp.salary_amount ?? 0,
            monthly_target: config.monthly_target ?? 0,
            orders_count: opsAgg._sum.orders_count ?? 0,
            working_days: opsAgg._count.id,
            target_difference: calculation.targetDifference,
            deduction_method: config.calculation_method,
            total_deductions: calculation.totalDeductions,
            scheduled_loan_installments: Number(installmentsAgg._sum.amount ?? 0),
            total_outstanding_loans: totalOutstandingLoans,
            total_unreceived_cash: unreceivedCash,
            total_bonus: 0,
            salary_after_deductions: calculation.salaryAfterDeductions,
            total_revenue: Number(opsAgg._sum.total_revenue ?? 0),
            average_cost: 0,
            calculation_details: calculation.calculationDetails,
            created_by_user_id: 'SYSTEM',
          },
        });
      }

      return run;
    });
  }
}

