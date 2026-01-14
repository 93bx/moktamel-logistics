import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { Prisma } from '@prisma/client';

type EntityType = 'RECRUITMENT_CANDIDATE' | 'EMPLOYMENT_RECORD';

@Injectable()
export class ImportExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async createExportJob(input: {
    company_id: string;
    actor_user_id: string;
    entity_type: EntityType;
    filters?: Record<string, unknown>;
  }) {
    const job = await this.prisma.exportJob.create({
      data: {
        company_id: input.company_id,
        entity_type: input.entity_type,
        status: 'PENDING',
        summary: { filters: (input.filters ?? {}) as Prisma.InputJsonValue } as Prisma.InputJsonValue,
        created_by_user_id: input.actor_user_id,
      },
    });

    await this.audit.log({
      company_id: input.company_id,
      actor_user_id: input.actor_user_id,
      action: 'EXPORT_JOB_CREATED',
      entity_type: 'EXPORT_JOB',
      entity_id: job.id,
      new_values: { entity_type: input.entity_type },
    });

    // Async worker will later generate the file and attach file_id.
    return job;
  }

  async createImportJob(input: {
    company_id: string;
    actor_user_id: string;
    entity_type: EntityType;
    file_id: string;
  }) {
    if (!input.file_id) throw new BadRequestException('file_id is required');
    const job = await this.prisma.importJob.create({
      data: {
        company_id: input.company_id,
        entity_type: input.entity_type,
        status: 'PENDING',
        file_id: input.file_id,
        created_by_user_id: input.actor_user_id,
      },
    });

    await this.audit.log({
      company_id: input.company_id,
      actor_user_id: input.actor_user_id,
      action: 'IMPORT_JOB_CREATED',
      entity_type: 'IMPORT_JOB',
      entity_id: job.id,
      new_values: { entity_type: input.entity_type, file_id: input.file_id },
    });

    // Async worker will later parse/validate/commit.
    return job;
  }

  async listJobs(company_id: string, type: 'import' | 'export') {
    if (type === 'import') {
      return this.prisma.importJob.findMany({
        where: { company_id },
        orderBy: { created_at: 'desc' },
        take: 50,
      });
    }
    return this.prisma.exportJob.findMany({
      where: { company_id },
      orderBy: { created_at: 'desc' },
      take: 50,
    });
  }
}


