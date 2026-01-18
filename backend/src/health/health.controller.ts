import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { HealthCheck, HealthCheckService } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([]);
  }

  @Get('db')
  async checkDatabase() {
    try {
      // Test critical tables exist and can be queried
      await Promise.all([
        this.prisma.dailyOperation.findFirst({ take: 1 }),
        this.prisma.employmentRecord.findFirst({ take: 1 }),
        this.prisma.recruitmentCandidate.findFirst({ take: 1 }),
        this.prisma.cashTransaction.findFirst({ take: 1 }),
        this.prisma.companyMembership.findFirst({ take: 1 }),
      ]);

      // Check migration status
      const latestMigration = await this.prisma.$queryRaw<Array<{migration_name: string; finished_at: Date}>>`
        SELECT migration_name, finished_at 
        FROM _prisma_migrations 
        ORDER BY finished_at DESC 
        LIMIT 1
      `;

      // Check critical columns exist
      const criticalColumns = await this.prisma.$queryRawUnsafe<Array<{column_name: string; table_name: string}>>(
        `SELECT column_name, table_name
         FROM information_schema.columns
         WHERE (table_name = 'DailyOperation' AND column_name IN ('is_draft', 'loan_amount', 'cash_received'))
            OR (table_name = 'EmploymentRecord' AND column_name IN ('employee_code', 'assigned_platform'))
            OR (table_name = 'RecruitmentCandidate' AND column_name IN ('full_name_ar', 'full_name_en'))`
      );

      const expectedColumns = [
        { table: 'DailyOperation', columns: ['is_draft', 'loan_amount', 'cash_received'] },
        { table: 'EmploymentRecord', columns: ['employee_code', 'assigned_platform'] },
        { table: 'RecruitmentCandidate', columns: ['full_name_ar', 'full_name_en'] },
      ];

      const foundColumns = criticalColumns.map(c => `${c.table_name}.${c.column_name}`);
      const missingColumns: string[] = [];

      for (const expected of expectedColumns) {
        for (const col of expected.columns) {
          if (!foundColumns.includes(`${expected.table}.${col}`)) {
            missingColumns.push(`${expected.table}.${col}`);
          }
        }
      }

      if (missingColumns.length > 0) {
        throw new HttpException(
          {
            status: 'error',
            message: 'Database schema validation failed',
            missingColumns,
          },
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      return {
        status: 'ok',
        database: 'connected',
        migrations: latestMigration[0] ? {
          latest: latestMigration[0].migration_name,
          applied_at: latestMigration[0].finished_at,
        } : 'unknown',
        schema: 'valid',
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      throw new HttpException(
        {
          status: 'error',
          message: error.message || 'Database health check failed',
          details: error.response?.missingColumns || undefined,
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}


