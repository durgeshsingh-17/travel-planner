import { Injectable, effect, inject, signal } from '@angular/core';
import { Observable, map, of, tap } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../core/auth/session.service';

/** Key used by older app versions that kept saved trip ids only in this browser. */
const LEGACY_STORAGE_KEY = 'travel-platform.saved-trip-ids';

export interface SavedTripSummary {
  id: string;
  title: string;
  sourceName: string;
  destinationName: string;
  startDate: string;
  endDate: string;
  travellerCount: number;
  travelMode: string;
  status: string;
  estimatedDistanceKm?: number | null;
  estimatedTotalCost?: number | null;
}

export interface SavedTrip {
  tripId: string;
  savedAt: string;
  isOwner: boolean;
  available: boolean;
  shareSlug: string | null;
  trip: SavedTripSummary | null;
}

@Injectable({
  providedIn: 'root'
})
export class SavedTripsService {
  private readonly api = inject(ApiService);
  private readonly session = inject(SessionService);
  private readonly savedIds = signal<Set<string>>(new Set());

  readonly ids = this.savedIds.asReadonly();

  constructor() {
    // Keep the saved-id cache in step with who is signed in.
    effect(() => {
      if (this.session.session().isAuthenticated) {
        this.list().subscribe({ error: () => this.savedIds.set(new Set()) });
      } else {
        this.savedIds.set(new Set());
      }
    });
  }

  isSaved(tripId: string): boolean {
    return this.savedIds().has(tripId);
  }

  /** Loads saved trips, importing any ids left in localStorage by older versions first. */
  list(): Observable<SavedTrip[]> {
    const legacyIds = this.readLegacyIds();
    const request = legacyIds.length
      ? this.api
          .post<SavedTrip[], { tripIds: string[] }>('/me/saved-trips/import', {
            tripIds: legacyIds
          })
          .pipe(tap(() => this.clearLegacyIds()))
      : this.api.get<SavedTrip[]>('/me/saved-trips');

    return request.pipe(
      tap((items) => this.savedIds.set(new Set(items.map((item) => item.tripId))))
    );
  }

  save(tripId: string): Observable<boolean> {
    this.setSaved(tripId, true);
    return this.api.put<SavedTrip, Record<string, never>>(`/me/saved-trips/${tripId}`, {}).pipe(
      map(() => true),
      tap({ error: () => this.setSaved(tripId, false) })
    );
  }

  remove(tripId: string): Observable<boolean> {
    this.setSaved(tripId, false);
    return this.api.delete<unknown>(`/me/saved-trips/${tripId}`).pipe(
      map(() => false),
      tap({ error: () => this.setSaved(tripId, true) })
    );
  }

  /** Emits the new saved state. */
  toggle(tripId: string): Observable<boolean> {
    if (!this.session.session().isAuthenticated) {
      return of(false);
    }

    return this.isSaved(tripId) ? this.remove(tripId) : this.save(tripId);
  }

  private setSaved(tripId: string, saved: boolean): void {
    this.savedIds.update((ids) => {
      const next = new Set(ids);

      if (saved) {
        next.add(tripId);
      } else {
        next.delete(tripId);
      }

      return next;
    });
  }

  private readLegacyIds(): string[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) ?? '[]') as unknown;
      return Array.isArray(parsed)
        ? parsed.filter((value): value is string => typeof value === 'string').slice(0, 100)
        : [];
    } catch {
      return [];
    }
  }

  private clearLegacyIds(): void {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {
      // Storage can be unavailable (private mode); nothing to clean up then.
    }
  }
}
