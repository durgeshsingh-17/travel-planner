export interface DestinationPlace {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  latitude: number;
  longitude: number;
  averageVisitMinutes?: number | null;
  estimatedCost?: number | null;
  rating?: number | null;
}

export interface Destination {
  id: string;
  name: string;
  slug: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  shortDescription: string;
  heroImageUrl?: string | null;
  bestTimeToVisit?: string | null;
  places?: DestinationPlace[];
}
