import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import { Trip } from './models/trip.model';
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
    RouteMapComponent
  ],
  templateUrl: './trip-result.component.html',
  styleUrl: './trip-result.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripResultComponent {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly savedTrips = inject(SavedTripsService);
  private readonly tripsApi = inject(TripsApiService);

  protected readonly trip = signal<Trip | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly toastMessage = signal<string | null>(null);
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

    return [
      ['Fuel', breakdown.fuel],
      ['Tolls', breakdown.tolls],
      ['Stay', breakdown.stay],
      ['Food', breakdown.food],
      ['Activities', breakdown.activities],
      ['Parking', breakdown.parking],
      ['Miscellaneous', breakdown.miscellaneous]
    ] as const;
  });

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          this.isLoading.set(true);
          this.errorMessage.set(null);
          return this.tripsApi.getTrip(params.get('id') ?? '');
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
    const saved = this.savedTrips.toggle(tripId);
    this.showToast(saved ? 'Trip saved' : 'Trip removed from saved');
  }

  protected async shareTrip(trip: Trip): Promise<void> {
    const shareUrl = window.location.href;
    const shareText = `${trip.sourceName} to ${trip.destinationName} • ${trip.startDate} to ${trip.endDate}`;

    if (navigator.share) {
      await navigator.share({
        title: trip.title,
        text: shareText,
        url: shareUrl
      });
      return;
    }

    await navigator.clipboard.writeText(shareUrl);
    this.showToast('Trip link copied');
  }

  private showToast(message: string): void {
    this.toastMessage.set(message);
    window.setTimeout(() => this.toastMessage.set(null), 2200);
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
