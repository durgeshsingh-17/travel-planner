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
  OwnReview,
  PackageCard,
  PackageDetail,
  PackageFacets,
  PackageQuery,
  PlaceCard,
  PlaceDetail,
  ReviewList,
  ReviewTarget,
  SearchSuggestions,
  TravellerType
} from './content.models';

function toQueryString(query: object): string {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) value.forEach((entry) => params.append(key, String(entry)));
    else params.set(key, String(value));
  });

  const search = params.toString();
  return search ? `?${search}` : '';
}

export interface ReviewInput {
  rating: number;
  title?: string;
  body: string;
  travelledMonth?: string;
  travellerType?: TravellerType;
}

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

  packages(query: PackageQuery = {}): Observable<Page<PackageCard>> {
    return this.api.get<Page<PackageCard>>(`/packages${toQueryString(query)}`);
  }

  packageFacets(): Observable<PackageFacets> {
    return this.api.get<PackageFacets>('/packages/facets');
  }

  package(slug: string): Observable<PackageDetail> {
    return this.api.get<PackageDetail>(`/packages/${encodeURIComponent(slug)}`);
  }

  reviews(target: ReviewTarget, page = 1): Observable<ReviewList> {
    return this.api.get<ReviewList>(`/reviews${toQueryString({ ...target, page })}`);
  }

  createReview(target: ReviewTarget, input: ReviewInput): Observable<OwnReview> {
    return this.api.post<OwnReview, ReviewTarget & ReviewInput>('/reviews', { ...target, ...input });
  }

  updateReview(id: string, input: ReviewInput): Observable<OwnReview> {
    return this.api.put<OwnReview, ReviewInput>(`/me/reviews/${id}`, input);
  }

  deleteReview(id: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/me/reviews/${id}`);
  }

  myReviews(): Observable<OwnReview[]> {
    return this.api.get<OwnReview[]>('/me/reviews');
  }

  suggest(q: string): Observable<SearchSuggestions> {
    return this.api.get<SearchSuggestions>(`/search/suggest?q=${encodeURIComponent(q)}`);
  }
}
