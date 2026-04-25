import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportsExcelService } from './reports-excel.service';
import { ReportsPdfService } from './reports-pdf.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsExcelService, ReportsPdfService],
})
export class ReportsModule {}
