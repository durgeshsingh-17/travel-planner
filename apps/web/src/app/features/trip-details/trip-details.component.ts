import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';

import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { Trip } from '../trip-result/models/trip.model';
import { TripsApiService } from '../trip-result/services/trips-api.service';

@Component({
  selector: 'app-trip-details',
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
    <main class="details-page app-page">
      @if (isLoading()) {
        <app-loading-state label="Loading trip details" />
      } @else if (errorMessage()) {
        <app-empty-state title="Trip unavailable" [message]="errorMessage() ?? ''" />
      } @else if (trip(); as trip) {
        <section class="summary">
          <div>
            <p class="page-kicker">{{ trip.status }}</p>
            <h1 class="page-title">{{ trip.title }}</h1>
            <span>
              {{ trip.sourceName }} to {{ trip.destinationName }} •
              {{ trip.startDate | date: 'mediumDate' }} - {{ trip.endDate | date: 'mediumDate' }}
            </span>
          </div>
          <nav>
            <a mat-flat-button color="primary" [routerLink]="['/trip', trip.id]">Open generated view</a>
            <a mat-stroked-button routerLink="/itinerary">All itineraries</a>
          </nav>
        </section>

        <section class="metrics">
          <mat-card appearance="outlined">
            <span>Travellers</span>
            <strong>{{ trip.travellerCount }}</strong>
          </mat-card>
          <mat-card appearance="outlined">
            <span>Distance</span>
            <strong>{{ trip.estimatedDistanceKm ?? 0 }} km</strong>
          </mat-card>
          <mat-card appearance="outlined">
            <span>Duration</span>
            <strong>{{ durationLabel() }}</strong>
          </mat-card>
          <mat-card appearance="outlined">
            <span>Estimate</span>
            <strong>{{ trip.estimatedTotalCost ?? trip.budget ?? 0 | currency: 'INR' : 'symbol-narrow' : '1.0-0' }}</strong>
          </mat-card>
        </section>

        <section class="timeline">
          <div class="section-head">
            <p>Day plan</p>
            <h2>Activities and route notes</h2>
          </div>

          @if ((trip.days ?? []).length === 0) {
            <app-empty-state
              title="Itinerary not generated"
              message="Open the generated view to create the day-wise itinerary for this trip."
            />
          } @else {
            @for (day of trip.days; track day.id) {
              <mat-card class="day" appearance="outlined">
                <header>
                  <span>Day {{ day.dayNumber }}</span>
                  <h3>{{ day.title }}</h3>
                  <small>{{ day.date | date: 'mediumDate' }}</small>
                </header>
                <p>{{ day.description }}</p>
                <ol>
                  @for (activity of day.activities; track activity.id) {
                    <li>
                      <time>{{ activity.startTime ?? 'Flexible' }}</time>
                      <div>
                        <strong>{{ activity.title }}</strong>
                        <p>{{ activity.description }}</p>
                        <small>
                          {{ activity.activityType }} •
                          {{ activity.estimatedCost ?? 0 | currency: 'INR' : 'symbol-narrow' : '1.0-0' }}
                        </small>
                        <div class="activity-actions">
                          <button mat-button type="button" disabled>Edit</button>
                          <button mat-button type="button" disabled>Delete</button>
                          <button mat-button type="button" disabled>Reorder</button>
                          <button mat-button type="button" disabled>Replace</button>
                        </div>
                      </div>
                    </li>
                  }
                </ol>
              </mat-card>
            }
          }
        </section>
      } @else {
      <app-empty-state
          title="Select a trip"
          message="Open an itinerary from your generated trips to inspect route, costs and day plans."
      />
      }
    </main>
  `,
  styles: [
    `
      .details-page {
        min-height: 70vh;
      }

      .summary {
        display: flex;
        align-items: end;
        justify-content: space-between;
        gap: 18px;
      }

      .section-head p,
      .day header span,
      .metrics span {
        margin: 0;
        color: #0b7a75;
        font-weight: 900;
        text-transform: uppercase;
      }

      .summary span,
      .day small,
      .day > p,
      li small,
      li p {
        color: #66706a;
      }

      nav {
        display: flex;
        gap: 8px;
      }

      .metrics {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 12px;
        padding: 26px 0;
      }

      .metrics mat-card,
      .day {
        padding: 20px;
      }

      .metrics strong {
        display: block;
        margin-top: 8px;
        font-size: 1.45rem;
      }

      .section-head {
        margin: 18px 0;
      }

      h2,
      h3,
      p,
      ol {
        margin: 0;
      }

      h2 {
        margin-top: 8px;
        font-size: clamp(1.6rem, 3vw, 2.5rem);
      }

      .timeline {
        display: grid;
        gap: 14px;
      }

      .day header {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 12px;
      }

      .day > p {
        margin-top: 8px;
      }

      ol {
        display: grid;
        gap: 12px;
        padding: 16px 0 0;
        list-style: none;
      }

      li {
        display: grid;
        grid-template-columns: 92px minmax(0, 1fr);
        gap: 14px;
        padding-top: 12px;
        border-top: 1px solid rgba(23, 33, 27, 0.1);
      }

      time {
        color: #7a4b24;
        font-weight: 900;
      }

      li p,
      li small {
        display: block;
        margin-top: 4px;
      }

      .activity-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 8px;
      }

      @media (max-width: 760px) {
        .summary,
        nav {
          align-items: stretch;
        }

        .summary {
          display: grid;
        }

        nav {
          flex-direction: column;
        }

        .metrics {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 520px) {
        .metrics,
        li {
          grid-template-columns: 1fr;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripDetailsComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly tripsApi = inject(TripsApiService);

  protected readonly trip = signal<Trip | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly durationLabel = computed(() => {
    const minutes = this.trip()?.estimatedDurationMinutes;

    if (!minutes) {
      return 'Pending';
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  });

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => {
          const id = params.get('id');
          this.isLoading.set(true);
          this.errorMessage.set(null);
          this.trip.set(null);
          return id ? this.tripsApi.getTrip(id) : this.tripsApi.listTrips();
        }),
        takeUntilDestroyed()
      )
      .subscribe({
        next: (result) => {
          this.trip.set(Array.isArray(result) ? (result[0] ?? null) : result);
          this.isLoading.set(false);
        },
        error: (error: Error) => {
          this.errorMessage.set(error.message);
          this.isLoading.set(false);
        }
      });
  }
}
