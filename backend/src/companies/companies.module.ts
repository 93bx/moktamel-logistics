import { Module } from '@nestjs/common';
import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { PermissionsGuard } from '../rbac/permissions.guard';

@Module({
  controllers: [CompaniesController],
  providers: [CompaniesService, PermissionsGuard],
})
export class CompaniesModule {}


