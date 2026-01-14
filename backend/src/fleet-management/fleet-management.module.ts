import { Module } from '@nestjs/common';
import { FleetManagementController } from './fleet-management.controller';
import { FleetManagementService } from './fleet-management.service';

@Module({
  controllers: [FleetManagementController],
  providers: [FleetManagementService],
  exports: [FleetManagementService],
})
export class FleetManagementModule {}

