import { BadRequestException, ForbiddenException } from '@nestjs/common';
import type { AuditService } from '../audit/audit.service';
import type { PrismaService } from '../prisma/prisma.service';
import { ProfileService } from './profile.service';

function makeService() {
  const prisma = {
    companyMembership: { findUnique: jest.fn() },
    userRole: { findMany: jest.fn() },
    user: { update: jest.fn() },
    auditLog: { findMany: jest.fn() },
  };
  const audit = { log: jest.fn() };
  const service = new ProfileService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );
  return { service, prisma, audit };
}

describe('ProfileService', () => {
  it('rejects email updates explicitly', async () => {
    const { service, prisma } = makeService();
    prisma.companyMembership.findUnique.mockResolvedValue({
      company_id: 'company-1',
      status: 'ACTIVE',
      company: { id: 'company-1', name: 'ACME', email: 'info@acme.com' },
      user: {
        id: 'user-1',
        email: 'a@acme.com',
        first_name: 'John',
        last_name: 'Doe',
        phone: '0500000000',
        profile_picture_url: null,
        password_hash: 'hash',
      },
    });
    prisma.userRole.findMany.mockResolvedValue([
      { role: { name_code: 'ROLE_COMPANY_OWNER' } },
    ]);

    await expect(
      service.updateMe(
        'user-1',
        'company-1',
        { email: 'new@acme.com' },
        null,
        null,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects non-admin profile edits', async () => {
    const { service, prisma } = makeService();
    prisma.companyMembership.findUnique.mockResolvedValue({
      company_id: 'company-1',
      status: 'ACTIVE',
      company: { id: 'company-1', name: 'ACME', email: 'info@acme.com' },
      user: {
        id: 'user-1',
        email: 'a@acme.com',
        first_name: 'John',
        last_name: 'Doe',
        phone: '0500000000',
        profile_picture_url: null,
        password_hash: 'hash',
      },
    });
    prisma.userRole.findMany.mockResolvedValue([
      { role: { name_code: 'ROLE_USER' } },
    ]);

    await expect(
      service.updateMe(
        'user-1',
        'company-1',
        { first_name: 'Jane' },
        null,
        null,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('caps history limit to max 50', async () => {
    const { service, prisma } = makeService();
    prisma.auditLog.findMany.mockResolvedValue([]);

    const result = await service.getHistory('user-1', 'company-1', 200);
    expect(result.limit).toBe(50);
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });
});
