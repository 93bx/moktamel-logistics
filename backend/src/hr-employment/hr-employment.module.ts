import { Module } from '@nestjs/common';
import { HrEmploymentController } from './hr-employment.controller';
import { HrEmploymentService } from './hr-employment.service';

@Module({
  controllers: [HrEmploymentController],
  providers: [HrEmploymentService],
  exports: [HrEmploymentService],
})
export class HrEmploymentModule {}


