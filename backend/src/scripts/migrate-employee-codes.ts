/**
 * One-time migration: set all EmploymentRecord.employee_code to new format
 * (company prefix + 3 random chars + 3 sequential digits by created_at).
 * Run after applying the Prisma migration that drops the employee_code unique constraint.
 * Set RUN_EMPLOYEE_CODE_MIGRATION=true to execute; otherwise script exits without changes.
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

/** Match new format; increase EMPLOYEE_CODE_SEQ_DIGITS to 4+ when extending sequence length. */
const EMPLOYEE_CODE_SEQ_DIGITS = 3;
const NEW_CODE_PATTERN = /^[A-Z]{2}[A-Z0-9]{3}\d{3}$/;

function getCompanyCodePrefix(companyName: string): string {
  const trimmed = (companyName ?? '').trim().replace(/\s+/g, ' ');
  const words = trimmed ? trimmed.split(' ') : [];
  let a: string;
  let b: string;
  if (words.length >= 2) {
    a = words[0].charAt(0).toUpperCase();
    b = words[1].charAt(0).toUpperCase();
  } else {
    const s = trimmed.toUpperCase();
    a = s.charAt(0) || 'X';
    b = s.charAt(1) || 'X';
  }
  const safe = (c: string) => (/^[A-Z]$/.test(c) ? c : 'X');
  return safe(a) + safe(b);
}

function generateThreeRandomChars(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const nums = '123456789';
  const r = (set: string) => set.charAt(Math.floor(Math.random() * set.length));
  return `${r(chars)}${r(nums)}${r(chars)}`;
}

async function bootstrap() {
  if (process.env.RUN_EMPLOYEE_CODE_MIGRATION !== 'true') {
    console.log('Set RUN_EMPLOYEE_CODE_MIGRATION=true to run. Exiting.');
    process.exit(0);
  }

  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  console.log('Starting Employee Code Migration...');

  try {
    const companyIds = await prisma.employmentRecord
      .findMany({
        where: { deleted_at: null },
        select: { company_id: true },
        distinct: ['company_id'],
      })
      .then((rows) => rows.map((r) => r.company_id));

    const companies = await prisma.company.findMany({
      where: { id: { in: companyIds } },
      select: { id: true, name: true },
    });

    const companyMap = new Map(companies.map((c) => [c.id, c]));
    const employeeIdToNewCode = new Map<string, string>();

    for (const company of companies) {
      const prefix = getCompanyCodePrefix(company.name);
      const records = await prisma.employmentRecord.findMany({
        where: { company_id: company.id, deleted_at: null },
        orderBy: { created_at: 'asc' },
        select: { id: true, employee_code: true },
      });

      const usedCodes = new Set<string>();
      const updates: { id: string; new_employee_code: string }[] = [];

      for (let seq = 1; seq <= records.length; seq++) {
        const record = records[seq - 1];
        if (
          record.employee_code &&
          NEW_CODE_PATTERN.test(record.employee_code)
        ) {
          usedCodes.add(record.employee_code);
          updates.push({
            id: record.id,
            new_employee_code: record.employee_code,
          });
          employeeIdToNewCode.set(record.id, record.employee_code);
          continue;
        }

        let code: string;
        do {
          code =
            prefix +
            generateThreeRandomChars() +
            String(seq).padStart(EMPLOYEE_CODE_SEQ_DIGITS, '0');
        } while (usedCodes.has(code));
        usedCodes.add(code);
        updates.push({ id: record.id, new_employee_code: code });
        employeeIdToNewCode.set(record.id, code);
      }

      for (const u of updates) {
        await prisma.employmentRecord.update({
          where: { id: u.id },
          data: { employee_code: u.new_employee_code },
        });
      }

      const maxSeq = records.length;
      await prisma.usageCounter.upsert({
        where: {
          company_id_counter_code: {
            company_id: company.id,
            counter_code: 'EMPLOYEE_CODE_SEQ',
          },
        },
        update: { value: maxSeq },
        create: {
          company_id: company.id,
          counter_code: 'EMPLOYEE_CODE_SEQ',
          value: maxSeq,
        },
      });

      console.log(
        `  Company ${company.name}: ${records.length} records, prefix ${prefix}`,
      );
    }

    const payrollEmployees = await prisma.payrollRunEmployee.findMany({
      select: { id: true, employee_id: true },
    });

    for (const pre of payrollEmployees) {
      const newCode = employeeIdToNewCode.get(pre.employee_id);
      if (newCode !== undefined) {
        await prisma.payrollRunEmployee.update({
          where: { id: pre.id },
          data: { employee_code: newCode },
        });
      }
    }

    console.log(
      `✓ Updated ${payrollEmployees.length} PayrollRunEmployee rows.`,
    );
    console.log('✓ Employee Code Migration completed successfully!');
  } catch (error: unknown) {
    console.error(
      '✗ Migration failed:',
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
