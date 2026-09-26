import { Module } from '@nestjs/common';

import { AuditService } from './audit.service';
import { LocationsModule } from '../locations/locations.module';
import { ContentWriterService } from './content-writer.service';
import { MediaStorageService } from './media-storage.service';
import { PublicContentController } from './public-content.controller';
import { PublicContentService } from './public-content.service';

@Module({
  imports: [LocationsModule],
  controllers: [PublicContentController],
  providers: [AuditService, ContentWriterService, MediaStorageService, PublicContentService],
  exports: [AuditService, ContentWriterService, MediaStorageService, PublicContentService]
})
export class ContentModule {}
