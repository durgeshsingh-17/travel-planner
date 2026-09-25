import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ItineraryModule } from '../itinerary/itinerary.module';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [AuthModule, ItineraryModule],
  controllers: [TripsController],
  providers: [TripsService]
})
export class TripsModule {}
