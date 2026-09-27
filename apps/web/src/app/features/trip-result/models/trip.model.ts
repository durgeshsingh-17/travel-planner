export interface TripPlace {
  id: string;
  slug: string;
  name: string;
  category: string;
  destinationSlug: string;
  /** False when the place has no public page (draft or archived). */
  hasPage: boolean;
  rating?: number | null;
  averageVisitMinutes?: number | null;
  estimatedCost?: number | null;
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
  durationMinutes?: number | null;
  /** The traveller changed this stop by hand. */
  isUserEdited?: boolean;
  /** Opening-hours problem for this visit, e.g. "Closed on Mondays". */
  warning?: string | null;
  latitude?: number | null;
  longitude?: number | null;
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
  /** Where the night is spent: the destination or a halt on a long drive. */
  overnightLocation?: string | null;
  estimatedDistanceKm?: number | null;
  estimatedCost?: number | null;
  activities: TripActivity[];
}

export interface CostAssumption {
  item: string;
  basis: string;
}

export interface TripCostBreakdown {
  fuel: number;
  tolls: number;
  fares: number;
  localTransport: number;
  stay: number;
  food: number;
  activities: number;
  parking: number;
  miscellaneous: number;
  total: number;
  fuelRequiredLitres: number;
  fuelPricePerLitre: number;
  mileageKmPerLitre: number;
  isIndicative: boolean;
  assumptions: CostAssumption[];
}

export type TravelPace = 'RELAXED' | 'BALANCED' | 'PACKED';
export type PlanCoverage = 'FULL' | 'PARTIAL' | 'NONE';

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
  pace?: TravelPace;
  maxDriveHoursPerDay?: number | null;
  /** How much of the plan comes from curated places. */
  coverage?: PlanCoverage | null;
  /** 'osrm' for real road routing, 'estimate' for straight-line estimates, 'air' for flights. */
  routeProvider?: 'osrm' | 'estimate' | 'air' | null;
  /** The published destination guide the plan used, if any. */
  destinationGuide?: { slug: string; name: string } | null;
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
  pace?: TravelPace;
  maxDriveHoursPerDay?: number;
}

export interface AddActivityRequest {
  placeId?: string;
  title?: string;
  durationMinutes?: number;
  position?: number;
}

export interface UpdateActivityRequest {
  title?: string;
  durationMinutes?: number;
  startTime?: string;
  dayNumber?: number;
  position?: number;
}
