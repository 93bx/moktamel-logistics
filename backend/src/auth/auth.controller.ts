import { Body, Controller, Post } from '@nestjs/common';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { PlatformService } from '../platform/platform.service';
import { PrismaService } from '../prisma/prisma.service';

const BreakGlassLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  company_slug: z.string().min(2),
});

const SignupSchema = z.object({
  company_name: z.string().min(2),
  company_slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/, 'company_slug must be lowercase letters/numbers/dashes'),
  owner_email: z.string().email(),
  owner_password: z.string().min(12),
  owner_name: z.string().optional(),
  owner_phone: z.string().optional(),
});

const RefreshSchema = z.object({
  refresh_token: z.string().min(20),
  company_id: z.string().uuid(),
});

const LogoutSchema = z.object({
  refresh_token: z.string().min(20),
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly platform: PlatformService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('signup')
  async signup(@Body() body: unknown) {
    const input = SignupSchema.parse(body);
    const result = await this.platform.bootstrap({
      company_name: input.company_name,
      company_slug: input.company_slug,
      owner_email: input.owner_email,
      owner_password: input.owner_password,
    });

    // Update user with optional name and phone if provided
    if (input.owner_name || input.owner_phone) {
      await this.prisma.user.update({
        where: { id: result.owner_user_id },
        data: {
          ...(input.owner_name && { name: input.owner_name }),
          ...(input.owner_phone && { phone: input.owner_phone }),
        },
      });
    }

    // Issue tokens for the new user
    return await this.auth.issueTokens({
      user_id: result.owner_user_id,
      company_id: result.company_id,
    });
  }

  @Post('break-glass/login')
  async breakGlassLogin(@Body() body: unknown) {
    const input = BreakGlassLoginSchema.parse(body);
    return await this.auth.breakGlassLogin(input);
  }

  @Post('refresh')
  async refresh(@Body() body: unknown) {
    const input = RefreshSchema.parse(body);
    return await this.auth.refresh(input);
  }

  @Post('logout')
  async logout(@Body() body: unknown) {
    const input = LogoutSchema.parse(body);
    await this.auth.logout(input);
    return { ok: true };
  }
}


