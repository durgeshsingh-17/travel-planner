import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';

import { Destination } from './destination.model';
import { DestinationsApiService } from './destinations-api.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { RouteMapComponent } from '../../shared/ui/route-map/route-map.component';

@Component({
  selector: 'app-destination-detail',
  standalone: true,
  imports: [
    EmptyStateComponent,
    LoadingStateComponent,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    RouteMapComponent,
    RouterLink
  ],
  template: `
    <main class="destination-page">
      @if (isLoading()) {
        <app-loading-state label="Loading destination" />
      } @else if (errorMessage()) {
        <app-empty-state title="Destination unavailable" [message]="errorMessage() ?? ''" />
      } @else if (destination(); as destination) {
        <section
          class="hero"
          [style.background]="heroBackground(destination.heroImageUrl)"
        >
          <p>{{ destination.state }}, {{ destination.country }}</p>
          <h1>{{ destination.name }}</h1>
          <span>{{ destination.bestTimeToVisit ?? 'Year-round depending on route conditions' }}</span>
        </section>

        <section class="content-grid">
          <mat-card appearance="outlined">
            <h2>Why go</h2>
            <p>{{ destination.shortDescription }}</p>
            <a mat-flat-button color="primary" routerLink="/plan">Plan a trip</a>
          </mat-card>
          <app-route-map
            [sourceLatitude]="28.4595"
            [sourceLongitude]="77.0266"
            [destinationLatitude]="destination.latitude"
            [destinationLongitude]="destination.longitude"
          />
        </section>

        <section class="places">
          <div>
            <p>Places</p>
            <h2>Build your day around these stops</h2>
          </div>
          <div class="place-grid">
            @for (place of destination.places ?? []; track place.id) {
              <mat-card appearance="outlined">
                <mat-chip-set aria-label="Place category">
                  <mat-chip>{{ place.category }}</mat-chip>
                </mat-chip-set>
                <h3>{{ place.name }}</h3>
                <p>{{ place.description }}</p>
                <small>
                  {{ place.averageVisitMinutes ?? 60 }} min •
                  Rs {{ place.estimatedCost ?? 0 }} •
                  {{ place.rating ?? 4.2 }}/5
                </small>
              </mat-card>
            }
          </div>
        </section>
      }
    </main>
  `,
  styles: [
    `
      .destination-page {
        color: #17211b;
      }

      .hero {
        display: grid;
        align-content: end;
        min-height: 62vh;
        padding: 44px 24px;
        color: #ffffff;
        background-position: center;
        background-size: cover;
      }

      .hero p,
      .places > div > p {
        margin: 0;
        color: #68d7c8;
        font-weight: 900;
        text-transform: uppercase;
      }

      h1 {
        max-width: 980px;
        margin: 12px 0;
        font-size: clamp(3rem, 8vw, 7rem);
        line-height: 0.92;
      }

      .content-grid,
      .places {
        max-width: 1120px;
        margin: 0 auto;
        padding: 44px 24px;
      }

      .content-grid {
        display: grid;
        grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
        gap: 18px;
      }

      .content-grid mat-card,
      .place-grid mat-card {
        padding: 22px;
      }

      h2,
      h3,
      p {
        margin: 0;
      }

      .content-grid p,
      .place-grid p {
        margin-top: 10px;
        color: #66706a;
        line-height: 1.65;
      }

      a {
        width: fit-content;
        margin-top: 18px;
      }

      .place-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
        margin-top: 22px;
      }

      small {
        display: block;
        margin-top: 12px;
        color: #7a4b24;
        font-weight: 850;
      }

      @media (max-width: 820px) {
        .content-grid,
        .place-grid {
          grid-template-columns: 1fr;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DestinationDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly destinationsApi = inject(DestinationsApiService);

  protected readonly destination = signal<Destination | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => this.destinationsApi.getBySlug(params.get('slug') ?? '')),
        takeUntilDestroyed()
      )
      .subscribe({
        next: (destination) => {
          this.destination.set(destination);
          this.isLoading.set(false);
        },
        error: (error: Error) => {
          this.errorMessage.set(error.message);
          this.isLoading.set(false);
        }
      });
  }

  protected heroBackground(imageUrl?: string | null): string {
    return `linear-gradient(180deg, rgba(8,18,14,0.12), rgba(8,18,14,0.78)), url("${imageUrl ?? 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1600&q=85'}")`;
  }
}
