import { Module } from '@nestjs/common';

import { AdminContentController } from './admin-content.controller';
import { AdminContentService } from './admin-content.service';
import { AdminMediaController } from './admin-media.controller';
import { AdminMediaService } from './admin-media.service';
import { AdminSystemController } from './admin-system.controller';
import { AdminUsersService } from './admin-users.service';
import { ContentModule } from '../content/content.module';
import { ImportService } from './import.service';

@Module({
  imports: [ContentModule],
  controllers: [AdminContentController, AdminMediaController, AdminSystemController],
  providers: [AdminContentService, AdminMediaService, AdminUsersService, ImportService]
})
export class AdminModule {}
