import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';

const prisma = new PrismaClient();

async function validateSchema() {
  try {
    console.log('🔍 Validating database schema...');
    
    // 1. Check if all migrations are applied
    try {
      const migrationStatus = execSync('npx prisma migrate status', { 
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      
      if (migrationStatus.includes('following migration') || migrationStatus.includes('drift detected')) {
        console.error('❌ There are pending migrations or schema drift detected!');
        console.error(migrationStatus);
        process.exit(1);
      }
      
      console.log('✅ All migrations are applied');
    } catch (error: any) {
      const output = error.stdout || error.stderr || error.message;
      if (output.includes('following migration') || output.includes('drift detected')) {
        console.error('❌ Migration status check failed:', output);
        process.exit(1);
      }
      // If it's just a status check issue, continue with column validation
      console.warn('⚠️  Could not check migration status, continuing with column validation...');
    }
    
    // 2. Test critical tables exist with expected columns
    const criticalChecks = [
      {
        table: 'DailyOperation',
        columns: ['is_draft', 'loan_amount', 'cash_received', 'difference_amount', 'approved_at', 'approved_by_user_id']
      },
      {
        table: 'EmploymentRecord',
        columns: ['employee_code', 'assigned_platform', 'full_name_ar', 'full_name_en']
      },
      {
        table: 'RecruitmentCandidate',
        columns: ['full_name_ar', 'full_name_en']
      },
      {
        table: 'CashTransaction',
        columns: ['type', 'status', 'amount', 'date']
      },
      {
        table: 'CompanyMembership',
        columns: ['user_id', 'company_id']
      }
    ];
    
    for (const check of criticalChecks) {
      const result = await prisma.$queryRawUnsafe<Array<{column_name: string}>>(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_name = $1 
         AND column_name = ANY($2::text[])`,
        check.table,
        check.columns
      );
      
      const foundColumns = result.map(r => r.column_name);
      const missingColumns = check.columns.filter(col => !foundColumns.includes(col));
      
      if (missingColumns.length > 0) {
        console.error(`❌ Table ${check.table} is missing columns: ${missingColumns.join(', ')}`);
        console.error(`   Expected columns: ${check.columns.join(', ')}`);
        console.error(`   Found columns: ${foundColumns.join(', ')}`);
        process.exit(1);
      }
      
      console.log(`✅ Table ${check.table} has all required columns`);
    }
    
    // 3. Test Prisma can query these tables
    console.log('🔍 Testing Prisma queries...');
    await prisma.dailyOperation.findFirst({ take: 1 });
    await prisma.employmentRecord.findFirst({ take: 1 });
    await prisma.recruitmentCandidate.findFirst({ take: 1 });
    await prisma.cashTransaction.findFirst({ take: 1 });
    await prisma.companyMembership.findFirst({ take: 1 });
    
    console.log('✅ All Prisma queries successful');
    
    // 4. Check for unique index on CompanyMembership.user_id
    const userIndexCheck = await prisma.$queryRawUnsafe<Array<{indexname: string}>>(
      `SELECT indexname 
       FROM pg_indexes 
       WHERE tablename = 'CompanyMembership' 
       AND indexname = 'CompanyMembership_user_id_key'`
    );
    
    if (userIndexCheck.length === 0) {
      console.error('❌ Missing unique index: CompanyMembership_user_id_key');
      process.exit(1);
    }
    
    console.log('✅ Unique index on CompanyMembership.user_id exists');
    
    console.log('✅ Database schema is valid!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Schema validation failed:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

validateSchema();

