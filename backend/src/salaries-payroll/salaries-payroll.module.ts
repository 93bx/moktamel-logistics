import { Module } from '@nestjs/common';
import { SalariesPayrollService } from './salaries-payroll.service';
import { SalariesPayrollController } from './salaries-payroll.controller';
import { SalariesPayrollCalculationService } from './salaries-payroll.calculation.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [SalariesPayrollController],
  providers: [SalariesPayrollService, SalariesPayrollCalculationService],
  exports: [SalariesPayrollService],
})
export class SalariesPayrollModule {}

