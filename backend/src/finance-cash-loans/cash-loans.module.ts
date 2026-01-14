import { Module } from '@nestjs/common';
import { CashLoansService } from './cash-loans.service';
import { CashLoansController } from './cash-loans.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [PrismaModule, AuditModule, AnalyticsModule],
  providers: [CashLoansService],
  controllers: [CashLoansController],
})
export class CashLoansModule {}

