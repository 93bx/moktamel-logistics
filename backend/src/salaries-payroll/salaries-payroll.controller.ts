import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { SalariesPayrollService } from './salaries-payroll.service';
import { ListSalariesQueryDto, CreateSalaryReceiptDto } from './dto/salaries-payroll.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { Permissions } from '../rbac/permissions.decorator';

@Controller('salaries-payroll')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalariesPayrollController {
  constructor(private readonly salariesPayrollService: SalariesPayrollService) {}

  @Get()
  @Permissions('PAYROLL_VIEW')
  async getList(@Req() req: Request & { user?: any }, @Query() query: ListSalariesQueryDto) {
    return this.salariesPayrollService.getList(req.user.company_id, query);
  }

  @Get(':id')
  @Permissions('PAYROLL_VIEW')
  async getDetail(@Req() req: Request & { user?: any }, @Param('id') id: string) {
    return this.salariesPayrollService.getEmployeeDetail(req.user.company_id, id);
  }

  @Post(':id/receipt')
  @Permissions('PAYROLL_EDIT')
  async createReceipt(
    @Req() req: Request & { user?: any },
    @Param('id') id: string,
    @Body() data: CreateSalaryReceiptDto,
  ) {
    return this.salariesPayrollService.createReceipt(req.user.company_id, req.user.sub, id, data);
  }
}

