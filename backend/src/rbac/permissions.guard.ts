import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { PERMISSIONS_KEY } from './permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<any>();
    const user = req.user as { sub?: string; company_id?: string } | undefined;

    if (!user?.sub || !user.company_id) throw new ForbiddenException();

    const membership = await this.prisma.companyMembership.findUnique({
      where: { user_id: user.sub },
      select: { status: true, company_id: true },
    });

    if (!membership || membership.status !== 'ACTIVE') throw new ForbiddenException();
    if (membership.company_id !== user.company_id) throw new ForbiddenException('Company mismatch');

    const rows = await this.prisma.userRole.findMany({
      where: { company_id: user.company_id, user_id: user.sub },
      select: {
        role: {
          select: {
            role_permissions: { select: { permission: { select: { key: true } } } },
          },
        },
      },
    });

    const userPerms = new Set<string>();
    for (const r of rows) {
      for (const rp of r.role.role_permissions) {
        userPerms.add(rp.permission.key);
      }
    }

    for (const need of required) {
      if (!userPerms.has(need)) throw new ForbiddenException();
    }

    return true;
  }
}


