import { Module } from '@nestjs/common';

import { DestinationsController } from './destinations.controller';
import { DestinationsService } from './destinations.service';
import { PackagesModule } from '../packages/packages.module';

@Module({
  imports: [PackagesModule],
  controllers: [DestinationsController],
  providers: [DestinationsService]
})
export class DestinationsModule {}
