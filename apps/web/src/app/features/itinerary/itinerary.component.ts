import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';

import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { Trip } from '../trip-result/models/trip.model';
import { TripsApiService } from '../trip-result/services/trips-api.service';

@Component({
  selector: 'app-itinerary',
  standalone: true,
  imports: [
    CurrencyPipe,
    DatePipe,
    EmptyStateComponent,
    LoadingStateComponent,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    RouterLink
  ],
  template: `
    <main class="itinerary-page app-page">
      <section class="page-head">
        <div>
          <p class="page-kicker">Itineraries</p>
          <h1 class="page-title">Generated trip workspace</h1>
        </div>
        <a mat-flat-button color="primary" routerLink="/plan">Create trip</a>
      </section>

      @if (isLoading()) {
        <app-loading-state label="Loading itineraries" />
      } @else if (errorMessage()) {
        <app-empty-state title="Could not load trips" [message]="errorMessage() ?? ''" />
      } @else if (trips().length === 0) {
      <app-empty-state
          title="No itineraries yet"
          message="Create a trip and generate its itinerary to see it here."
      />
      } @else {
        <section class="trip-list">
          @for (trip of trips(); track trip.id) {
            <mat-card appearance="outlined">
              <div>
                <mat-chip-set aria-label="Trip status">
                  <mat-chip>{{ trip.status }}</mat-chip>
                </mat-chip-set>
                <h2>{{ trip.title }}</h2>
                <p>
                  {{ trip.sourceName }} to {{ trip.destinationName }} •
                  {{ trip.startDate | date: 'mediumDate' }} - {{ trip.endDate | date: 'mediumDate' }}
                </p>
              </div>
              <dl>
                <div>
                  <dt>Travel mode</dt>
                  <dd>{{ trip.travelMode }}</dd>
                </div>
                <div>
                  <dt>Distance</dt>
                  <dd>{{ trip.estimatedDistanceKm ?? 0 }} km</dd>
                </div>
                <div>
                  <dt>Budget</dt>
                  <dd>{{ trip.estimatedTotalCost ?? trip.budget ?? 0 | currency: 'INR' : 'symbol-narrow' : '1.0-0' }}</dd>
                </div>
              </dl>
              <nav>
                <a mat-flat-button color="primary" [routerLink]="['/trip', trip.id]">Open result</a>
                <a mat-stroked-button [routerLink]="['/trip-details', trip.id]">Details</a>
              </nav>
            </mat-card>
          }
        </section>
      }
    </main>
  `,
  styles: [
    `
      .itinerary-page {
        min-height: 70vh;
      }

      .page-head {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 24px;
      }

      .trip-list {
        display: grid;
        gap: 14px;
      }

      mat-card {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto auto;
        gap: 18px;
        align-items: center;
        padding: 20px;
      }

      h2,
      p,
      dl,
      dd {
        margin: 0;
      }

      article p,
      dt {
        color: #66706a;
      }

      dl {
        display: grid;
        grid-template-columns: repeat(3, minmax(96px, 1fr));
        gap: 12px;
      }

      dt {
        font-size: 0.72rem;
        font-weight: 800;
        text-transform: uppercase;
      }

      dd {
        margin-top: 4px;
        font-weight: 900;
      }

      nav {
        display: flex;
        gap: 8px;
      }

      @media (max-width: 900px) {
        .page-head,
        mat-card,
        nav {
          align-items: stretch;
        }

        .page-head,
        mat-card {
          grid-template-columns: 1fr;
        }

        .page-head {
          display: grid;
        }
      }

      @media (max-width: 560px) {
        dl,
        nav {
          grid-template-columns: 1fr;
          flex-direction: column;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ItineraryComponent {
  private readonly tripsApi = inject(TripsApiService);

  protected readonly trips = signal<Trip[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.tripsApi
      .listTrips()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (trips) => {
          this.trips.set(trips);
          this.isLoading.set(false);
        },
        error: (error: Error) => {
          this.errorMessage.set(error.message);
          this.isLoading.set(false);
        }
      });
  }
}
