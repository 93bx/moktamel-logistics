import { Global, Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { MetricsController } from './metrics.controller';

@Global()
@Module({
  controllers: [MetricsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}


