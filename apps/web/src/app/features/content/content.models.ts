export interface ImageView {
  url: string;
  altText: string;
  width: number | null;
  height: number | null;
  credit: string | null;
  license: string;
}

export interface TagView {
  slug: string;
  name: string;
  kind: 'THEME' | 'ACTIVITY' | 'AUDIENCE' | 'SEASON';
}

export interface DestinationCard {
  id: string;
  slug: string;
  name: string;
  state: string;
  tagline: string | null;
  shortDescription: string;
  rating: number | null;
  idealDaysMin: number | null;
  idealDaysMax: number | null;
  budgetPerDayMin: number | null;
  budgetPerDayMax: number | null;
  bestTimeToVisit: string | null;
  bestMonths: number[];
  latitude: number;
  longitude: number;
  cover: ImageView | null;
  tags: TagView[];
}

export interface PlaceCard {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  rankInDestination: number | null;
  rating: number | null;
  timeRequiredMinMinutes: number | null;
  timeRequiredMaxMinutes: number | null;
  isFree: boolean;
  entryFeeIndian: number | null;
  latitude: number;
  longitude: number;
  destination: { slug: string; name: string };
  cover: ImageView | null;
  tags: TagView[];
  distanceKm?: number;
}

export type MonthRating = 'GOOD' | 'OK' | 'AVOID';

export interface MonthInfo {
  month: number;
  rating: MonthRating;
  avgMinC: number | null;
  avgMaxC: number | null;
  rainfallMm: number | null;
  notes: string | null;
  events: string[];
}

export interface HowToReach {
  mode: 'ROAD' | 'TRAIN' | 'AIR' | 'BUS';
  hubName: string;
  distanceKm: number | null;
  durationMinutes: number | null;
  costMin: number | null;
  costMax: number | null;
  summary: string;
}

export interface Faq {
  question: string;
  answer: string;
}

export interface DestinationDetail extends Omit<DestinationCard, 'bestMonths'> {
  country: string;
  overview: string | null;
  altitudeM: number | null;
  nearestAirport: string | null;
  nearestAirportKm: number | null;
  nearestRailway: string | null;
  nearestRailwayKm: number | null;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
  gallery: ImageView[];
  months: MonthInfo[];
  howToReach: HowToReach[];
  faqs: Faq[];
  places: PlaceCard[];
  placeCount: number;
  similar: DestinationCard[];
}

export type OpenState =
  | { status: 'UNKNOWN' }
  | { status: 'CLOSED_TODAY' }
  | { status: 'OPEN'; closesAt: string }
  | { status: 'OPENS_LATER'; opensAt: string }
  | { status: 'CLOSED_NOW' };

export interface PlaceTiming {
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}

export interface PlaceDetail {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  overview: string | null;
  latitude: number;
  longitude: number;
  rankInDestination: number | null;
  placeCount: number;
  rating: number | null;
  timeRequiredMinMinutes: number | null;
  timeRequiredMaxMinutes: number | null;
  isFree: boolean;
  entryFeeIndian: number | null;
  entryFeeChild: number | null;
  entryFeeForeigner: number | null;
  feeNotes: string | null;
  bestTimeOfDay: string | null;
  tips: string[];
  address: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
  destination: { id: string; slug: string; name: string; state: string };
  gallery: ImageView[];
  tags: TagView[];
  timings: PlaceTiming[];
  openNow: OpenState;
  faqs: Faq[];
  nearby: PlaceCard[];
}

export interface CollectionCard {
  id: string;
  slug: string;
  title: string;
  intro: string;
  isFeatured: boolean;
  cover: ImageView | null;
  itemCount: number;
}

export interface CollectionDetail {
  id: string;
  slug: string;
  title: string;
  intro: string;
  body: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
  cover: ImageView | null;
  gallery: ImageView[];
  items: Array<{ blurb: string | null; destination: DestinationCard | null; place: PlaceCard | null }>;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface DestinationFacets {
  states: Array<{ value: string; count: number }>;
  tags: Array<TagView & { count: number }>;
  months: Array<{ month: number; count: number }>;
}

export interface HomeContent {
  month: number;
  featured: DestinationCard[];
  trending: DestinationCard[];
  collections: CollectionCard[];
  themes: Array<TagView & { description: string | null; destinationCount: number }>;
  stats: { destinations: number; places: number; collections: number; tripsPlanned: number };
}

export interface SearchSuggestions {
  destinations: Array<{ slug: string; name: string; state: string }>;
  places: Array<{ slug: string; name: string; category: string; destination: { slug: string; name: string } }>;
  collections: Array<{ slug: string; title: string }>;
  locations: Array<{ id: string; slug: string; name: string; state: string; aliases: string[] }>;
}

export interface DestinationQuery {
  q?: string;
  state?: string;
  tag?: string[];
  month?: number;
  days?: number;
  budgetMax?: number;
  sort?: 'popular' | 'name';
  page?: number;
  pageSize?: number;
}
