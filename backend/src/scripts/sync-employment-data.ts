import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { HrEmploymentService } from '../hr-employment/hr-employment.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);
  const employmentSvc = app.get(HrEmploymentService);

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
        if (!record.full_name_ar) updateData.full_name_ar = record.recruitment_candidate.full_name_ar;
        if (!record.full_name_en) updateData.full_name_en = record.recruitment_candidate.full_name_en;
        if (!record.avatar_file_id) updateData.avatar_file_id = record.recruitment_candidate.avatar_file_id;
        if (!record.nationality) updateData.nationality = record.recruitment_candidate.nationality;
        if (!record.passport_no) updateData.passport_no = record.recruitment_candidate.passport_no;
      }

      // Generate Employee Code if missing
      if (!record.employee_code) {
        // Use the service logic to ensure uniqueness
        // We'll call the private methods via any or just replicate here for safety in a script
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const nums = '123456789';
        const r = (set: string) => set.charAt(Math.floor(Math.random() * set.length));
        
        let code = '';
        let exists = true;
        let attempts = 0;
        while (exists && attempts < 10) {
          code = `${r(chars)}${r(nums)}${r(chars)}${r(nums)}${r(chars)}`;
          const count = await prisma.employmentRecord.count({
            where: { company_id: record.company_id, employee_code: code },
          });
          exists = count > 0;
          attempts++;
        }
        updateData.employee_code = code;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.employmentRecord.update({
          where: { id: record.id },
          data: updateData,
        });
        console.log(`✓ Updated record ${record.id} (${record.full_name_en || 'Unnamed'})`);
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
















