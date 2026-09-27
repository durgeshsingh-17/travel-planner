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
  packages: PackageCard[];
  reviewSummary: ReviewSummary;
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
  reviewSummary: ReviewSummary;
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
  packages: PackageCard[];
  stats: { destinations: number; places: number; collections: number; tripsPlanned: number };
}

export interface SearchSuggestions {
  destinations: Array<{ slug: string; name: string; state: string }>;
  places: Array<{ slug: string; name: string; category: string; destination: { slug: string; name: string } }>;
  packages: Array<{ slug: string; title: string; durationDays: number; durationNights: number }>;
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

// ───────────────────────── Packages ─────────────────────────

export type TierLevel = 'BUDGET' | 'MID_RANGE' | 'PREMIUM' | 'LUXURY';

export interface PackageCard {
  id: string;
  slug: string;
  title: string;
  summary: string;
  durationDays: number;
  durationNights: number;
  fromPrice: number | null;
  compareAtPrice: number | null;
  priceBasis: string;
  rating: number | null;
  reviewCount: number;
  route: Array<{ slug: string; name: string; state: string; nights: number }>;
  tiers: TierLevel[];
  highlights: string[];
  cover: ImageView | null;
  tags: TagView[];
}

export interface PackageStay {
  destination: { slug: string; name: string };
  nights: number;
  hotelName: string;
  orSimilar: boolean;
  hotelCategory: number | null;
  roomType: string | null;
  mealPlan: 'EP' | 'CP' | 'MAP' | 'AP';
}

export interface PackageTier {
  level: TierLevel;
  pricePerPerson: number;
  compareAtPrice: number | null;
  childPrice: number | null;
  singleSupplement: number | null;
  taxesIncluded: boolean;
  hotelCategory: number | null;
  transportNote: string | null;
  stays: PackageStay[];
}

export interface ReviewSummary {
  average: number | null;
  count: number;
}

export interface PackageDetail {
  id: string;
  slug: string;
  title: string;
  summary: string;
  overview: string | null;
  durationDays: number;
  durationNights: number;
  fromPrice: number | null;
  priceBasis: string;
  availableMonths: number[];
  minPax: number;
  maxPax: number | null;
  isCustomizable: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  updatedAt: string;
  startLocation: { slug: string; name: string; state: string } | null;
  route: Array<{ slug: string; name: string; state: string; nights: number; hasGuide: boolean }>;
  tiers: PackageTier[];
  days: Array<{
    dayNumber: number;
    title: string;
    description: string;
    overnight: { slug: string; name: string } | null;
    mealsIncluded: string[];
    places: Array<{ slug: string; name: string; category: string; destinationSlug: string; hasPage: boolean }>;
  }>;
  inclusions: string[];
  exclusions: string[];
  policies: Array<{ kind: 'CANCELLATION' | 'PAYMENT' | 'CHILD' | 'GENERAL'; body: string }>;
  faqs: Faq[];
  tags: TagView[];
  gallery: ImageView[];
  reviewSummary: ReviewSummary;
  similar: PackageCard[];
}

export interface PackageFacets {
  destinations: Array<{ slug: string; name: string; state: string; count: number }>;
  tags: Array<TagView & { count: number }>;
  price: { min: number | null; max: number | null };
  nights: { min: number | null; max: number | null };
}

export interface PackageQuery {
  q?: string;
  destination?: string;
  state?: string;
  month?: number;
  nightsMin?: number;
  nightsMax?: number;
  tag?: string[];
  priceMin?: number;
  priceMax?: number;
  tier?: TierLevel;
  sort?: 'popular' | 'price_asc' | 'price_desc' | 'duration' | 'rating';
  page?: number;
  pageSize?: number;
}

// ───────────────────────── Reviews ─────────────────────────

export interface ReviewTarget {
  packageSlug?: string;
  destinationSlug?: string;
  placeSlug?: string;
}

export type TravellerType = 'SOLO' | 'COUPLE' | 'FAMILY' | 'FRIENDS' | 'BUSINESS';

export interface PublicReview {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  travelledMonth: string | null;
  travellerType: TravellerType | null;
  isVerified: boolean;
  createdAt: string;
  author: string;
}

export interface ReviewList {
  summary: ReviewSummary & { distribution: Array<{ stars: number; count: number }> };
  items: PublicReview[];
  page: number;
  pageSize: number;
  total: number;
}

export interface OwnReview {
  id: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  moderationNote: string | null;
  rating: number;
  title: string | null;
  body: string;
  travelledMonth: string | null;
  travellerType: TravellerType | null;
  isVerified: boolean;
  createdAt: string;
  target: { type: 'PACKAGE' | 'DESTINATION' | 'PLACE'; name: string; path: string };
}
