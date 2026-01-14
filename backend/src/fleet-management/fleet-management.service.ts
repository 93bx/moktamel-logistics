import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FleetManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly analytics: AnalyticsService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(company_id: string, input: { q?: string; status_code?: string; type_code?: string; page: number; page_size: number }) {
    const where: any = { company_id };
    if (input.status_code) where.status_code = input.status_code;
    if (input.type_code) where.type_code = input.type_code;
    if (input.q) {
      where.OR = [
        { license_plate: { contains: input.q, mode: 'insensitive' } },
        { model: { contains: input.q, mode: 'insensitive' } },
        { current_driver: { full_name_ar: { contains: input.q, mode: 'insensitive' } } },
        { current_driver: { full_name_en: { contains: input.q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (input.page - 1) * input.page_size,
        take: input.page_size,
        include: {
          current_driver: true,
          documents: true,
        },
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return { items, total, page: input.page, page_size: input.page_size };
  }

  async getStats(company_id: string) {
    const now = new Date();
    const expiryThreshold = new Date(now.getTime() + 40 * 24 * 60 * 60 * 1000);

    const [
      totalFleet,
      onDuty,
      idle,
      inWorkshop,
      nearExpiry,
    ] = await this.prisma.$transaction([
      this.prisma.vehicle.count({ where: { company_id } }),
      this.prisma.vehicle.count({ where: { company_id, status_code: 'ACTIVE' } }),
      this.prisma.vehicle.count({ where: { company_id, status_code: 'AVAILABLE' } }),
      this.prisma.vehicle.count({ where: { company_id, status_code: 'MAINTENANCE' } }),
      this.prisma.vehicle.count({
        where: {
          company_id,
          documents: {
            some: {
              expiry_date: { lte: expiryThreshold },
            },
          },
        },
      }),
    ]);

    return { totalFleet, onDuty, idle, inWorkshop, nearExpiry };
  }

  async searchEmployees(company_id: string, q: string) {
    return this.prisma.employmentRecord.findMany({
      where: {
        company_id,
        deleted_at: null,
        status_code: 'EMPLOYMENT_STATUS_ACTIVE',
        OR: [
          { full_name_ar: { contains: q, mode: 'insensitive' } },
          { full_name_en: { contains: q, mode: 'insensitive' } },
          { employee_code: { contains: q, mode: 'insensitive' } },
          { iqama_no: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        full_name_ar: true,
        full_name_en: true,
        employee_code: true,
        iqama_no: true,
        nationality: true,
        avatar_file_id: true,
      },
      take: 10,
    });
  }

  async get(company_id: string, id: string) {
    const row = await this.prisma.vehicle.findFirst({
      where: { id, company_id },
      include: {
        current_driver: true,
        documents: true,
        maintenance_logs: {
          orderBy: { start_date: 'desc' },
          take: 10,
        },
        assignment_logs: {
          orderBy: { assigned_at: 'desc' },
          take: 10,
          include: {
            employee: true,
          },
        },
      },
    });
    if (!row) throw new NotFoundException();
    return row;
  }

  async create(company_id: string, actor_user_id: string, data: any) {
    if (!data.license_plate || !data.model || !data.type_code) {
      throw new BadRequestException('Missing required fields');
    }

    const created = await this.prisma.vehicle.create({
      data: {
        company_id,
        created_by_user_id: actor_user_id,
        type_code: data.type_code,
        license_plate: data.license_plate,
        model: data.model,
        year: parseInt(data.year),
        vin: data.vin,
        gps_tracker_id: data.gps_tracker_id,
        current_odometer: parseFloat(data.current_odometer || '0'),
        purchase_date: data.purchase_date ? new Date(data.purchase_date) : null,
        purchase_price: data.purchase_price ? parseFloat(data.purchase_price) : null,
        purchase_condition: data.purchase_condition || 'NEW',
        status_code: 'AVAILABLE',
        documents: {
          create: data.documents?.map((doc: any) => ({
            company_id,
            type_code: doc.type_code,
            number: doc.number,
            expiry_date: new Date(doc.expiry_date),
            file_id: doc.file_id,
            issuer: doc.issuer,
          })),
        },
      },
    });

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'FLEET_CREATE',
      entity_type: 'VEHICLE',
      entity_id: created.id,
      new_values: created,
    });

    return created;
  }

  async update(company_id: string, actor_user_id: string, id: string, data: any) {
    const existing = await this.prisma.vehicle.findFirst({
      where: { id, company_id },
      include: { documents: true },
    });
    if (!existing) throw new NotFoundException();

    if (data.documents) {
        await this.prisma.vehicleDocument.deleteMany({ where: { vehicle_id: id } });
    }

    const updated = await this.prisma.vehicle.update({
      where: { id },
      data: {
        type_code: data.type_code ?? undefined,
        license_plate: data.license_plate ?? undefined,
        model: data.model ?? undefined,
        year: data.year ? parseInt(data.year) : undefined,
        vin: data.vin ?? undefined,
        gps_tracker_id: data.gps_tracker_id ?? undefined,
        current_odometer: data.current_odometer ? parseFloat(data.current_odometer) : undefined,
        purchase_date: data.purchase_date ? new Date(data.purchase_date) : undefined,
        purchase_price: data.purchase_price ? parseFloat(data.purchase_price) : undefined,
        purchase_condition: data.purchase_condition ?? undefined,
        documents: data.documents ? {
          create: data.documents.map((doc: any) => ({
            company_id,
            type_code: doc.type_code,
            number: doc.number,
            expiry_date: new Date(doc.expiry_date),
            file_id: doc.file_id,
            issuer: doc.issuer,
          })),
        } : undefined,
      },
    });

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'FLEET_UPDATE',
      entity_type: 'VEHICLE',
      entity_id: updated.id,
      old_values: existing,
      new_values: updated,
    });

    return updated;
  }

  async remove(company_id: string, actor_user_id: string, id: string) {
    const existing = await this.prisma.vehicle.findFirst({
        where: { id, company_id },
    });
    if (!existing) throw new NotFoundException();

    if (existing.status_code === 'ACTIVE') {
        throw new BadRequestException('Cannot delete an assigned vehicle. Unassign it first.');
    }

    await this.prisma.vehicle.delete({ where: { id } });

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'FLEET_DELETE',
      entity_type: 'VEHICLE',
      entity_id: id,
      old_values: existing,
    });

    return { ok: true };
  }

  async assign(company_id: string, actor_user_id: string, id: string, data: { employee_id: string; odometer: number }) {
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id, company_id } });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (vehicle.status_code !== 'AVAILABLE') throw new BadRequestException('Vehicle is not available for assignment');

    if (data.odometer < vehicle.current_odometer) {
        throw new BadRequestException('New odometer cannot be less than current odometer');
    }

    const [updatedVehicle] = await this.prisma.$transaction([
      this.prisma.vehicle.update({
        where: { id },
        data: {
          status_code: 'ACTIVE',
          current_driver_id: data.employee_id,
          assigned_at: new Date(),
          idle_since: null,
          current_odometer: data.odometer,
        },
      }),
      this.prisma.vehicleAssignment.create({
        data: {
          company_id,
          vehicle_id: id,
          employee_id: data.employee_id,
          start_odometer: data.odometer,
          assigned_at: new Date(),
        },
      }),
    ]);

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'FLEET_ASSIGN',
      entity_type: 'VEHICLE',
      entity_id: id,
      new_values: { employee_id: data.employee_id, odometer: data.odometer },
    });

    return updatedVehicle;
  }

  async transfer(company_id: string, actor_user_id: string, id: string, data: { employee_id: string; odometer: number }) {
    const vehicle = await this.prisma.vehicle.findFirst({ 
        where: { id, company_id },
        include: { assignment_logs: { where: { unassigned_at: null }, take: 1 } } 
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (vehicle.status_code !== 'ACTIVE') throw new BadRequestException('Vehicle is not currently assigned');

    if (data.odometer < vehicle.current_odometer) {
        throw new BadRequestException('New odometer cannot be less than current odometer');
    }

    const assignment = vehicle.assignment_logs[0];

    const [updatedVehicle] = await this.prisma.$transaction([
      this.prisma.vehicle.update({
        where: { id },
        data: {
          current_driver_id: data.employee_id,
          assigned_at: new Date(),
          current_odometer: data.odometer,
        },
      }),
      ...(assignment ? [
        this.prisma.vehicleAssignment.update({
          where: { id: assignment.id },
          data: {
            unassigned_at: new Date(),
            end_odometer: data.odometer,
          },
        })
      ] : []),
      this.prisma.vehicleAssignment.create({
        data: {
          company_id,
          vehicle_id: id,
          employee_id: data.employee_id,
          start_odometer: data.odometer,
          assigned_at: new Date(),
        },
      }),
    ]);

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'FLEET_TRANSFER',
      entity_type: 'VEHICLE',
      entity_id: id,
      new_values: { from_employee_id: vehicle.current_driver_id, to_employee_id: data.employee_id, odometer: data.odometer },
    });

    return updatedVehicle;
  }

  async unassign(company_id: string, actor_user_id: string, id: string, data: { odometer: number }) {
    const vehicle = await this.prisma.vehicle.findFirst({ 
        where: { id, company_id },
        include: { assignment_logs: { where: { unassigned_at: null }, take: 1 } } 
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (vehicle.status_code !== 'ACTIVE') throw new BadRequestException('Vehicle is not currently assigned');

    if (data.odometer < vehicle.current_odometer) {
        throw new BadRequestException('New odometer cannot be less than current odometer');
    }

    const assignment = vehicle.assignment_logs[0];

    const [updatedVehicle] = await this.prisma.$transaction([
      this.prisma.vehicle.update({
        where: { id },
        data: {
          status_code: 'AVAILABLE',
          current_driver_id: null,
          assigned_at: null,
          idle_since: new Date(),
          current_odometer: data.odometer,
        },
      }),
      ...(assignment ? [
        this.prisma.vehicleAssignment.update({
          where: { id: assignment.id },
          data: {
            unassigned_at: new Date(),
            end_odometer: data.odometer,
          },
        })
      ] : []),
    ]);

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'FLEET_UNASSIGN',
      entity_type: 'VEHICLE',
      entity_id: id,
      new_values: { odometer: data.odometer },
    });

    return updatedVehicle;
  }

  async enterMaintenance(company_id: string, actor_user_id: string, id: string, data: any) {
    const vehicle = await this.prisma.vehicle.findFirst({ 
        where: { id, company_id },
        include: { assignment_logs: { where: { unassigned_at: null }, take: 1 } } 
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const assignment = vehicle.assignment_logs[0];
    const currentOdometer = data.current_odometer || vehicle.current_odometer;

    const [updatedVehicle] = await this.prisma.$transaction([
      this.prisma.vehicle.update({
        where: { id },
        data: {
          status_code: 'MAINTENANCE',
          current_driver_id: null,
          assigned_at: null,
          idle_since: null,
          current_odometer: currentOdometer,
        },
      }),
      ...(assignment ? [
        this.prisma.vehicleAssignment.update({
          where: { id: assignment.id },
          data: {
            unassigned_at: new Date(),
            end_odometer: currentOdometer,
          },
        })
      ] : []),
      this.prisma.vehicleMaintenance.create({
        data: {
          company_id,
          vehicle_id: id,
          workshop_type_code: data.workshop_type_code,
          workshop_name: data.workshop_name,
          start_date: data.start_date ? new Date(data.start_date) : new Date(),
          cost: data.cost ? parseFloat(data.cost) : null,
          invoice_number: data.invoice_number,
          invoice_file_id: data.invoice_file_id,
        },
      }),
    ]);

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'FLEET_MAINTENANCE_ENTER',
      entity_type: 'VEHICLE',
      entity_id: id,
      new_values: data,
    });

    return updatedVehicle;
  }

  async exitMaintenance(company_id: string, actor_user_id: string, id: string, data: any) {
    const vehicle = await this.prisma.vehicle.findFirst({ 
        where: { id, company_id },
        include: { maintenance_logs: { where: { end_date: null }, orderBy: { start_date: 'desc' }, take: 1 } }
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    if (vehicle.status_code !== 'MAINTENANCE') throw new BadRequestException('Vehicle is not in maintenance');

    const maintenance = vehicle.maintenance_logs[0];
    if (!maintenance) throw new BadRequestException('Active maintenance record not found');

    const [updatedVehicle] = await this.prisma.$transaction([
      this.prisma.vehicle.update({
        where: { id },
        data: {
          status_code: 'AVAILABLE',
          idle_since: new Date(),
          current_odometer: data.current_odometer ? parseFloat(data.current_odometer) : undefined,
        },
      }),
      this.prisma.vehicleMaintenance.update({
        where: { id: maintenance.id },
        data: {
          end_date: data.end_date ? new Date(data.end_date) : new Date(),
          cost: data.cost ? parseFloat(data.cost) : maintenance.cost,
          invoice_number: data.invoice_number ?? maintenance.invoice_number,
          invoice_file_id: data.invoice_file_id ?? maintenance.invoice_file_id,
        },
      }),
    ]);

    await this.audit.log({
      company_id,
      actor_user_id,
      action: 'FLEET_MAINTENANCE_EXIT',
      entity_type: 'VEHICLE',
      entity_id: id,
      new_values: data,
    });

    return updatedVehicle;
  }
}

