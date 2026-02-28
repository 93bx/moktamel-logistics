import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { RequireAnyOfGuard } from '../rbac/require-any-of.guard';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, RequireAnyOfGuard],
})
export class DocumentsModule {}
