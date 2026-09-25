import { Module } from '@nestjs/common';

import { ITINERARY_GENERATOR } from './contracts/itinerary-generator.contract';
import { DatabaseItineraryGenerator } from './generators/database-itinerary.generator';
import { TripCostService } from './services/trip-cost.service';
import { TripDistanceService } from './services/trip-distance.service';

@Module({
  providers: [
    TripDistanceService,
    TripCostService,
    DatabaseItineraryGenerator,
    {
      provide: ITINERARY_GENERATOR,
      useExisting: DatabaseItineraryGenerator
    }
  ],
  exports: [ITINERARY_GENERATOR, TripCostService, TripDistanceService]
})
export class ItineraryModule {}
