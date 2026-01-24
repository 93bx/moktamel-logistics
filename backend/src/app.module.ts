import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { PlatformModule } from './platform/platform.module';
import { CompaniesModule } from './companies/companies.module';
import { AuditModule } from './audit/audit.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { NotificationsModule } from './notifications/notifications.module';
import { HrRecruitmentModule } from './hr-recruitment/hr-recruitment.module';
import { HrEmploymentModule } from './hr-employment/hr-employment.module';
import { FilesModule } from './files/files.module';
import { ImportExportModule } from './import-export/import-export.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { HealthModule } from './health/health.module';
import { HrAssetsModule } from './hr-assets/hr-assets.module';
import { DailyOperationsModule } from './daily-operations/daily-operations.module';
import { FleetManagementModule } from './fleet-management/fleet-management.module';
import { CashLoansModule } from './finance-cash-loans/cash-loans.module';
import { PayrollConfigModule } from './payroll-config/payroll-config.module';
import { CostsModule } from './costs/costs.module';
import { SalariesPayrollModule } from './salaries-payroll/salaries-payroll.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuditModule,
    AnalyticsModule,
    NotificationsModule,
    AuthModule,
    PlatformModule,
    CompaniesModule,
    HrRecruitmentModule,
    HrEmploymentModule,
    HrAssetsModule,
    FilesModule,
    ImportExportModule,
    SubscriptionsModule,
    HealthModule,
    DailyOperationsModule,
    FleetManagementModule,
    CashLoansModule,
    PayrollConfigModule,
    CostsModule,
    SalariesPayrollModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
