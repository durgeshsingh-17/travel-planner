import { TierLevel } from '../content/content.models';

export type QuoteRequestStatus = 'NEW' | 'ROUTED' | 'QUOTED' | 'ACCEPTED' | 'CLOSED' | 'EXPIRED' | 'CANCELLED';
export type QuoteStatus = 'SENT' | 'WITHDRAWN' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export interface QuoteRequestSummary {
  id: string;
  status: QuoteRequestStatus;
  createdAt: string;
  expiresAt: string;
  package: { slug: string; title: string; durationDays: number; durationNights: number } | null;
  packageTier: TierLevel | null;
  destination: { slug: string; name: string; state: string } | null;
  startDate: string | null;
  flexibleMonth: number | null;
  nights: number;
  adults: number;
  children: number;
  agenciesContacted: number;
  quotesReceived: number;
}

export interface QuoteHotel {
  destinationName: string;
  hotelName: string;
  hotelCategory?: number;
  mealPlan?: string;
  nights: number;
}

export interface Quote {
  id: string;
  status: QuoteStatus;
  tier: TierLevel | null;
  totalPrice: number;
  pricePerPerson: number;
  taxesIncluded: boolean;
  hotels: QuoteHotel[];
  inclusions: string[];
  exclusions: string[];
  message: string | null;
  validUntil: string;
  createdAt: string;
  agent: { id: string; displayName: string; city: string | null; email: string | null; phone: string | null };
}

export interface QuoteRequestDetail extends QuoteRequestSummary {
  departureLocation: { slug: string; name: string; state: string } | null;
  childAges: number[];
  rooms: number;
  budgetPerPersonMin: number | null;
  budgetPerPersonMax: number | null;
  hotelCategory: number | null;
  notes: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  closedReason: string | null;
  agenciesDeclined: number;
  quotes: Quote[];
  comparison: {
    cheapestQuoteId: string | null;
    inclusions: Array<{ item: string; coveredBy: string[] }>;
  };
}

export interface CreateQuoteRequest {
  packageSlug?: string;
  packageTier?: TierLevel;
  destinationSlug?: string;
  departureLocationSlug?: string;
  startDate?: string;
  flexibleMonth?: number;
  nights: number;
  adults: number;
  childAges?: number[];
  rooms: number;
  budgetPerPersonMin?: number;
  budgetPerPersonMax?: number;
  hotelCategory?: number;
  notes?: string;
  contactName: string;
  contactEmail?: string;
  consent: boolean;
  source?: string;
}

export interface SubmitQuote {
  tier?: TierLevel;
  totalPrice: number;
  pricePerPerson?: number;
  taxesIncluded?: boolean;
  hotels: QuoteHotel[];
  inclusions: string[];
  exclusions?: string[];
  message?: string;
  validUntil: string;
}

export const TIER_LABELS: Record<TierLevel, string> = {
  BUDGET: 'Budget',
  MID_RANGE: 'Mid-range',
  PREMIUM: 'Premium',
  LUXURY: 'Luxury'
};

export const REQUEST_STATUS_LABELS: Record<QuoteRequestStatus, string> = {
  NEW: 'Finding agencies',
  ROUTED: 'Waiting for quotes',
  QUOTED: 'Quotes received',
  ACCEPTED: 'Quote accepted',
  CLOSED: 'Closed',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled'
};
