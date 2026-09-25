export interface TripActivity {
  id: string;
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
}

export interface TripVehicle {
  id: string;
  brand: string;
  model: string;
  type: string;
  fuelType: string;
  averageMileage?: number | null;
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
  days: TripDay[];
  costBreakdown?: TripCostBreakdown | null;
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
  budget?: number;
  travelMode: string;
  vehicle?: {
    brand?: string;
    model?: string;
    mileage?: number;
  };
  interests: string[];
  preferences?: string[];
  notes?: string;
}
