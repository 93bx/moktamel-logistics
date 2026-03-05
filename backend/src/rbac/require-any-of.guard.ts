import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { REQUIRE_ANY_OF_KEY } from './require-any-of.decorator';

@Injectable()
export class RequireAnyOfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowed = this.reflector.getAllAndOverride<string[]>(
      REQUIRE_ANY_OF_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!allowed || allowed.length === 0) return true;

    const req = context.switchToHttp().getRequest<any>();
    const user = req.user as { sub?: string; company_id?: string } | undefined;

    if (!user?.sub || !user.company_id) throw new ForbiddenException();

    const membership = await this.prisma.companyMembership.findUnique({
      where: { user_id: user.sub },
      select: { status: true, company_id: true },
    });

    if (!membership || membership.status !== 'ACTIVE')
      throw new ForbiddenException();
    if (membership.company_id !== user.company_id)
      throw new ForbiddenException('Company mismatch');

    const rows = await this.prisma.userRole.findMany({
      where: { company_id: user.company_id, user_id: user.sub },
      select: {
        role: {
          select: {
            role_permissions: {
              select: { permission: { select: { key: true } } },
            },
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

    const hasAny = allowed.some((p) => userPerms.has(p));
    if (!hasAny) throw new ForbiddenException();

    return true;
  }
}
