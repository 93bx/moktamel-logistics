import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const prisma = app.get(PrismaService);

  console.log('Syncing permissions...');

  const perms = [
    { key: 'PLATFORM_COMPANY_READ', module: 'PLATFORM', action: 'READ' },
    { key: 'PLATFORM_COMPANY_CREATE', module: 'PLATFORM', action: 'CREATE' },
    { key: 'PLATFORM_COMPANY_UPDATE', module: 'PLATFORM', action: 'UPDATE' },
    { key: 'PLATFORM_RBAC_MANAGE', module: 'PLATFORM', action: 'MANAGE' },
    { key: 'AUDIT_READ', module: 'AUDIT', action: 'READ' },
    { key: 'HR_RECRUITMENT_READ', module: 'HR_RECRUITMENT', action: 'READ' },
    { key: 'HR_RECRUITMENT_CREATE', module: 'HR_RECRUITMENT', action: 'CREATE' },
    { key: 'HR_RECRUITMENT_UPDATE', module: 'HR_RECRUITMENT', action: 'UPDATE' },
    { key: 'HR_RECRUITMENT_DELETE', module: 'HR_RECRUITMENT', action: 'DELETE' },
    { key: 'HR_RECRUITMENT_EXPORT', module: 'HR_RECRUITMENT', action: 'EXPORT' },
    { key: 'HR_RECRUITMENT_IMPORT', module: 'HR_RECRUITMENT', action: 'IMPORT' },
    { key: 'HR_EMPLOYMENT_READ', module: 'HR_EMPLOYMENT', action: 'READ' },
    { key: 'HR_EMPLOYMENT_CREATE', module: 'HR_EMPLOYMENT', action: 'CREATE' },
    { key: 'HR_EMPLOYMENT_UPDATE', module: 'HR_EMPLOYMENT', action: 'UPDATE' },
    { key: 'HR_EMPLOYMENT_DELETE', module: 'HR_EMPLOYMENT', action: 'DELETE' },
    { key: 'HR_EMPLOYMENT_EXPORT', module: 'HR_EMPLOYMENT', action: 'EXPORT' },
    { key: 'HR_EMPLOYMENT_IMPORT', module: 'HR_EMPLOYMENT', action: 'IMPORT' },
    { key: 'HR_ASSETS_READ', module: 'HR_ASSETS', action: 'READ' },
    { key: 'HR_ASSETS_CREATE', module: 'HR_ASSETS', action: 'CREATE' },
    { key: 'HR_ASSETS_UPDATE', module: 'HR_ASSETS', action: 'UPDATE' },
    { key: 'HR_ASSETS_DELETE', module: 'HR_ASSETS', action: 'DELETE' },
    { key: 'HR_ASSETS_APPROVE', module: 'HR_ASSETS', action: 'APPROVE' },
    { key: 'DAILY_OPS_READ', module: 'DAILY_OPERATIONS', action: 'READ' },
    { key: 'DAILY_OPS_CREATE', module: 'DAILY_OPERATIONS', action: 'CREATE' },
    { key: 'DAILY_OPS_CREATE_BULK', module: 'DAILY_OPERATIONS', action: 'CREATE_BULK' },
    { key: 'DAILY_OPS_UPDATE', module: 'DAILY_OPERATIONS', action: 'UPDATE' },
    { key: 'FILES_UPLOAD', module: 'FILES', action: 'UPLOAD' },
    { key: 'FILES_DOWNLOAD', module: 'FILES', action: 'DOWNLOAD' },
    { key: 'FILES_DELETE', module: 'FILES', action: 'DELETE' },
    { key: 'FIN_CASH_LOANS_READ', module: 'FINANCE_CASH_LOANS', action: 'READ' },
    { key: 'FIN_CASH_LOANS_MANAGE', module: 'FINANCE_CASH_LOANS', action: 'MANAGE' },
    { key: 'NOTIFICATIONS_READ', module: 'NOTIFICATIONS', action: 'READ' },
    { key: 'NOTIFICATIONS_CONFIGURE', module: 'NOTIFICATIONS', action: 'CONFIGURE' },
    { key: 'ANALYTICS_READ', module: 'ANALYTICS', action: 'READ' },
    { key: 'ANALYTICS_EXPORT', module: 'ANALYTICS', action: 'EXPORT' },
    { key: 'SUBSCRIPTIONS_READ', module: 'SUBSCRIPTIONS', action: 'READ' },
    { key: 'SUBSCRIPTIONS_MANAGE', module: 'SUBSCRIPTIONS', action: 'MANAGE' },
    { key: 'FLEET_READ', module: 'FLEET', action: 'READ' },
    { key: 'FLEET_CREATE', module: 'FLEET', action: 'CREATE' },
    { key: 'FLEET_UPDATE', module: 'FLEET', action: 'UPDATE' },
    { key: 'FLEET_DELETE', module: 'FLEET', action: 'DELETE' },
    { key: 'FLEET_ASSIGN', module: 'FLEET', action: 'ASSIGN' },
    { key: 'FLEET_MAINTENANCE', module: 'FLEET', action: 'MAINTENANCE' },
  ];

  for (const p of perms) {
    await prisma.permission.upsert({
      where: { key: p.key },
      update: { module: p.module, action: p.action },
      create: { key: p.key, module: p.module, action: p.action },
    });
  }

  const allPerms = await prisma.permission.findMany();
  const ownerRoles = await prisma.role.findMany({
    where: { name_code: 'ROLE_COMPANY_OWNER' },
  });

  console.log(`Found ${ownerRoles.length} owner roles to update.`);

  for (const role of ownerRoles) {
    await prisma.rolePermission.createMany({
      data: allPerms.map((p) => ({
        role_id: role.id,
        permission_id: p.id,
      })),
      skipDuplicates: true,
    });
  }

  console.log('✓ Permissions synced successfully!');
  await app.close();
}

bootstrap();




