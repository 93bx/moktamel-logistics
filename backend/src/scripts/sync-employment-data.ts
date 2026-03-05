import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  console.log('Starting One-Time Data Sync...');

  try {
    // 1. Find all EmploymentRecords that are linked to a RecruitmentCandidate
    const records = await prisma.employmentRecord.findMany({
      where: {
        deleted_at: null,
      },
      include: {
        recruitment_candidate: true,
      },
    });

    console.log(`Found ${records.length} records to process.`);

    for (const record of records) {
      const updateData: any = {};

      // Sync from Recruitment Candidate if linked
      if (record.recruitment_candidate) {
        if (!record.full_name_ar)
          updateData.full_name_ar = record.recruitment_candidate.full_name_ar;
        if (!record.full_name_en)
          updateData.full_name_en = record.recruitment_candidate.full_name_en;
        if (!record.avatar_file_id)
          updateData.avatar_file_id =
            record.recruitment_candidate.avatar_file_id;
        if (!record.nationality)
          updateData.nationality = record.recruitment_candidate.nationality;
        if (!record.passport_no)
          updateData.passport_no = record.recruitment_candidate.passport_no;
      }

      // Employee codes for missing records are set by migrate-employee-codes.ts; new records get code from HrEmploymentService on create.

      if (Object.keys(updateData).length > 0) {
        await prisma.employmentRecord.update({
          where: { id: record.id },
          data: updateData,
        });
        console.log(
          `✓ Updated record ${record.id} (${record.full_name_en || 'Unnamed'})`,
        );
      }
    }

    console.log('✓ One-Time Data Sync completed successfully!');
  } catch (error: any) {
    console.error('✗ Sync failed:', error.message);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
