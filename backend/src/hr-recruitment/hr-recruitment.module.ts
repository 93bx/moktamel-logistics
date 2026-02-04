import { Module } from '@nestjs/common';
import { HrRecruitmentController } from './hr-recruitment.controller';
import { HrRecruitmentCronService } from './hr-recruitment-cron.service';
import { HrRecruitmentService } from './hr-recruitment.service';
import { FilesModule } from '../files/files.module';
import { HrEmploymentModule } from '../hr-employment/hr-employment.module';

@Module({
  imports: [FilesModule, HrEmploymentModule],
  controllers: [HrRecruitmentController],
  providers: [HrRecruitmentService, HrRecruitmentCronService],
})
export class HrRecruitmentModule {}


