import {
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireAnyOf } from '../rbac/require-any-of.decorator';
import { RequireAnyOfGuard } from '../rbac/require-any-of.guard';
import { DocumentsService } from './documents.service';

const DOCUMENTS_ANY_OF_PERMISSIONS = [
  'HR_EMPLOYMENT_READ',
  'FLEET_READ',
  'HR_RECRUITMENT_READ',
  'PAYROLL_VIEW',
  'FIN_CASH_LOANS_READ',
  'HR_ASSETS_READ',
] as const;

@Controller('documents')
@UseGuards(JwtAuthGuard, RequireAnyOfGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get('stats')
  @RequireAnyOf(...DOCUMENTS_ANY_OF_PERMISSIONS)
  async stats(
    @Req() req: Request & { user?: { sub: string; company_id: string } },
  ) {
    const company_id = req.user!.company_id;
    const userPermissionKeys = await this.documentsService.getUserPermissions(
      req.user!.sub,
      company_id,
    );
    return this.documentsService.getStats(company_id, userPermissionKeys);
  }

  @Get('list')
  @RequireAnyOf(...DOCUMENTS_ANY_OF_PERMISSIONS)
  async list(
    @Req() req: Request & { user?: { sub: string; company_id: string } },
    @Query('tab') tab: string,
    @Query('page') page: string,
    @Query('page_size') page_size: string,
    @Query('q') q?: string,
  ) {
    const company_id = req.user!.company_id;
    const userPermissionKeys = await this.documentsService.getUserPermissions(
      req.user!.sub,
      company_id,
    );
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const pageSize = Math.min(
      200,
      Math.max(1, parseInt(page_size || '25', 10) || 25),
    );
    return this.documentsService.list(company_id, userPermissionKeys, {
      tab: tab || 'near_expiry',
      page: pageNum,
      page_size: pageSize,
      q: q && q.trim() ? q.trim() : undefined,
    });
  }

  @Delete('items/:id')
  async delete(
    @Req() req: Request & { user?: { sub: string; company_id: string } },
    @Param('id') id: string,
  ) {
    const company_id = req.user!.company_id;
    const user_id = req.user!.sub;
    const userPermissionKeys = await this.documentsService.getUserPermissions(
      user_id,
      company_id,
    );
    await this.documentsService.deleteDocument(
      company_id,
      user_id,
      userPermissionKeys,
      id,
    );
    return { success: true };
  }
}
