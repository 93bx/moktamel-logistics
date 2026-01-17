import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { FilesService } from './files.service';

const CreateUploadSchema = z.object({
  original_name: z.string().min(1),
  mime_type: z.string().min(1),
  size_bytes: z.number().int().positive(),
  checksum: z.string().min(10).optional(),
});

const CreateDownloadSchema = z.object({
  file_id: z.string().uuid(),
});

const LinkSchema = z.object({
  file_id: z.string().uuid(),
  entity_type: z.string().min(1),
  entity_id: z.string().min(1),
  purpose_code: z.string().min(1),
});

@Controller('files')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FilesController {
  constructor(private readonly files: FilesService) {}

  @Post('upload-url')
  @Permissions('FILES_UPLOAD')
  async createUploadUrl(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const input = CreateUploadSchema.parse(body);
    return this.files.createUploadUrl({
      company_id: req.user.company_id,
      actor_user_id: req.user.sub,
      ...input,
    });
  }

  @Post('download-url')
  @Permissions('FILES_DOWNLOAD')
  async createDownloadUrl(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const input = CreateDownloadSchema.parse(body);
    return this.files.createDownloadUrl({
      company_id: req.user.company_id,
      actor_user_id: req.user.sub,
      file_id: input.file_id,
    });
  }

  @Post('link')
  @Permissions('FILES_UPLOAD')
  async link(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const input = LinkSchema.parse(body);
    return this.files.linkToEntity({
      company_id: req.user.company_id,
      actor_user_id: req.user.sub,
      ...input,
    });
  }
}


