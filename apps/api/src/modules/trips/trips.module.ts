import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ItineraryModule } from '../itinerary/itinerary.module';
import { SharedTripsController } from './shared-trips.controller';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [AuthModule, ItineraryModule],
  controllers: [TripsController, SharedTripsController],
  providers: [TripsService],
  exports: [TripsService]
})
export class TripsModule {}
