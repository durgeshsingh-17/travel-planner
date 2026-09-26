export type ContentStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface ContentHealth {
  score: number;
  canPublish: boolean;
  errors: string[];
  warnings: string[];
}

export interface MediaRef {
  mediaId?: string;
  url?: string;
  altText?: string;
  credit?: string | null;
  license?: string;
  isCover?: boolean;
}

export interface Faq {
  question: string;
  answer: string;
}

export interface DestinationDocument {
  slug: string;
  name: string;
  state: string;
  country?: string;
  latitude: number;
  longitude: number;
  shortDescription: string;
  tagline?: string | null;
  overview?: string | null;
  rating?: number | null;
  idealDaysMin?: number | null;
  idealDaysMax?: number | null;
  budgetPerDayMin?: number | null;
  budgetPerDayMax?: number | null;
  altitudeM?: number | null;
  nearestAirport?: string | null;
  nearestAirportKm?: number | null;
  nearestRailway?: string | null;
  nearestRailwayKm?: number | null;
  bestTimeToVisit?: string | null;
  heroImageUrl?: string | null;
  popularityScore?: number;
  isFeatured?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  tags?: string[];
  months?: Array<{
    month: number;
    rating: 'GOOD' | 'OK' | 'AVOID';
    avgMinC?: number | null;
    avgMaxC?: number | null;
    rainfallMm?: number | null;
    notes?: string | null;
    events?: string[];
  }>;
  howToReach?: Array<{
    mode: 'ROAD' | 'TRAIN' | 'AIR' | 'BUS';
    hubName: string;
    distanceKm?: number | null;
    durationMinutes?: number | null;
    costMin?: number | null;
    costMax?: number | null;
    summary: string;
  }>;
  faqs?: Faq[];
  media?: MediaRef[];
}

export interface PlaceDocument {
  destinationId?: string;
  destinationSlug?: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  overview?: string | null;
  latitude: number;
  longitude: number;
  rankInDestination?: number | null;
  averageVisitMinutes?: number | null;
  timeRequiredMinMinutes?: number | null;
  timeRequiredMaxMinutes?: number | null;
  estimatedCost?: number | null;
  entryFeeIndian?: number | null;
  entryFeeChild?: number | null;
  entryFeeForeigner?: number | null;
  feeNotes?: string | null;
  isFree?: boolean;
  bestTimeOfDay?: string | null;
  tips?: string[];
  address?: string | null;
  rating?: number | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  tags?: string[];
  timings?: Array<{ dayOfWeek: number; isClosed?: boolean; opensAt?: string | null; closesAt?: string | null }>;
  faqs?: Faq[];
  media?: MediaRef[];
}

export interface CollectionDocument {
  slug: string;
  title: string;
  intro: string;
  body?: string | null;
  isFeatured?: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  items?: Array<{
    destinationId?: string;
    placeId?: string;
    destinationSlug?: string;
    placeSlug?: string;
    blurb?: string | null;
  }>;
  media?: MediaRef[];
}

export interface Editable<TDocument> {
  id: string;
  status: ContentStatus;
  publishedAt: string | null;
  updatedAt: string;
  health: ContentHealth;
  document: TDocument;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface DestinationRow {
  id: string;
  slug: string;
  name: string;
  state: string;
  status: ContentStatus;
  isFeatured: boolean;
  publishedAt: string | null;
  updatedAt: string;
  publishedPlaceCount: number;
  health: ContentHealth;
}

export interface PlaceRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  status: ContentStatus;
  destination: { id: string; slug: string; name: string; status: ContentStatus };
  rankInDestination: number | null;
  updatedAt: string;
  health: ContentHealth;
}

export interface CollectionRow {
  id: string;
  slug: string;
  title: string;
  status: ContentStatus;
  isFeatured: boolean;
  itemCount: number;
  updatedAt: string;
  health: ContentHealth;
}

export interface TagRow {
  id: string;
  slug: string;
  name: string;
  kind: 'THEME' | 'ACTIVITY' | 'AUDIENCE' | 'SEASON';
  description: string | null;
  destinationCount: number;
  placeCount: number;
}

export interface MediaItem {
  id: string;
  url: string;
  altText: string;
  credit: string | null;
  license: string;
  sourceUrl: string | null;
  width: number | null;
  height: number | null;
  bytes: number | null;
  mimeType: string | null;
  isExternal: boolean;
  createdAt: string;
  usageCount?: number;
}

export interface ImportReport {
  dryRun: boolean;
  applied: boolean;
  summary: Record<string, { create: number; update: number; unchanged: number; error: number }>;
  rows: Array<{
    entity: string;
    key: string;
    action: 'create' | 'update' | 'unchanged' | 'error';
    changes?: string[];
    published?: boolean;
    errors?: string[];
  }>;
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string | null;
  changes: unknown;
  createdAt: string;
  actor: { id: string; name: string; email: string } | null;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: 'TRAVELLER' | 'EDITOR' | 'ADMIN';
  createdAt: string;
  tripCount: number;
}

export interface HealthOverview {
  destinations: { total: number; published: number; draft: number; averageScore: number | null };
  places: { total: number; published: number; draft: number; averageScore: number | null };
  collections: { total: number; published: number };
  weakestDestinations: Array<{ id: string; name: string; slug: string; status: ContentStatus; health: ContentHealth }>;
  weakestPlaces: Array<{ id: string; name: string; slug: string; status: ContentStatus; destination: string; health: ContentHealth }>;
}

export const MEDIA_LICENSES = ['OWNED', 'CC0', 'CC-BY', 'CC-BY-SA', 'LICENSED'];
export const PLACE_CATEGORIES = [
  'ATTRACTION',
  'VIEWPOINT',
  'ACTIVITY',
  'FOOD',
  'CAFE',
  'HOTEL',
  'FUEL',
  'HOSPITAL',
  'MECHANIC',
  'PARKING'
];
