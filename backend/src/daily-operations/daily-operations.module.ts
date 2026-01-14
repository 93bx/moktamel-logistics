import { Module } from '@nestjs/common';
import { DailyOperationsController } from './daily-operations.controller';
import { DailyOperationsService } from './daily-operations.service';

@Module({
  controllers: [DailyOperationsController],
  providers: [DailyOperationsService],
})
export class DailyOperationsModule {}


