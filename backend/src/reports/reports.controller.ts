import {
  Controller,
  Get,
  Query,
  Req,
  StreamableFile,
  UseGuards,
  Param,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('catalog')
  @Permissions('REPORTS_READ')
  catalog() {
    return this.reportsService.getCatalog();
  }

  @Get(':key/data')
  @Permissions('REPORTS_READ')
  async data(
    @Req() req: Request & { user?: any },
    @Param('key') key: string,
    @Query() query: Record<string, unknown>,
  ) {
    return this.reportsService.getReportData(req.user.company_id, key, query);
  }

  @Get(':key/export')
  @Permissions('REPORTS_READ')
  async export(
    @Req() req: Request & { user?: any },
    @Param('key') key: string,
    @Query() query: Record<string, unknown>,
    @Query('format') format?: string,
    @Query('locale') locale = 'en',
  ) {
    const normalizedFormat: 'xlsx' | 'pdf' =
      format === 'pdf' ? 'pdf' : 'xlsx';
    const { buffer, filename, contentType } =
      await this.reportsService.exportReport(
        req.user.company_id,
        req.user.sub,
        key,
        normalizedFormat,
        locale,
        query,
      );
    return new StreamableFile(buffer, {
      type: contentType,
      disposition: `attachment; filename="${filename}"`,
    });
  }
}
