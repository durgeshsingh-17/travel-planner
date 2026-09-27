import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';

import { ApiService } from '../../core/services/api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { RouteMapComponent } from '../../shared/ui/route-map/route-map.component';
import { SavedTripsService } from '../saved-trips/saved-trips.service';
import { SessionService } from '../../core/auth/session.service';
import { ToastService } from '../../shared/services/toast.service';
import { Trip } from './models/trip.model';
import { TripItineraryComponent } from './itinerary/trip-itinerary.component';
import { TripsApiService } from './services/trips-api.service';

@Component({
  selector: 'app-trip-result',
  standalone: true,
  imports: [
    EmptyStateComponent,
    LoadingStateComponent,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatProgressBarModule,
    MatTabsModule,
    RouterLink,
    RouteMapComponent,
    TripItineraryComponent
  ],
  templateUrl: './trip-result.component.html',
  styleUrl: './trip-result.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripResultComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly savedTrips = inject(SavedTripsService);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);
  private readonly tripsApi = inject(TripsApiService);

  protected readonly trip = signal<Trip | null>(null);
  /** True on the public `/t/:shareSlug` view, where the viewer may not own the trip. */
  protected readonly isSharedView = signal(false);
  protected readonly isSignedIn = computed(() => this.session.session().isAuthenticated);
  protected readonly isUpdatingShare = signal(false);
  protected readonly effectiveMileage = computed(() => {
    const trip = this.trip();
    return (
      trip?.costBreakdown?.mileageKmPerLitre ??
      trip?.userVehicle?.customMileage ??
      trip?.vehicle?.averageMileage ??
      null
    );
  });
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly weatherDays = signal<
    {
      date: string;
      minTemperatureC: number | null;
      maxTemperatureC: number | null;
      precipitationProbability: number | null;
    }[]
  >([]);
  protected readonly isSaved = computed(() => {
    const trip = this.trip();
    return trip ? this.savedTrips.isSaved(trip.id) : false;
  });
  protected readonly durationLabel = computed(() => {
    const minutes = this.trip()?.estimatedDurationMinutes;

    if (!minutes) {
      return 'Pending';
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  });
  protected readonly costRows = computed(() => {
    const breakdown = this.trip()?.costBreakdown;

    if (!breakdown) {
      return [];
    }

    const mode = this.trip()?.travelMode;
    const rows: [string, number][] = [
      ['Fuel', breakdown.fuel],
      ['Tolls', breakdown.tolls],
      [mode === 'FLIGHT' ? 'Flights' : 'Bus fares', breakdown.fares ?? 0],
      ['Local transport', breakdown.localTransport ?? 0],
      ['Stay', breakdown.stay],
      ['Food', breakdown.food],
      ['Activities', breakdown.activities],
      ['Parking', breakdown.parking],
      ['Buffer', breakdown.miscellaneous]
    ];
    // Road trips have no fares, flights have no fuel: hide the zero rows that do not apply.
    return rows.filter(([label, value]) => value > 0 || ['Stay', 'Food', 'Activities'].includes(label));
  });
  protected readonly costSummary = computed(() => {
    const labels = this.costRows().map(([label]) => label.toLowerCase());
    return labels.length ? `Includes ${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}.` : 'Generate the itinerary to see costs.';
  });
  protected readonly routeSource = computed(() => {
    switch (this.trip()?.routeProvider) {
      case 'osrm':
        return 'Road distance and time from OpenStreetMap routing. Traffic and breaks can add time.';
      case 'air':
        return 'Flight time plus airport time; distance is as the crow flies.';
      case 'estimate':
        return 'Road routing was unavailable, so distance and time are estimated from the straight-line distance.';
      default:
        return 'Generate the itinerary for road distance and time.';
    }
  });
  protected readonly directionsUrl = computed(() => {
    const trip = this.trip();
    if (!trip) return '';
    const engine = trip.travelMode === 'BIKE' ? 'fossgis_osrm_bike' : 'fossgis_osrm_car';
    return `https://www.openstreetmap.org/directions?engine=${engine}&route=${trip.sourceLatitude},${trip.sourceLongitude};${trip.destinationLatitude},${trip.destinationLongitude}`;
  });

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const shareSlug = params.get('shareSlug');
          this.isLoading.set(true);
          this.errorMessage.set(null);
          this.isSharedView.set(shareSlug !== null);
          return shareSlug !== null
            ? this.tripsApi.getSharedTrip(shareSlug)
            : this.tripsApi.getTrip(params.get('id') ?? '');
        }),
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed()
      )
      .subscribe({
        next: (trip) => {
          this.trip.set(trip);
          this.loadWeather(trip);
          this.isLoading.set(false);
        },
        error: (error: Error) => {
          this.errorMessage.set(error.message);
          this.isLoading.set(false);
        }
      });
  }

  protected onItineraryEdited(trip: Trip): void {
    this.trip.set(trip);
  }

  protected formatCurrency(value?: number | null): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value ?? 0);
  }

  protected labelize(value?: string | null): string {
    if (!value) {
      return '';
    }

    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  protected toggleSavedTrip(tripId: string): void {
    if (!this.isSignedIn()) {
      void this.router.navigate(['/sign-in'], {
        queryParams: { returnUrl: this.router.url }
      });
      return;
    }

    this.savedTrips.toggle(tripId).subscribe({
      next: (saved) => this.toast.success(saved ? 'Trip saved' : 'Trip removed from saved'),
      error: (error: Error) => this.toast.error(error.message)
    });
  }

  protected shareTrip(trip: Trip): void {
    if (this.isSharedView()) {
      void this.openShareSheet(trip, window.location.href);
      return;
    }

    if (trip.visibility === 'UNLISTED' && trip.shareSlug) {
      void this.openShareSheet(trip, this.shareUrl(trip.shareSlug));
      return;
    }

    this.isUpdatingShare.set(true);
    this.tripsApi
      .enableSharing(trip.id)
      .pipe(finalize(() => this.isUpdatingShare.set(false)))
      .subscribe({
        next: (sharing) => {
          this.trip.set({ ...trip, ...sharing });

          if (sharing.shareSlug) {
            void this.openShareSheet(trip, this.shareUrl(sharing.shareSlug));
          }
        },
        error: (error: Error) => this.toast.error(error.message)
      });
  }

  protected stopSharing(trip: Trip): void {
    this.isUpdatingShare.set(true);
    this.tripsApi
      .disableSharing(trip.id)
      .pipe(finalize(() => this.isUpdatingShare.set(false)))
      .subscribe({
        next: (sharing) => {
          this.trip.set({ ...trip, ...sharing });
          this.toast.success('Sharing turned off. Old links no longer work.');
        },
        error: (error: Error) => this.toast.error(error.message)
      });
  }

  private shareUrl(shareSlug: string): string {
    return `${window.location.origin}/t/${shareSlug}`;
  }

  private async openShareSheet(trip: Trip, shareUrl: string): Promise<void> {
    const shareText = `${trip.sourceName} to ${trip.destinationName} • ${trip.startDate} to ${trip.endDate}`;

    try {
      if (navigator.share) {
        await navigator.share({ title: trip.title, text: shareText, url: shareUrl });
        return;
      }

      await navigator.clipboard.writeText(shareUrl);
      this.toast.success('Share link copied. Traveller details stay private.');
    } catch (error) {
      // Closing the native share sheet rejects with AbortError; that is not a failure.
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        this.toast.error('Could not share the link. Please copy it from the address bar.');
      }
    }
  }

  private loadWeather(trip: Trip): void {
    const query = new URLSearchParams({
      location: trip.destinationName,
      latitude: String(trip.destinationLatitude),
      longitude: String(trip.destinationLongitude),
      startDate: trip.startDate
    });

    this.api
      .get<{
        days: {
          date: string;
          minTemperatureC: number | null;
          maxTemperatureC: number | null;
          precipitationProbability: number | null;
        }[];
      }>(`/weather/forecast?${query.toString()}`)
      .subscribe({
        next: (forecast) => this.weatherDays.set(forecast.days),
        error: () => this.weatherDays.set([])
      });
  }
}
