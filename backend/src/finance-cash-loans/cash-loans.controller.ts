import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../rbac/permissions.guard';
import { Permissions } from '../rbac/permissions.decorator';
import { CashLoansService } from './cash-loans.service';

const SubmitActionSchema = z.enum(['draft', 'approve']).default('draft');

// Helper to normalize date strings (YYYY-MM-DD) to ISO datetime format
const normalizeDate = (v: unknown): unknown => {
  if (v === '' || v === undefined || v === null) return undefined;
  if (typeof v !== 'string') return v;
  const trimmed = v.trim();
  if (!trimmed) return undefined;
  // If it's already a datetime string (contains T), return as is for Zod to validate
  if (trimmed.includes('T')) return trimmed;
  // If it's a date string (YYYY-MM-DD), convert to datetime
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00.000Z`;
  }
  // Return as-is for Zod to validate (will fail if invalid)
  return trimmed;
};

const DateRangeSchema = z.object({
  date_from: z.preprocess(normalizeDate, z.string().datetime().optional()),
  date_to: z.preprocess(normalizeDate, z.string().datetime().optional()),
});

const ListEmployeesSchema = DateRangeSchema.extend({
  q: z.preprocess((v) => (v === '' ? undefined : v), z.string().min(1).optional()),
  status: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['balanced', 'unbalanced']).optional()),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(200).default(25),
});

const ReceiptSchema = z.object({
  employment_record_id: z.string().uuid(),
  amount: z.number().positive(),
  date: z.string().datetime(),
  attachment_file_id: z.string().uuid().optional().nullable(),
  submit_action: SubmitActionSchema,
});

const LoanSchema = z.object({
  employment_record_id: z.string().uuid(),
  amount: z.number().positive(),
  date: z.string().datetime(),
  reason: z.string().min(2).max(200).optional(),
  supervisor_user_id: z.string().uuid().optional().nullable(),
  submit_action: SubmitActionSchema,
});

const DeductionSchema = z.object({
  employment_record_id: z.string().uuid(),
  amount: z.number().positive(),
  date: z.string().datetime(),
  reason: z.string().min(2).max(200).optional().nullable(),
  submit_action: SubmitActionSchema,
});

const StatusUpdateSchema = z.object({
  submit_action: SubmitActionSchema,
  attachment_file_id: z.string().uuid().optional().nullable(),
});

const HandoverSchema = z.object({
  date: z.string().datetime(),
  expenses: z
    .array(
      z.object({
        statement: z.string().min(2).max(200),
        amount: z.number().positive(),
        receipt_file_id: z.string().uuid().optional().nullable(),
      }),
    )
    .min(1),
  submit_action: SubmitActionSchema,
});

@Controller('finance/cash-loans')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CashLoansController {
  constructor(private readonly svc: CashLoansService) {}

  @Get('stats')
  @Permissions('FIN_CASH_LOANS_READ')
  async stats(@Req() req: Request & { user?: any }, @Query() query: any) {
    const q = DateRangeSchema.parse(query);
    return this.svc.stats(req.user.company_id, req.user.sub, q);
  }

  @Get('employees')
  @Permissions('FIN_CASH_LOANS_READ')
  async listEmployees(@Req() req: Request & { user?: any }, @Query() query: any) {
    const q = ListEmployeesSchema.parse(query);
    return this.svc.listEmployees(req.user.company_id, q);
  }

  @Get('employees/:id')
  @Permissions('FIN_CASH_LOANS_READ')
  async employeeDetail(@Req() req: Request & { user?: any }, @Param('id') id: string, @Query() query: any) {
    const q = DateRangeSchema.parse(query);
    return this.svc.employeeDetail(req.user.company_id, id, q);
  }

  @Get('employees/search')
  @Permissions('FIN_CASH_LOANS_READ')
  async searchEmployees(@Req() req: Request & { user?: any }, @Query('q') q: string) {
    return this.svc.searchEmployees(req.user.company_id, q ?? '');
  }

  @Post('receipts')
  @Permissions('FIN_CASH_LOANS_MANAGE')
  async createReceipt(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const data = ReceiptSchema.parse(body);
    return this.svc.createReceipt(req.user.company_id, req.user.sub, data);
  }

  @Post('loans')
  @Permissions('FIN_CASH_LOANS_MANAGE')
  async createLoan(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const data = LoanSchema.parse(body);
    return this.svc.createLoan(req.user.company_id, req.user.sub, data);
  }

  @Post('deductions')
  @Permissions('FIN_CASH_LOANS_MANAGE')
  async createDeduction(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const data = DeductionSchema.parse(body);
    return this.svc.createDeduction(req.user.company_id, req.user.sub, data);
  }

  @Patch('transactions/:id/status')
  @Permissions('FIN_CASH_LOANS_MANAGE')
  async updateStatus(@Req() req: Request & { user?: any }, @Param('id') id: string, @Body() body: unknown) {
    const data = StatusUpdateSchema.parse(body);
    return this.svc.updateTransactionStatus(req.user.company_id, req.user.sub, id, data.submit_action, data.attachment_file_id);
  }

  @Post('handover')
  @Permissions('FIN_CASH_LOANS_MANAGE')
  async handover(@Req() req: Request & { user?: any }, @Body() body: unknown) {
    const data = HandoverSchema.parse(body);
    return this.svc.handover(req.user.company_id, req.user.sub, data);
  }
}

