import { Module } from '@nestjs/common';
import { PayrollConfigController } from './payroll-config.controller';
import { PayrollConfigService } from './payroll-config.service';
import { SalariesPayrollModule } from '../salaries-payroll/salaries-payroll.module';

@Module({
  imports: [SalariesPayrollModule],
  controllers: [PayrollConfigController],
  providers: [PayrollConfigService],
  exports: [PayrollConfigService],
})
export class PayrollConfigModule {}
