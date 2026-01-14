import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

type AssignmentInput = {
  employment_record_id: string;
  receive_date: string;
  assets: Array<{
    asset_id?: string;
    type: string;
    name?: string;
    price?: number;
    vehicle_id?: string | null;
  }>;
};

type RecoveryInput = {
  assignment_id: string;
  condition_code: string;
  received: boolean;
  asset_record?: string | null;
  asset_image_file_id?: string | null;
};

type LossReportInput = {
  employment_record_id: string;
  asset_assignment_id: string;
  type_code: string;
  asset_value: number;
  action_code: string;
  installment_count?: number | null;
  notes?: string | null;
};

@Injectable()
export class HrAssetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async getStats(company_id: string) {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

    const [assignedAssets, custodiansList, deductionsAgg, pendingRecoveryList] = await this.prisma.$transaction([
      this.prisma.assetAssignment.findMany({
        where: { company_id, status_code: 'ASSIGNED' },
        select: { asset: { select: { price: true } } },
      }),
      this.prisma.assetAssignment.findMany({
        where: { company_id, status_code: 'ASSIGNED' },
        distinct: ['employment_record_id'],
        select: { employment_record_id: true },
      }),
      this.prisma.assetDeduction.aggregate({
        where: {
          company_id,
          status_code: 'DEDUCTED',
          deducted_at: { gte: startOfMonth, lt: nextMonth },
        },
        _sum: { amount: true },
      }),
      this.prisma.assetAssignment.findMany({
        where: {
          company_id,
          status_code: 'ASSIGNED',
          employment_record: {
            contract_end_at: { not: null, lt: now },
          },
        },
        distinct: ['employment_record_id'],
        select: { employment_record_id: true },
      }),
    ]);

    const assetsValue = assignedAssets.reduce((sum, a) => sum + Number(a.asset.price), 0);
    const custodians = custodiansList.length;
    const deductions = Number(deductionsAgg._sum.amount ?? 0);
    const pendingRecovery = pendingRecoveryList.length;

