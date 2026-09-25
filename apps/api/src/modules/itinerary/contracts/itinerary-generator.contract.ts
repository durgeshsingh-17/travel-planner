import { TravelMode, TripActivityType } from '@prisma/client';

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
}

export interface GeneratedTripActivity {
  title: string;
  description?: string;
  activityType: TripActivityType;
  startTime?: string;
  endTime?: string;
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
  estimatedDistanceKm?: number;
  estimatedCost?: number;
  activities: GeneratedTripActivity[];
}

export interface GeneratedTripPlan {
  estimatedDistanceKm: number;
  estimatedDurationMinutes: number;
  days: GeneratedTripDay[];
}

export interface ItineraryGenerator {
  generateTripPlan(input: ItineraryGeneratorInput): GeneratedTripPlan;
}

export const ITINERARY_GENERATOR = Symbol('ITINERARY_GENERATOR');
