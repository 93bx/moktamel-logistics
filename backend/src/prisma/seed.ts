import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PlatformService } from '../platform/platform.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const platformService = app.get(PlatformService);

  const companyName = process.env.SEED_COMPANY_NAME || 'Test Company';
  const companySlug = process.env.SEED_COMPANY_SLUG || 'test-company';
  const ownerEmail = process.env.SEED_OWNER_EMAIL || 'admin@example.com';
  const ownerPassword = process.env.SEED_OWNER_PASSWORD || 'SecurePassword123!';

  console.log('Starting seed...');
  console.log(`Company: ${companyName} (${companySlug})`);
  console.log(`Owner: ${ownerEmail}`);

  try {
    const result = await platformService.bootstrap({
      company_name: companyName,
      company_slug: companySlug,
      owner_email: ownerEmail,
      owner_password: ownerPassword,
    });

    console.log('✓ Seed completed successfully!');
    console.log(`  Company ID: ${result.company_id}`);
    console.log(`  Owner User ID: ${result.owner_user_id}`);
  } catch (error: any) {
    console.error('✗ Seed failed:', error.message);
    if (error.response) {
      console.error('  Response:', error.response);
    }
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();

