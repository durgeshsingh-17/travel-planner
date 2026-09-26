import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';

import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { SavedTrip, SavedTripsService } from './saved-trips.service';
import { ToastService } from '../../shared/services/toast.service';

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
          message="Save a generated trip from the trip result page and it will appear here on every device you sign in on."
        />
      } @else {
        <section class="trip-grid" aria-label="Saved trips">
          @for (item of savedTrips(); track item.tripId) {
            <mat-card appearance="outlined">
              @if (item.trip; as trip) {
                <div>
                  <mat-chip-set aria-label="Trip status">
                    <mat-chip>{{ trip.status }}</mat-chip>
                    @if (!item.isOwner) {
                      <mat-chip>Shared with you</mat-chip>
                    }
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
                  <a
                    mat-flat-button
                    color="primary"
                    [routerLink]="item.isOwner ? ['/trip', item.tripId] : ['/t', item.shareSlug]"
                  >
                    Open
                  </a>
                  <button mat-stroked-button type="button" (click)="removeSavedTrip(item.tripId)">
                    Remove
                  </button>
                </footer>
              } @else {
                <div>
                  <h2>Trip no longer shared</h2>
                  <p>The owner turned off sharing for this trip.</p>
                </div>
                <footer>
                  <button mat-stroked-button type="button" (click)="removeSavedTrip(item.tripId)">
                    Remove
                  </button>
                </footer>
              }
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
  private readonly toast = inject(ToastService);

  protected readonly items = signal<SavedTrip[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly savedTrips = computed(() => {
    const savedIds = this.savedTripsService.ids();
    return this.items().filter((item) => savedIds.has(item.tripId));
  });

  constructor() {
    this.savedTripsService
      .list()
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed()
      )
      .subscribe({
        next: (items) => this.items.set(items),
        error: (error: Error) => this.errorMessage.set(error.message)
      });
  }

  protected removeSavedTrip(tripId: string): void {
    this.savedTripsService.remove(tripId).subscribe({
      next: () => this.toast.success('Trip removed from saved'),
      error: (error: Error) => this.toast.error(error.message)
    });
  }

  protected formatCurrency(value?: number | null): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(value ?? 0);
  }
}
