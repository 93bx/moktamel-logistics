import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(company_id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: company_id },
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        default_locale: true,
        created_at: true,
        updated_at: true,
      },
    });
    if (!company) throw new NotFoundException();
    return company;
  }

  async updateCurrent(company_id: string, data: { name?: string; timezone?: string; default_locale?: string }) {
    const company = await this.prisma.company.update({
      where: { id: company_id },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        timezone: true,
        default_locale: true,
        created_at: true,
        updated_at: true,
      },
    });
    return company;
  }
}


