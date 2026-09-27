import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module';
import { ItineraryModule } from '../itinerary/itinerary.module';
import { SharedTripsController } from './shared-trips.controller';
import { TripEditorController } from './editor/trip-editor.controller';
import { TripEditorService } from './editor/trip-editor.service';
import { TripsController } from './trips.controller';
import { TripsService } from './trips.service';

@Module({
  imports: [AuthModule, ItineraryModule],
  controllers: [TripsController, TripEditorController, SharedTripsController],
  providers: [TripsService, TripEditorService],
  exports: [TripsService]
})
export class TripsModule {}
