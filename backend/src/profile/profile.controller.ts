import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProfileService } from './profile.service';

type AuthenticatedRequest = Request & {
  user: { sub: string; company_id: string };
};

const UpdateProfileSchema = z.object({
  first_name: z.string().min(1).max(120).optional(),
  last_name: z.string().max(120).optional(),
  phone: z.string().max(32).optional(),
  profile_picture_url: z
    .string()
    .max(2048)
    .refine(
      (value) =>
        /^https?:\/\/.+/i.test(value) ||
        /^\/api\/files\/[0-9a-fA-F-]{36}\/view$/.test(value),
      { message: 'Invalid URL' },
    )
    .nullable()
    .optional(),
  email: z.string().email().optional(),
});

const ChangePasswordSchema = z
  .object({
    current_password: z.string().min(8),
    new_password: z.string().min(12),
    confirm_password: z.string().min(12),
  })
  .refine((value) => value.new_password === value.confirm_password, {
    path: ['confirm_password'],
    message: 'Passwords do not match',
  });

const HistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  private getAuthUser(req: AuthenticatedRequest) {
    return req.user;
  }

  @Get('me')
  async me(@Req() req: AuthenticatedRequest) {
    const user = this.getAuthUser(req);
    return this.profile.getMe(user.sub, user.company_id);
  }

  @Patch('me')
  async updateMe(@Req() req: AuthenticatedRequest, @Body() body: unknown) {
    const input = UpdateProfileSchema.parse(body);
    const user = this.getAuthUser(req);
    return this.profile.updateMe(
      user.sub,
      user.company_id,
      input,
      req.ip ?? null,
      req.get('user-agent') ?? null,
    );
  }

  @Post('change-password')
  async changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() body: unknown,
  ) {
    const input = ChangePasswordSchema.parse(body);
    const user = this.getAuthUser(req);
    return this.profile.changePassword(
      user.sub,
      user.company_id,
      input,
      req.ip ?? null,
      req.get('user-agent') ?? null,
    );
  }

  @Get('history')
  async history(@Req() req: AuthenticatedRequest, @Query() query: unknown) {
    const input = HistoryQuerySchema.parse(query);
    const user = this.getAuthUser(req);
    return this.profile.getHistory(user.sub, user.company_id, input.limit);
  }
}
