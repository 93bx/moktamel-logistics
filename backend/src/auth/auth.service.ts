import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import crypto from 'node:crypto';

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
  expires_in_seconds: number;
  company_id: string;
  user_id: string;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  private getAccessSecret(): string {
    const secret = this.config.get<string>('JWT_ACCESS_SECRET');
    if (!secret) throw new Error('JWT_ACCESS_SECRET is required');
    return secret;
  }

  private getRefreshSecret(): string {
    const secret = this.config.get<string>('JWT_REFRESH_SECRET');
    if (!secret) throw new Error('JWT_REFRESH_SECRET is required');
    return secret;
  }

  private getAccessTtlSeconds(): number {
    return Number(this.config.get<string>('JWT_ACCESS_TTL_SECONDS') ?? 900);
  }

  private getRefreshTtlSeconds(): number {
    return Number(this.config.get<string>('JWT_REFRESH_TTL_SECONDS') ?? 60 * 60 * 24 * 7);
  }

  async breakGlassLogin(input: { email: string; password: string; company_slug: string }): Promise<AuthTokens> {
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || user.status !== 'ACTIVE' || !user.is_break_glass || !user.password_hash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const company = await this.prisma.company.findUnique({ where: { slug: input.company_slug } });
    if (!company) throw new UnauthorizedException('Invalid credentials');

    const membership = await this.prisma.companyMembership.findUnique({
      where: { user_id: user.id },
    });
    if (!membership || membership.status !== 'ACTIVE') throw new UnauthorizedException('Invalid credentials');
    if (membership.company_id !== company.id) throw new UnauthorizedException('Invalid credentials');

    const ok = await argon2.verify(user.password_hash, input.password);
    if (!ok) throw new UnauthorizedException('Invalid credentials');

    return await this.issueTokens({ user_id: user.id, company_id: company.id });
  }

  async issueTokens(input: { user_id: string; company_id: string }): Promise<AuthTokens> {
    const refresh_token = crypto.randomBytes(48).toString('base64url');
    const refresh_token_hash = crypto.createHash('sha256').update(refresh_token).digest('hex');

    const refreshTtl = this.getRefreshTtlSeconds();
    const accessTtl = this.getAccessTtlSeconds();

    const session = await this.prisma.authSession.create({
      data: {
        user_id: input.user_id,
        refresh_token_hash,
        expires_at: new Date(Date.now() + refreshTtl * 1000),
      },
      select: { id: true },
    });

    const payload = {
      sub: input.user_id,
      company_id: input.company_id,
      session_id: session.id,
    };

    const access_token = await this.jwt.signAsync(payload, {
      secret: this.getAccessSecret(),
      expiresIn: accessTtl,
    });

    // Refresh token is opaque; we still sign a small JWT wrapper for tamper resistance if desired later.
    // For now we keep it opaque and validated via DB hash only.
    return {
      access_token,
      refresh_token,
      expires_in_seconds: accessTtl,
      company_id: input.company_id,
      user_id: input.user_id,
    };
  }

  async refresh(input: { refresh_token: string; company_id: string }): Promise<AuthTokens> {
    const refresh_token_hash = crypto.createHash('sha256').update(input.refresh_token).digest('hex');

    const session = await this.prisma.authSession.findFirst({
      where: {
        refresh_token_hash,
        revoked_at: null,
        expires_at: { gt: new Date() },
      },
      select: { id: true, user_id: true },
    });

    if (!session) throw new UnauthorizedException('Invalid refresh token');

    // Rotate refresh token
    await this.prisma.authSession.update({
      where: { id: session.id },
      data: { revoked_at: new Date() },
    });

    return this.issueTokens({ user_id: session.user_id, company_id: input.company_id });
  }

  async logout(input: { refresh_token: string }): Promise<void> {
    const refresh_token_hash = crypto.createHash('sha256').update(input.refresh_token).digest('hex');
    await this.prisma.authSession.updateMany({
      where: { refresh_token_hash, revoked_at: null },
      data: { revoked_at: new Date() },
    });
  }
}


