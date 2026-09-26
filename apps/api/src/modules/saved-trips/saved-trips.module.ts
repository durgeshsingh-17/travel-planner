import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { SavedTripsController } from './saved-trips.controller';
import { SavedTripsService } from './saved-trips.service';

@Module({
  imports: [AuthModule],
  controllers: [SavedTripsController],
  providers: [SavedTripsService]
})
export class SavedTripsModule {}
