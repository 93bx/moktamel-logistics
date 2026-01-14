import { BadRequestException, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async bootstrap(input: {
    company_name: string;
    company_slug: string;
    owner_email: string;
    owner_password: string;
  }) {
    const existingCompany = await this.prisma.company.findUnique({ where: { slug: input.company_slug } });
    if (existingCompany) throw new BadRequestException('Company slug already exists');

    // Check if user already has a company membership
    const existingUser = await this.prisma.user.findUnique({
      where: { email: input.owner_email },
      include: { membership: true },
    });

    if (existingUser?.membership) {
      throw new BadRequestException('User already belongs to a company');
    }

    const password_hash = await argon2.hash(input.owner_password, { type: argon2.argon2id });

    const result = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const company = await tx.company.create({
        data: {
          name: input.company_name,
          slug: input.company_slug,
          timezone: 'Asia/Riyadh',
          default_locale: 'en',
        },
      });

      const user = await tx.user.upsert({
        where: { email: input.owner_email },
        update: {
          password_hash,
          is_break_glass: true,
          status: 'ACTIVE',
        },
        create: {
          email: input.owner_email,
          password_hash,
          is_break_glass: true,
          status: 'ACTIVE',
        },
      });

      // Double-check membership doesn't exist (race condition protection)
      const existingMembership = await tx.companyMembership.findUnique({
        where: { user_id: user.id },
      });

      if (existingMembership) {
        throw new BadRequestException('User already has a company membership');
      }

      await tx.auditLog.create({
        data: {
          company_id: company.id,
          actor_user_id: user.id,
          actor_role: 'ROLE_COMPANY_OWNER',
          action: 'PLATFORM_BOOTSTRAP',
          entity_type: 'COMPANY',
          entity_id: company.id,
          new_values: { name: company.name, slug: company.slug, timezone: company.timezone, default_locale: company.default_locale },
        },
      });

      await tx.auditLog.create({
        data: {
          company_id: company.id,
          actor_user_id: user.id,
          actor_role: 'ROLE_COMPANY_OWNER',
          action: 'PLATFORM_BOOTSTRAP',
          entity_type: 'USER',
          entity_id: user.id,
          new_values: { email: user.email, is_break_glass: user.is_break_glass, status: user.status },
        },
      });

      await tx.companyMembership.create({
        data: {
          company_id: company.id,
          user_id: user.id,
          status: 'ACTIVE',
          created_by_user_id: user.id,
        },
      });

      const ownerRole = await tx.role.create({
        data: {
          company_id: company.id,
          name_code: 'ROLE_COMPANY_OWNER',
          created_by_user_id: user.id,
        },
      });

      await tx.auditLog.create({
        data: {
          company_id: company.id,
          actor_user_id: user.id,
          actor_role: 'ROLE_COMPANY_OWNER',
          action: 'PLATFORM_BOOTSTRAP',
          entity_type: 'ROLE',
          entity_id: ownerRole.id,
          new_values: { name_code: ownerRole.name_code },
        },
      });

      // Minimal permissions for phase 1 (expand in later phases).
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
        await tx.permission.upsert({
          where: { key: p.key },
          update: { module: p.module, action: p.action },
          create: { key: p.key, module: p.module, action: p.action },
        });
      }

      const permissionRows = await tx.permission.findMany({
        where: { key: { in: perms.map((p) => p.key) } },
        select: { id: true },
      });

      await tx.rolePermission.createMany({
        data: permissionRows.map((pr: { id: string }) => ({
          role_id: ownerRole.id,
          permission_id: pr.id,
        })),
        skipDuplicates: true,
      });

      await tx.userRole.create({
        data: {
          company_id: company.id,
          user_id: user.id,
          role_id: ownerRole.id,
        },
      });

      return { company, user, ownerRole };
    });

    return {
      company_id: result.company.id,
      owner_user_id: result.user.id,
    };
  }
}


