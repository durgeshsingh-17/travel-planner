import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { CreateQuoteRequest, QuoteRequestDetail, QuoteRequestSummary, SubmitQuote } from './quotes.models';

@Injectable({ providedIn: 'root' })
export class QuotesApiService {
  private readonly api = inject(ApiService);

  requestPhoneCode(phone: string): Observable<{ phone: string; expiresInSeconds: number; resendAfterSeconds: number }> {
    return this.api.post('/me/phone/verification', { phone });
  }

  confirmPhoneCode(phone: string, code: string): Observable<{ phone: string; phoneVerifiedAt: string }> {
    return this.api.post('/me/phone/verification/confirm', { phone, code });
  }

  create(request: CreateQuoteRequest): Observable<QuoteRequestDetail> {
    return this.api.post<QuoteRequestDetail, CreateQuoteRequest>('/quote-requests', request);
  }

  mine(): Observable<QuoteRequestSummary[]> {
    return this.api.get<QuoteRequestSummary[]>('/me/quote-requests');
  }

  get(id: string): Observable<QuoteRequestDetail> {
    return this.api.get<QuoteRequestDetail>(`/me/quote-requests/${id}`);
  }

  cancel(id: string): Observable<QuoteRequestDetail> {
    return this.api.post<QuoteRequestDetail, Record<string, never>>(`/me/quote-requests/${id}/cancel`, {});
  }

  accept(quoteId: string): Observable<QuoteRequestDetail> {
    return this.api.post<QuoteRequestDetail, Record<string, never>>(`/me/quotes/${quoteId}/accept`, {});
  }

  decline(quoteId: string): Observable<QuoteRequestDetail> {
    return this.api.post<QuoteRequestDetail, Record<string, never>>(`/me/quotes/${quoteId}/decline`, {});
  }

  agentInbox(): Observable<{ agent: { id: string; displayName: string }; requests: AgentInboxItem[] }> {
    return this.api.get('/agent/quote-requests');
  }

  agentRequest(id: string): Observable<AgentRequestDetail> {
    return this.api.get(`/agent/quote-requests/${id}`);
  }

  agentSubmit(id: string, quote: SubmitQuote): Observable<AgentRequestDetail> {
    return this.api.post(`/agent/quote-requests/${id}/quotes`, quote);
  }

  agentDecline(id: string, reason: string): Observable<{ declined: boolean }> {
    return this.api.post(`/agent/quote-requests/${id}/decline`, { reason });
  }
}

export interface AgentInboxItem {
  requestId: string;
  routingStatus: 'NOTIFIED' | 'VIEWED' | 'DECLINED' | 'QUOTED';
  notifiedAt: string;
  requestStatus: string;
  expiresAt: string;
  package: { title: string; slug: string } | null;
  destination: { name: string } | null;
  startDate: string | null;
  flexibleMonth: number | null;
  nights: number;
  travellers: number;
  myQuote: { id: string; status: string; totalPrice: number } | null;
}

export interface AgentRequestDetail {
  id: string;
  status: string;
  routingStatus: string;
  expiresAt: string;
  package: { slug: string; title: string; durationDays: number; durationNights: number; route: string } | null;
  packageTier: string | null;
  destination: { name: string; state: string } | null;
  departureLocation: { name: string; state: string } | null;
  startDate: string | null;
  flexibleMonth: number | null;
  nights: number;
  adults: number;
  childAges: number[];
  rooms: number;
  budgetPerPersonMin: number | null;
  budgetPerPersonMax: number | null;
  hotelCategory: number | null;
  notes: string | null;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  myQuote: (SubmitQuote & { id: string; status: string; pricePerPerson: number }) | null;
}
