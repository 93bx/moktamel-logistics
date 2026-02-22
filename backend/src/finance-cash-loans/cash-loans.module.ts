import { Module } from '@nestjs/common';
import { CashLoansService } from './cash-loans.service';
import { CashLoansController } from './cash-loans.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  providers: [CashLoansService],
  controllers: [CashLoansController],
})
export class CashLoansModule {}

