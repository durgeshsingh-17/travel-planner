export interface TripPlace {
  id: string;
  destinationId: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  latitude: number;
  longitude: number;
  averageVisitMinutes?: number | null;
  estimatedCost?: number | null;
  openingTime?: string | null;
  closingTime?: string | null;
  rating?: number | null;
}

export interface TripActivity {
  id: string;
  placeId?: string | null;
  place?: TripPlace | null;
  title: string;
  description?: string | null;
  activityType: string;
  startTime?: string | null;
  endTime?: string | null;
  estimatedCost?: number | null;
  distanceFromPreviousKm?: number | null;
  travelTimeFromPreviousMinutes?: number | null;
  sortOrder: number;
}

export interface TripDay {
  id: string;
  dayNumber: number;
  date: string;
  title: string;
  description?: string | null;
  estimatedDistanceKm?: number | null;
  estimatedCost?: number | null;
  activities: TripActivity[];
}

export interface TripCostBreakdown {
  fuel: number;
  tolls: number;
  stay: number;
  food: number;
  activities: number;
  parking: number;
  miscellaneous: number;
  total: number;
  fuelRequiredLitres: number;
  fuelPricePerLitre: number;
  mileageKmPerLitre: number;
}

export interface TripVehicle {
  id: string;
  brand: string;
  model: string;
  type: string;
  fuelType: string;
  averageMileage?: number | null;
}

export interface TripUserVehicle {
  id: string;
  nickname?: string | null;
  customMileage?: number | null;
  registrationNumber?: string | null;
}

export type TripVisibility = 'PRIVATE' | 'UNLISTED';

export interface TripTraveller {
  id: string;
  fullName: string;
  age: number;
  gender: string;
  sortOrder: number;
}

export interface Trip {
  id: string;
  title: string;
  sourceName: string;
  sourceLatitude: number;
  sourceLongitude: number;
  destinationName: string;
  destinationLatitude: number;
  destinationLongitude: number;
  startDate: string;
  endDate: string;
  travellerCount: number;
  /** Omitted from shared (public) trips. */
  travellers?: TripTraveller[];
  travelMode: string;
  budget?: number | null;
  interests: string[];
  preferences: string[];
  notes?: string | null;
  status: string;
  estimatedDistanceKm?: number | null;
  estimatedDurationMinutes?: number | null;
  estimatedTotalCost?: number | null;
  estimatedFuelCost?: number | null;
  vehicle?: TripVehicle | null;
  userVehicle?: TripUserVehicle | null;
  visibility?: TripVisibility;
  shareSlug?: string | null;
  days: TripDay[];
  costBreakdown?: TripCostBreakdown | null;
}

export interface TripSharing {
  id: string;
  visibility: TripVisibility;
  shareSlug: string | null;
}

export interface CreateTripRequest {
  source: {
    name: string;
    latitude: number;
    longitude: number;
  };
  destination: {
    name: string;
    latitude: number;
    longitude: number;
  };
  startDate: string;
  endDate: string;
  travellerCount: number;
  travellers: Array<{
    fullName: string;
    age: number;
    gender: string;
  }>;
  budget?: number;
  travelMode: string;
  userVehicleId?: string;
  interests: string[];
  preferences?: string[];
  notes?: string;
}
