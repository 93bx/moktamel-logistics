import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { HrRecruitmentService } from './hr-recruitment.service';

@Injectable()
export class HrRecruitmentCronService {
  constructor(private readonly recruitmentSvc: HrRecruitmentService) {}

  /** 01:00 UTC = 04:00 Riyadh (UTC+3) */
  @Cron('0 1 * * *')
  async runDailyStatusRecompute(): Promise<void> {
    await this.recruitmentSvc.runDailyStatusRecompute();
  }
}
