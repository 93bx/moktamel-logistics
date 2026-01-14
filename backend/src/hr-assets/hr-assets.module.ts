import { Module } from '@nestjs/common';
import { HrAssetsController } from './hr-assets.controller';
import { HrAssetsService } from './hr-assets.service';

@Module({
  controllers: [HrAssetsController],
  providers: [HrAssetsService],
})
export class HrAssetsModule {}


