import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { FleetManagementService } from './fleet-management.service';

const ListQuerySchema = z.object({
  q: z.preprocess((val) => (val === '' ? undefined : val), z.string().min(1).optional()),
  status_code: z.preprocess((val) => (val === '' ? undefined : val), z.string().min(2).optional()),
  type_code: z.preprocess((val) => (val === '' ? undefined : val), z.string().optional()),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(25),
});

const VehicleCreateSchema = z.object({
  type_code: z.string().min(1),
  license_plate: z.string().min(1),
  model: z.string().min(1),
  year: z.union([z.number(), z.string()]),
  vin: z.string().min(1),
  gps_tracker_id: z.string().optional(),
  current_odometer: z.union([z.number(), z.string()]).optional(),
  purchase_date: z.string().optional(),
  purchase_price: z.union([z.number(), z.string()]).optional(),
  purchase_condition: z.string().optional(),
  documents: z.array(z.object({
    type_code: z.string(),
    number: z.string().optional(),
    expiry_date: z.string(),
    file_id: z.string().uuid().optional(),
    issuer: z.string().optional(),
  })).optional(),
});

const VehicleUpdateSchema = VehicleCreateSchema.partial();

@Controller('fleet')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FleetManagementController {
  constructor(private readonly svc: FleetManagementService) {}

  @Get('stats')
  @Permissions('FLEET_READ')
  async stats(@Req() req: Request & { user?: any }) {
    return this.svc.getStats(req.user.company_id);
  }

  @Get('employees/search')
  @Permissions('FLEET_READ')
  async employeeSearch(@Req() req: Request & { user?: any }, @Query('q') q: string) {
    return this.svc.searchEmployees(req.user.company_id, q ?? '');
  }

  @Get('vehicles')
  @Permissions('FLEET_READ')
  async list(@Req() req: Request & { user?: any }, @Query() query: any) {
    const q = ListQuerySchema.parse(query);
    return this.svc.list(req.user.company_id, q);
  }

  @Get('vehicles/:id')
  @Permissions('FLEET_READ')
  async get(@Req() req: Request & { user?: any }, @Param('id') id: string) {
    return this.svc.get(req.user.company_id, id);
  }

  @Post('vehicles')
  @Permissions('FLEET_CREATE')
  async create(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const data = VehicleCreateSchema.parse(body);
    return this.svc.create(req.user.company_id, req.user.sub, data);
  }

  @Patch('vehicles/:id')
  @Permissions('FLEET_UPDATE')
  async update(@Req() req: Request & { user?: any }, @Param('id') id: string, @Body() body: unknown) {
    const data = VehicleUpdateSchema.parse(body);
    return this.svc.update(req.user.company_id, req.user.sub, id, data);
  }

  @Delete('vehicles/:id')
  @Permissions('FLEET_DELETE')
  async remove(@Req() req: Request & { user?: any }, @Param('id') id: string) {
    return this.svc.remove(req.user.company_id, req.user.sub, id);
  }

  @Post('vehicles/:id/assign')
  @Permissions('FLEET_ASSIGN')
  async assign(@Req() req: Request & { user?: any }, @Param('id') id: string, @Body() body: any) {
    return this.svc.assign(req.user.company_id, req.user.sub, id, body);
  }

  @Post('vehicles/:id/transfer')
  @Permissions('FLEET_ASSIGN')
  async transfer(@Req() req: Request & { user?: any }, @Param('id') id: string, @Body() body: any) {
    return this.svc.transfer(req.user.company_id, req.user.sub, id, body);
  }

  @Post('vehicles/:id/unassign')
  @Permissions('FLEET_ASSIGN')
  async unassign(@Req() req: Request & { user?: any }, @Param('id') id: string, @Body() body: any) {
    return this.svc.unassign(req.user.company_id, req.user.sub, id, body);
  }

  @Post('vehicles/:id/maintenance/enter')
  @Permissions('FLEET_MAINTENANCE')
  async enterMaintenance(@Req() req: Request & { user?: any }, @Param('id') id: string, @Body() body: any) {
    return this.svc.enterMaintenance(req.user.company_id, req.user.sub, id, body);
  }

  @Post('vehicles/:id/maintenance/exit')
  @Permissions('FLEET_MAINTENANCE')
  async exitMaintenance(@Req() req: Request & { user?: any }, @Param('id') id: string, @Body() body: any) {
    return this.svc.exitMaintenance(req.user.company_id, req.user.sub, id, body);
  }
}

