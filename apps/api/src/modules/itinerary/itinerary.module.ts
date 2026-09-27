import { Module } from '@nestjs/common';

import { DatabaseItineraryGenerator } from './generators/database-itinerary.generator';
import { ITINERARY_GENERATOR } from './contracts/itinerary-generator.contract';
import { RoutingModule } from '../routing/routing.module';
import { TripCostService } from './services/trip-cost.service';

@Module({
  imports: [RoutingModule],
  providers: [
    TripCostService,
    DatabaseItineraryGenerator,
    {
      provide: ITINERARY_GENERATOR,
      useExisting: DatabaseItineraryGenerator
    }
  ],
  exports: [ITINERARY_GENERATOR, TripCostService, RoutingModule]
})
export class ItineraryModule {}