    return {
      assetsValue,
      custodians,
      deductions,
      pendingRecovery,
    };
  }

  async list(company_id: string, input: { page: number; page_size: number; q?: string; employment_record_id?: string }) {
    const whereEmployment: any = { company_id, deleted_at: null };
    if (input.q) {
      whereEmployment.OR = [
        { employee_no: { contains: input.q, mode: 'insensitive' } },
        {
          recruitment_candidate: {
            OR: [
              { full_name_ar: { contains: input.q, mode: 'insensitive' } },
              { full_name_en: { contains: input.q, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }
    if ((input as any).employment_record_id) {
      whereEmployment.id = (input as any).employment_record_id;
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.employmentRecord.findMany({
        where: {
          ...whereEmployment,
          assets: { some: {} },
        },
        orderBy: { created_at: 'desc' },
        skip: (input.page - 1) * input.page_size,
        take: input.page_size,
        select: {
          id: true,
          employee_no: true,
          recruitment_candidate: { select: { full_name_ar: true, full_name_en: true, passport_no: true, nationality: true } },
          assets: {
            select: {
              id: true,
              status_code: true,
              receive_date: true,
              condition_code: true,
              asset: { select: { id: true, type: true, name: true, price: true, vehicle_id: true } },
              created_at: true,
            },
          },
          contract_end_at: true,
        },
      }),
      this.prisma.employmentRecord.count({
        where: {
          ...whereEmployment,
          assets: { some: {} },
        },
      }),
    ]);

    return { items, total, page: input.page, page_size: input.page_size };
  }

  async getEmployeeAssets(company_id: string, employment_record_id: string) {
    const record = await this.prisma.employmentRecord.findFirst({
      where: { id: employment_record_id, company_id, deleted_at: null },
      select: {
        id: true,
        recruitment_candidate: { select: { full_name_ar: true, full_name_en: true } },
        assets: {
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            status_code: true,
            condition_code: true,
            receive_date: true,
            recovered_at: true,
            asset_record: true,
            asset_image_file_id: true,
            asset: { select: { id: true, type: true, name: true, price: true, vehicle_id: true } },
          },
        },
      },
    });
    if (!record) throw new NotFoundException('Employment record not found');
    return record;
  }

  async createAssignment(company_id: string, actor_user_id: string, input: AssignmentInput) {
    const employment = await this.prisma.employmentRecord.findFirst({
      where: { id: input.employment_record_id, company_id, deleted_at: null },
      select: { id: true, contract_end_at: true },
    });
    if (!employment) throw new NotFoundException('Employment record not found');

    const createdAssignments = [];
    for (const assetInput of input.assets) {
      const assetId =
        assetInput.asset_id ??
        (
          await this.prisma.asset.create({
            data: {
              company_id,
              type: assetInput.type,
              name: assetInput.name ?? assetInput.type,
              price: assetInput.price ?? 0,
              vehicle_id: assetInput.vehicle_id ?? null,
              created_by_user_id: actor_user_id,
            },
            select: { id: true },
          })
        ).id;

      const assignment = await this.prisma.assetAssignment.create({
        data: {
          company_id,
          employment_record_id: input.employment_record_id,
          asset_id: assetId,
          receive_date: new Date(input.receive_date),
          status_code: 'ASSIGNED',
          condition_code: 'GOOD',
          created_by_user_id: actor_user_id,
        },
      });
      createdAssignments.push(assignment);
    }

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'ASSET_ASSIGNMENT_CREATED',
      entity_type: 'ASSET_ASSIGNMENT',
      entity_id: createdAssignments.map((a) => a.id).join(','),
      new_values: input,
    });

    // Notification if contract already ended but assets assigned
    if (employment.contract_end_at && employment.contract_end_at < new Date()) {
      await this.notifications.create({
        company_id,
        type_code: 'HR_ASSETS_PENDING_RECOVERY',
        severity: 'WARNING',
        payload: { employment_record_id: employment.id, assignments: createdAssignments.map((a) => a.id) },
        created_by_user_id: actor_user_id,
      });
    }

    return createdAssignments;
  }

  async recoverAsset(company_id: string, actor_user_id: string, input: RecoveryInput) {
    const assignment = await this.prisma.assetAssignment.findFirst({
      where: { id: input.assignment_id, company_id },
      select: { id: true },
    });
    if (!assignment) throw new NotFoundException('Asset assignment not found');

    const updated = await this.prisma.assetAssignment.update({
      where: { id: input.assignment_id },
      data: {
        status_code: input.received ? 'RECOVERED' : 'ASSIGNED',
        condition_code: input.condition_code,
        recovered_at: input.received ? new Date() : null,
        asset_record: input.asset_record ?? null,
        asset_image_file_id: input.asset_image_file_id ?? null,
      },
    });

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'ASSET_ASSIGNMENT_RECOVERED',
      entity_type: 'ASSET_ASSIGNMENT',
      entity_id: updated.id,
      new_values: updated,
    });

    return updated;
  }

  async createLossReport(company_id: string, actor_user_id: string, input: LossReportInput) {
    const assignment = await this.prisma.assetAssignment.findFirst({
      where: { id: input.asset_assignment_id, company_id },
      select: { id: true, employment_record_id: true },
    });
    if (!assignment) throw new NotFoundException('Asset assignment not found');

    if (input.action_code === 'DEDUCT_IN_INSTALLMENTS' && input.installment_count && input.installment_count > 12) {
      throw new BadRequestException('Installments cannot exceed 12');
    }

    const report = await this.prisma.assetLossReport.create({
      data: {
        company_id,
        asset_assignment_id: input.asset_assignment_id,
        type_code: input.type_code,
        asset_value: input.asset_value,
        action_code: input.action_code,
        installment_count: input.installment_count ?? null,
        approval_status_code: input.action_code === 'ADMINISTRATIVE_EXEMPTION' ? 'PENDING' : null,
        notes: input.notes ?? null,
        created_by_user_id: actor_user_id,
      },
    });

    // Create approval request when administrative exemption is selected
    if (input.action_code === 'ADMINISTRATIVE_EXEMPTION') {
      await this.prisma.approvalRequest.create({
        data: {
          company_id,
          entity_type: 'ASSET_LOSS_REPORT',
          entity_id: report.id,
          requestor_user_id: actor_user_id,
          approver_user_id: null,
          status_code: 'PENDING',
          notes: input.notes ?? null,
          created_by_user_id: actor_user_id,
        },
      });

      await this.notifications.create({
        company_id,
        type_code: 'HR_ASSETS_LOSS_REPORT_APPROVAL_REQUIRED',
        severity: 'WARNING',
        payload: { report_id: report.id, assignment_id: input.asset_assignment_id },
        created_by_user_id: actor_user_id,
      });
    }

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'ASSET_LOSS_REPORT_CREATED',
      entity_type: 'ASSET_LOSS_REPORT',
      entity_id: report.id,
      new_values: input,
    });

    return report;
  }

  async approveLossReport(company_id: string, actor_user_id: string, report_id: string, approved: boolean) {
    const report = await this.prisma.assetLossReport.findFirst({
      where: { id: report_id, company_id },
      select: { id: true, action_code: true, installment_count: true, asset_value: true, asset_assignment_id: true },
    });
    if (!report) throw new NotFoundException('Loss report not found');

    const approvalStatus = approved ? 'APPROVED' : 'REJECTED';

    const updated = await this.prisma.assetLossReport.update({
      where: { id: report_id },
      data: { approval_status_code: approvalStatus, approver_user_id: actor_user_id },
    });

    await this.prisma.approvalRequest.updateMany({
      where: { entity_id: report_id, entity_type: 'ASSET_LOSS_REPORT', company_id },
      data: { status_code: approvalStatus, approver_user_id: actor_user_id },
    });

    // Create deduction entries when approved and deduction is required
    if (approved && (report.action_code === 'DEDUCT_FROM_SALARY' || report.action_code === 'DEDUCT_IN_INSTALLMENTS')) {
      if (report.action_code === 'DEDUCT_FROM_SALARY') {
        await this.prisma.assetDeduction.create({
          data: {
            company_id,
            asset_loss_report_id: report.id,
            employment_record_id: (
              await this.prisma.assetAssignment.findUnique({
                where: { id: report.asset_assignment_id },
                select: { employment_record_id: true },
              })
            )!.employment_record_id,
            amount: report.asset_value,
            status_code: 'PENDING',
          },
        });
      } else if (report.action_code === 'DEDUCT_IN_INSTALLMENTS') {
        const total = report.installment_count ?? 1;
        const perInstallment = Number(report.asset_value) / total;
        const assignment = await this.prisma.assetAssignment.findUnique({
          where: { id: report.asset_assignment_id },
          select: { employment_record_id: true },
        });
        for (let i = 1; i <= total; i++) {
          await this.prisma.assetDeduction.create({
            data: {
              company_id,
              asset_loss_report_id: report.id,
              employment_record_id: assignment!.employment_record_id,
              amount: perInstallment,
              installment_number: i,
              total_installments: total,
              status_code: 'PENDING',
            },
          });
        }
      }
    }

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'ASSET_LOSS_REPORT_APPROVAL',
      entity_type: 'ASSET_LOSS_REPORT',
      entity_id: report_id,
      new_values: { approved },
    });

    await this.notifications.create({
      company_id,
      type_code: approved ? 'HR_ASSETS_LOSS_REPORT_APPROVED' : 'HR_ASSETS_LOSS_REPORT_REJECTED',
      severity: approved ? 'INFO' : 'WARNING',
      payload: { report_id, approved },
      created_by_user_id: actor_user_id,
    });

    return updated;
  }

  async get(company_id: string, id: string) {
    const assignment = await this.prisma.assetAssignment.findFirst({
      where: { id, company_id },
      select: {
        id: true,
        employment_record_id: true,
        asset_id: true,
        status_code: true,
        condition_code: true,
        receive_date: true,
        recovered_at: true,
        asset_record: true,
        asset_image_file_id: true,
        asset: { select: { id: true, type: true, name: true, price: true, vehicle_id: true } },
        employment_record: {
          select: {
            id: true,
            employee_no: true,
            recruitment_candidate: { select: { full_name_ar: true, full_name_en: true } },
          },
        },
      },
    });
    if (!assignment) throw new NotFoundException('Asset assignment not found');
    return assignment;
  }

  async update(company_id: string, actor_user_id: string, id: string, data: Partial<AssignmentInput>) {
    const assignment = await this.prisma.assetAssignment.findFirst({
      where: { id, company_id },
      select: { id: true },
    });
    if (!assignment) throw new NotFoundException('Asset assignment not found');

    const updated = await this.prisma.assetAssignment.update({
      where: { id },
      data: {
        condition_code: (data as any).condition_code ?? undefined,
        status_code: (data as any).status_code ?? undefined,
        receive_date: (data as any).receive_date ? new Date((data as any).receive_date) : undefined,
        asset_record: (data as any).asset_record ?? undefined,
      },
    });

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'ASSET_ASSIGNMENT_UPDATED',
      entity_type: 'ASSET_ASSIGNMENT',
      entity_id: id,
      new_values: data,
    });

    return updated;
  }

  async searchEmployees(company_id: string, q: string) {
    const trimmed = q.trim();
    if (trimmed.length < 1) return [];
    return this.prisma.employmentRecord.findMany({
      where: {
        company_id,
        deleted_at: null,
        OR: [
          { employee_no: { contains: trimmed, mode: 'insensitive' } },
          {
            recruitment_candidate: {
              OR: [
                { full_name_ar: { contains: trimmed, mode: 'insensitive' } },
                { full_name_en: { contains: trimmed, mode: 'insensitive' } },
              ],
            },
          },
        ],
      },
      take: 20,
      select: {
        id: true,
        employee_no: true,
        recruitment_candidate: { select: { full_name_ar: true, full_name_en: true } },
      },
    });
  }

  async fleetVehiclesStub() {
    return [];
  }
}


