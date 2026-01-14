import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { HrAssetsService } from './hr-assets.service';

const ListQuerySchema = z.object({
  q: z.preprocess((val) => (val === '' ? undefined : val), z.string().min(1).optional()),
  employment_record_id: z.preprocess((val) => (val === '' ? undefined : val), z.string().uuid().optional()),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(25),
});

const AssignmentAssetSchema = z.object({
  asset_id: z.string().uuid().optional(),
  type: z.string().min(2),
  name: z.string().min(1).optional(),
  price: z.number().optional(),
  vehicle_id: z.string().uuid().optional().nullable(),
});

const AssignmentCreateSchema = z.object({
  employment_record_id: z.string().uuid(),
  receive_date: z.string().datetime(),
  assets: z.array(AssignmentAssetSchema).min(1),
});

const RecoverySchema = z.object({
  assignment_id: z.string().uuid(),
  condition_code: z.string().min(2),
  received: z.boolean(),
  asset_record: z.string().optional().nullable(),
  asset_image_file_id: z.string().uuid().optional().nullable(),
});

const LossReportSchema = z.object({
  employment_record_id: z.string().uuid(),
  asset_assignment_id: z.string().uuid(),
  type_code: z.string().min(2),
  asset_value: z.number().min(0),
  action_code: z.enum(['DEDUCT_FROM_SALARY', 'ADMINISTRATIVE_EXEMPTION', 'DEDUCT_IN_INSTALLMENTS']),
  installment_count: z.number().int().min(1).max(12).optional(),
  notes: z.string().optional().nullable(),
});

const ApprovalSchema = z.object({
  approved: z.boolean(),
});

@Controller('hr/assets')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class HrAssetsController {
  constructor(private readonly svc: HrAssetsService) {}

  @Get('stats')
  @Permissions('HR_ASSETS_READ')
  async stats(@Req() req: Request & { user?: any }) {
    return this.svc.getStats(req.user.company_id);
  }

  @Get('assignments')
  @Permissions('HR_ASSETS_READ')
  async list(@Req() req: Request & { user?: any }, @Query() query: any) {
    const q = ListQuerySchema.parse(query);
    return this.svc.list(req.user.company_id, q);
  }

  @Get('assignments/:id')
  @Permissions('HR_ASSETS_READ')
  async get(@Req() req: Request & { user?: any }, @Param('id') id: string) {
    return this.svc.get(req.user.company_id, id);
  }

  @Post('assignments')
  @Permissions('HR_ASSETS_CREATE')
  async create(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const data = AssignmentCreateSchema.parse(body);
    return this.svc.createAssignment(req.user.company_id, req.user.sub, data);
  }

  @Patch('assignments/:id')
  @Permissions('HR_ASSETS_UPDATE')
  async update(@Req() req: Request & { user?: any }, @Param('id') id: string, @Body() body: unknown) {
    const data = AssignmentCreateSchema.partial().parse(body);
    return this.svc.update(req.user.company_id, req.user.sub, id, data);
  }

  @Post('recover')
  @Permissions('HR_ASSETS_UPDATE')
  async recover(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const data = RecoverySchema.parse(body);
    return this.svc.recoverAsset(req.user.company_id, req.user.sub, data);
  }

  @Post('loss-reports')
  @Permissions('HR_ASSETS_CREATE')
  async lossReport(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const data = LossReportSchema.parse(body);
    return this.svc.createLossReport(req.user.company_id, req.user.sub, data);
  }

  @Post('loss-reports/:id/approve')
  @Permissions('HR_ASSETS_APPROVE')
  async approve(@Req() req: Request & { user?: any }, @Param('id') id: string, @Body() body: unknown) {
    const data = ApprovalSchema.parse(body);
    return this.svc.approveLossReport(req.user.company_id, req.user.sub, id, data.approved);
  }

  @Get('employees/search')
  @Permissions('HR_ASSETS_READ')
  async employeeSearch(@Req() req: Request & { user?: any }, @Query('q') q: string) {
    return this.svc.searchEmployees(req.user.company_id, q ?? '');
  }

  @Get('employees/:id/assets')
  @Permissions('HR_ASSETS_READ')
  async employeeAssets(@Req() req: Request & { user?: any }, @Param('id') id: string) {
    return this.svc.getEmployeeAssets(req.user.company_id, id);
  }

  @Get('fleet/vehicles')
  @Permissions('HR_ASSETS_READ')
  async fleetVehicles() {
    return this.svc.fleetVehiclesStub();
  }
}


