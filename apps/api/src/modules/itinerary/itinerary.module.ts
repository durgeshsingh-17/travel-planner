import { Module } from '@nestjs/common';

import { ITINERARY_GENERATOR } from './contracts/itinerary-generator.contract';
import { MockItineraryGenerator } from './generators/mock-itinerary.generator';
import { TripCostService } from './services/trip-cost.service';
import { TripDistanceService } from './services/trip-distance.service';

@Module({
  providers: [
    TripDistanceService,
    TripCostService,
    MockItineraryGenerator,
    {
      provide: ITINERARY_GENERATOR,
      useExisting: MockItineraryGenerator
    }
  ],
  exports: [ITINERARY_GENERATOR, TripCostService, TripDistanceService]
})
export class ItineraryModule {}
