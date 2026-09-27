import { PlanCoverage, TravelMode, TravelPace, TripActivityType } from '@prisma/client';

import { RouteLeg } from '../../routing/routing.service';

export interface ItineraryGeneratorInput {
  tripId: string;
  sourceName: string;
  sourceLatitude: number;
  sourceLongitude: number;
  destinationName: string;
  destinationLatitude: number;
  destinationLongitude: number;
  startDate: string;
  endDate: string;
  travellerCount: number;
  travelMode: TravelMode;
  interests: string[];
  preferences: string[];
  pace: TravelPace;
  /** Longest drive per day before an overnight halt; mode default when not set. */
  maxDriveHoursPerDay?: number | null;
  /** Places already used on other days (for regenerating a single day). */
  excludePlaceIds?: string[];
}

export interface GeneratedTripActivity {
  placeId?: string;
  title: string;
  description?: string;
  activityType: TripActivityType;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  latitude?: number;
  longitude?: number;
  estimatedCost?: number;
  distanceFromPreviousKm?: number;
  travelTimeFromPreviousMinutes?: number;
  sortOrder: number;
}

export interface GeneratedTripDay {
  dayNumber: number;
  date: string;
  title: string;
  description?: string;
  overnightLocation?: string;
  estimatedDistanceKm?: number;
  estimatedCost?: number;
  activities: GeneratedTripActivity[];
}

export interface GeneratedTripPlan {
  /** Round-trip travel distance (road, or air for flights). */
  estimatedDistanceKm: number;
  /** Round-trip travel time. */
  estimatedDurationMinutes: number;
  outbound: RouteLeg;
  coverage: PlanCoverage;
  /** Destination guide whose places were used, if one matched. */
  destinationId: string | null;
  /** Entry fees of the planned stops (not meals), for the whole group. */
  activityCost: number;
  days: GeneratedTripDay[];
}

export interface ItineraryGenerator {
  generateTripPlan(input: ItineraryGeneratorInput): Promise<GeneratedTripPlan>;
  /** Re-plans one day without the places in `excludePlaceIds`. */
  generateDay(input: ItineraryGeneratorInput, dayNumber: number): Promise<GeneratedTripDay | null>;
}

export const ITINERARY_GENERATOR = Symbol('ITINERARY_GENERATOR');
export const GENERATOR_VERSION = 'db-v2';
