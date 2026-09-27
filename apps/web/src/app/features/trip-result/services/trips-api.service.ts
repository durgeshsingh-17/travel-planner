import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiService } from '../../../core/services/api.service';
import { AddActivityRequest, CreateTripRequest, Trip, TripSharing, UpdateActivityRequest } from '../models/trip.model';

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

  // Itinerary editing: every call returns the whole, re-timed trip.

  reorderDay(tripId: string, dayNumber: number, activityIds: string[]): Observable<Trip> {
    return this.api.put<Trip, { activityIds: string[] }>(`/trips/${tripId}/days/${dayNumber}/order`, { activityIds });
  }

  addActivity(tripId: string, dayNumber: number, body: AddActivityRequest): Observable<Trip> {
    return this.api.post<Trip, AddActivityRequest>(`/trips/${tripId}/days/${dayNumber}/activities`, body);
  }

  updateActivity(tripId: string, activityId: string, body: UpdateActivityRequest): Observable<Trip> {
    return this.api.patch<Trip, UpdateActivityRequest>(`/trips/${tripId}/activities/${activityId}`, body);
  }

  removeActivity(tripId: string, activityId: string): Observable<Trip> {
    return this.api.delete<Trip>(`/trips/${tripId}/activities/${activityId}`);
  }

  regenerateDay(tripId: string, dayNumber: number): Observable<Trip> {
    return this.api.post<Trip, Record<string, never>>(`/trips/${tripId}/days/${dayNumber}/regenerate`, {});
  }
}
