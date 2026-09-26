import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../../core/services/api.service';
import { CreateTripRequest, Trip, TripSharing } from '../models/trip.model';

@Injectable({
  providedIn: 'root'
})
export class TripsApiService {
  private readonly api = inject(ApiService);

  createTrip(payload: CreateTripRequest): Observable<Trip> {
    return this.api.post<Trip, CreateTripRequest>('/trips', payload);
  }

  generateItinerary(tripId: string): Observable<Trip> {
    return this.api.post<Trip, Record<string, never>>(
      `/trips/${tripId}/generate-itinerary`,
      {}
    );
  }

  getTrip(tripId: string): Observable<Trip> {
    return this.api.get<Trip>(`/trips/${tripId}`);
  }

  listTrips(): Observable<Trip[]> {
    return this.api.get<Trip[]>('/trips');
  }

  getSharedTrip(shareSlug: string): Observable<Trip> {
    return this.api.get<Trip>(`/shared-trips/${encodeURIComponent(shareSlug)}`);
  }

  enableSharing(tripId: string): Observable<TripSharing> {
    return this.api.post<TripSharing, Record<string, never>>(`/trips/${tripId}/share`, {});
  }

  disableSharing(tripId: string): Observable<TripSharing> {
    return this.api.delete<TripSharing>(`/trips/${tripId}/share`);
  }
}
