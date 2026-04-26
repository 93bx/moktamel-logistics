import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

const ADMIN_ROLE_CODES = new Set([
  'ROLE_COMPANY_OWNER',
  'ROLE_COMPANY_ADMIN',
  'ROLE_ADMIN',
]);

const PROFILE_HISTORY_ACTIONS = [
  'AUTH_LOGIN_SUCCESS',
  'AUTH_LOGIN_FAILED',
  'PROFILE_PASSWORD_CHANGED',
];

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getMe(user_id: string, company_id: string) {
    const profile = await this.loadProfile(user_id, company_id);
    return this.toMePayload(profile);
  }

  async updateMe(
    user_id: string,
    company_id: string,
    input: {
      first_name?: string;
      last_name?: string;
      phone?: string;
      profile_picture_url?: string | null;
      email?: string;
    },
    ip: string | null,
    user_agent: string | null,
  ) {
    const profile = await this.loadProfile(user_id, company_id);
    if (!this.canEditUserInfo(profile.role_codes)) {
      throw new ForbiddenException('Only admins can edit profile info');
    }
    if (typeof input.email !== 'undefined') {
      throw new BadRequestException(
        'Email updates are not allowed on this page',
      );
    }

    const nextFirst =
      typeof input.first_name === 'string'
        ? input.first_name.trim()
        : (profile.user.first_name ?? '');
    const nextLast =
      typeof input.last_name === 'string'
        ? input.last_name.trim()
        : (profile.user.last_name ?? '');
    const nextPhone =
      typeof input.phone === 'string'
        ? this.normalizePhone(input.phone)
        : undefined;
    const nextProfilePictureUrl =
      typeof input.profile_picture_url !== 'undefined'
        ? this.normalizeProfilePictureUrl(input.profile_picture_url)
        : undefined;

    const updated = await this.prisma.user.update({
      where: { id: user_id },
      data: {
        ...(typeof nextFirst !== 'undefined' ? { first_name: nextFirst } : {}),
        ...(typeof nextLast !== 'undefined' ? { last_name: nextLast } : {}),
        ...(typeof nextPhone !== 'undefined' ? { phone: nextPhone } : {}),
        ...(typeof nextProfilePictureUrl !== 'undefined'
          ? { profile_picture_url: nextProfilePictureUrl }
          : {}),
      },
      select: {
        id: true,
        email: true,
        first_name: true,
        last_name: true,
        phone: true,
        profile_picture_url: true,
      },
    });

    await this.audit.log({
      company_id,
      actor_user_id: user_id,
      actor_role: profile.primary_role,
      action: 'PROFILE_USER_INFO_UPDATED',
      entity_type: 'USER',
      entity_id: user_id,
      old_values: {
        first_name: profile.user.first_name,
        last_name: profile.user.last_name,
        phone: profile.user.phone,
        profile_picture_url: profile.user.profile_picture_url,
      },
      new_values: {
        first_name: updated.first_name,
        last_name: updated.last_name,
        phone: updated.phone,
        profile_picture_url: updated.profile_picture_url,
      },
      ip,
      user_agent,
    });

    const refreshed = await this.loadProfile(user_id, company_id);
    return this.toMePayload(refreshed);
  }

  async changePassword(
    user_id: string,
    company_id: string,
    input: {
      current_password: string;
      new_password: string;
      confirm_password: string;
    },
    ip: string | null,
    user_agent: string | null,
  ) {
    if (input.new_password !== input.confirm_password) {
      throw new BadRequestException('Password confirmation does not match');
    }
    if (input.current_password === input.new_password) {
      throw new BadRequestException(
        'New password must be different from current password',
      );
    }

    const profile = await this.loadProfile(user_id, company_id);
    if (!profile.user.password_hash) {
      throw new BadRequestException(
        'Password is not configured for this account',
      );
    }

    const validCurrent = await argon2.verify(
      profile.user.password_hash,
      input.current_password,
    );
    if (!validCurrent) {
      throw new BadRequestException('Current password is incorrect');
    }

    const nextHash = await argon2.hash(input.new_password, {
      type: argon2.argon2id,
    });
    await this.prisma.user.update({
      where: { id: user_id },
      data: { password_hash: nextHash },
    });

    await this.audit.log({
      company_id,
      actor_user_id: user_id,
      actor_role: profile.primary_role,
      action: 'PROFILE_PASSWORD_CHANGED',
      entity_type: 'USER',
      entity_id: user_id,
      ip,
      user_agent,
    });

    return { ok: true };
  }

  async getHistory(user_id: string, company_id: string, limit: number) {
    const safeLimit = Math.min(Math.max(limit, 1), 50);
    const rows = await this.prisma.auditLog.findMany({
      where: {
        company_id,
        OR: [
          {
            action: { in: PROFILE_HISTORY_ACTIONS },
            actor_user_id: user_id,
          },
          {
            action: { in: PROFILE_HISTORY_ACTIONS },
            entity_type: 'USER',
            entity_id: user_id,
          },
          {
            action: { startsWith: 'ADMIN_' },
            entity_type: 'USER',
            entity_id: user_id,
          },
        ],
      },
      orderBy: { created_at: 'desc' },
      take: safeLimit,
      select: {
        id: true,
        action: true,
        created_at: true,
        actor_user_id: true,
        actor_role: true,
        entity_type: true,
        entity_id: true,
        old_values: true,
        new_values: true,
      },
    });

    return {
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        created_at: row.created_at,
        actor_user_id: row.actor_user_id,
        actor_role: row.actor_role,
        entity_type: row.entity_type,
        entity_id: row.entity_id,
        metadata: {
          old_values: row.old_values,
          new_values: row.new_values,
        },
      })),
      total: rows.length,
      limit: safeLimit,
    };
  }

  private async loadProfile(user_id: string, company_id: string) {
    const membership = await this.prisma.companyMembership.findUnique({
      where: { user_id },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
            phone: true,
            profile_picture_url: true,
            password_hash: true,
          },
        },
      },
    });
    if (!membership || membership.status !== 'ACTIVE') {
      throw new ForbiddenException('Membership is inactive');
    }
    if (membership.company_id !== company_id) {
      throw new ForbiddenException('Company mismatch');
    }

    const userRoles = await this.prisma.userRole.findMany({
      where: { company_id, user_id },
      select: {
        role: {
          select: {
            name_code: true,
          },
        },
      },
    });
    if (!membership.user) {
      throw new NotFoundException('User not found');
    }

    const role_codes = userRoles.map((entry) => entry.role.name_code);
    const primary_role = role_codes[0] ?? 'ROLE_UNKNOWN';

    return {
      user: membership.user,
      company: membership.company,
      role_codes,
      primary_role,
    };
  }

  private toMePayload(profile: {
    user: {
      first_name: string | null;
      last_name: string | null;
      email: string;
      phone: string | null;
      profile_picture_url: string | null;
    };
    company: { name: string; email: string | null };
    role_codes: string[];
    primary_role: string;
  }) {
    return {
      user: {
        first_name: profile.user.first_name ?? '',
        last_name: profile.user.last_name ?? '',
        email: profile.user.email,
        phone: profile.user.phone,
        role: profile.primary_role,
        profile_picture_url: profile.user.profile_picture_url,
      },
      company: {
        name: profile.company.name,
        email: profile.company.email,
        address: null,
        logo_url: null,
      },
      permissions: {
        can_edit_user_info: this.canEditUserInfo(profile.role_codes),
      },
    };
  }

  private normalizePhone(phone: string) {
    const trimmed = phone.trim();
    if (!trimmed) return null;
    return trimmed;
  }

  private normalizeProfilePictureUrl(value: string | null) {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private canEditUserInfo(role_codes: string[]) {
    return role_codes.some((role) => ADMIN_ROLE_CODES.has(role));
  }
}
