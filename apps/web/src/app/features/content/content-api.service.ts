import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import {
  CollectionCard,
  CollectionDetail,
  DestinationCard,
  DestinationDetail,
  DestinationFacets,
  DestinationQuery,
  HomeContent,
  Page,
  PlaceCard,
  PlaceDetail,
  SearchSuggestions
} from './content.models';

@Injectable({ providedIn: 'root' })
export class ContentApiService {
  private readonly api = inject(ApiService);

  home(): Observable<HomeContent> {
    return this.api.get<HomeContent>('/home');
  }

  destinations(query: DestinationQuery = {}): Observable<Page<DestinationCard>> {
    const params = new URLSearchParams();

    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      if (Array.isArray(value)) {
        value.forEach((entry) => params.append(key, String(entry)));
      } else {
        params.set(key, String(value));
      }
    });

    const search = params.toString();
    return this.api.get<Page<DestinationCard>>(search ? `/destinations?${search}` : '/destinations');
  }

  facets(): Observable<DestinationFacets> {
    return this.api.get<DestinationFacets>('/destinations/facets');
  }

  destination(slug: string): Observable<DestinationDetail> {
    return this.api.get<DestinationDetail>(`/destinations/${encodeURIComponent(slug)}`);
  }

  destinationPlaces(
    slug: string,
    query: { category?: string; page?: number } = {}
  ): Observable<Page<PlaceCard> & { destination: { id: string; slug: string; name: string } }> {
    const params = new URLSearchParams();
    if (query.category) params.set('category', query.category);
    if (query.page) params.set('page', String(query.page));
    const search = params.toString();
    return this.api.get(`/destinations/${encodeURIComponent(slug)}/places${search ? `?${search}` : ''}`);
  }

  place(destinationSlug: string, placeSlug: string): Observable<PlaceDetail> {
    return this.api.get<PlaceDetail>(
      `/destinations/${encodeURIComponent(destinationSlug)}/places/${encodeURIComponent(placeSlug)}`
    );
  }

  collections(): Observable<CollectionCard[]> {
    return this.api.get<CollectionCard[]>('/collections');
  }

  collection(slug: string): Observable<CollectionDetail> {
    return this.api.get<CollectionDetail>(`/collections/${encodeURIComponent(slug)}`);
  }

  suggest(q: string): Observable<SearchSuggestions> {
    return this.api.get<SearchSuggestions>(`/search/suggest?q=${encodeURIComponent(q)}`);
  }
}
