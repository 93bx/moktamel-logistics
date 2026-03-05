import { Module } from '@nestjs/common';
import { HrEmploymentController } from './hr-employment.controller';
import { HrEmploymentService } from './hr-employment.service';
import { PayrollConfigModule } from '../payroll-config/payroll-config.module';

@Module({
  imports: [PayrollConfigModule],
  controllers: [HrEmploymentController],
  providers: [HrEmploymentService],
  exports: [HrEmploymentService],
})
export class HrEmploymentModule {}
