import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';

import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { SavedTripsService } from './saved-trips.service';
import { Trip } from '../trip-result/models/trip.model';
import { TripsApiService } from '../trip-result/services/trips-api.service';

@Component({
  selector: 'app-saved-trips',
  standalone: true,
  imports: [
    EmptyStateComponent,
    LoadingStateComponent,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    RouterLink
  ],
  template: `
    <main class="saved-page app-page">
      <section class="page-heading">
        <p class="page-kicker">Saved Trips</p>
        <h1 class="page-title">Your road trips, ready when you are.</h1>
      </section>

      @if (isLoading()) {
        <app-loading-state label="Loading saved trips" />
      } @else if (errorMessage()) {
        <app-empty-state
          title="Could not load saved trips"
          [message]="errorMessage() ?? 'Please try again.'"
        />
      } @else if (savedTrips().length === 0) {
        <app-empty-state
          title="No saved trips yet"
          message="Save a generated trip from the trip result page and it will appear here."
        />
      } @else {
        <section class="trip-grid" aria-label="Saved trips">
          @for (trip of savedTrips(); track trip.id) {
            <mat-card appearance="outlined">
              <div>
                <mat-chip-set aria-label="Trip status">
                  <mat-chip>{{ trip.status }}</mat-chip>
                </mat-chip-set>
                <h2>{{ trip.sourceName }} -> {{ trip.destinationName }}</h2>
                <p>
                  {{ trip.startDate }} to {{ trip.endDate }} •
                  {{ trip.travellerCount }} travellers
                </p>
              </div>
              <dl>
                <div>
                  <dt>Distance</dt>
                  <dd>{{ trip.estimatedDistanceKm ?? 0 }} km</dd>
                </div>
                <div>
                  <dt>Cost</dt>
                  <dd>{{ formatCurrency(trip.estimatedTotalCost) }}</dd>
                </div>
              </dl>
              <footer>
                <a mat-flat-button color="primary" [routerLink]="['/trip', trip.id]">Open</a>
                <button mat-stroked-button type="button" (click)="removeSavedTrip(trip.id)">Remove</button>
              </footer>
            </mat-card>
          }
        </section>
      }
    </main>
  `,
  styles: [
    `
      .saved-page {
        min-height: 80vh;
      }

      .page-heading {
        display: grid;
        gap: 10px;
        margin-bottom: 26px;
      }

      h1,
      h2,
      p {
        margin: 0;
      }

      .trip-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
      }

      mat-card {
        display: grid;
        gap: 18px;
        padding: 18px;
        box-shadow: 0 18px 48px rgba(30, 39, 34, 0.06);
      }

      article p,
      dt {
        color: #66706a;
      }

      dl {
        display: grid;
        gap: 10px;
        margin: 0;
      }

      dl div,
      footer {
        display: flex;
        justify-content: space-between;
        gap: 12px;
      }

      dd {
        margin: 0;
        font-weight: 900;
      }

      @media (max-width: 900px) {
        .trip-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 560px) {
        .trip-grid {
          grid-template-columns: 1fr;
        }

        footer {
          flex-direction: column;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SavedTripsComponent {
  private readonly savedTripsService = inject(SavedTripsService);
  private readonly tripsApi = inject(TripsApiService);

  protected readonly trips = signal<Trip[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly savedTrips = computed(() => {
    const savedIds = this.savedTripsService.ids();
    return this.trips().filter((trip) => savedIds.has(trip.id));
  });

  constructor() {
    this.tripsApi
      .listTrips()
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed()
      )
      .subscribe({
        next: (trips) => this.trips.set(trips),
        error: (error: Error) => this.errorMessage.set(error.message)
      });
  }

  protected removeSavedTrip(tripId: string): void {
    this.savedTripsService.remove(tripId);
  }

  protected formatCurrency(value?: number | null): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value ?? 0);
  }
}
