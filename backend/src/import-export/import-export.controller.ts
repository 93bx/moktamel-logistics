import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { ImportExportService } from './import-export.service';

const ExportSchema = z.object({
  entity_type: z.enum(['RECRUITMENT_CANDIDATE', 'EMPLOYMENT_RECORD']),
  filters: z.record(z.string(), z.unknown()).optional(),
});

const ImportSchema = z.object({
  entity_type: z.enum(['RECRUITMENT_CANDIDATE', 'EMPLOYMENT_RECORD']),
  file_id: z.string().uuid(),
});

@Controller('import-export')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ImportExportController {
  constructor(private readonly svc: ImportExportService) {}

  @Post('export')
  @Permissions('HR_RECRUITMENT_EXPORT')
  async export(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const input = ExportSchema.parse(body);
    return this.svc.createExportJob({
      company_id: req.user.company_id,
      actor_user_id: req.user.sub,
      entity_type: input.entity_type,
      filters: input.filters,
    });
  }

  @Post('import')
  @Permissions('HR_RECRUITMENT_IMPORT')
  async import(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const input = ImportSchema.parse(body);
    return this.svc.createImportJob({
      company_id: req.user.company_id,
      actor_user_id: req.user.sub,
      entity_type: input.entity_type,
      file_id: input.file_id,
    });
  }

  @Get('jobs')
  @Permissions('HR_RECRUITMENT_READ')
  async jobs(@Req() req: Request & { user?: any }, @Query('type') type?: string) {
    const t = type === 'export' ? 'export' : 'import';
    return this.svc.listJobs(req.user.company_id, t);
  }
}


