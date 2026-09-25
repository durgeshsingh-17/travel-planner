import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

import { Destination } from '../destinations/destination.model';
import { DestinationsApiService } from '../destinations/destinations-api.service';
import { SectionCarouselComponent } from '../../shared/ui/section-carousel/section-carousel.component';
import { TravelCard } from '../home/models/travel-card.model';

const fallbackImageUrl =
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80';

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, RouterLink, SectionCarouselComponent],
  template: `
    <main class="explore-page app-page">
      <section class="explore-hero">
        <p class="page-kicker">Explore India</p>
        <h1 class="page-title">Find the route that fits your mood, budget and vehicle.</h1>
        <a mat-flat-button color="primary" routerLink="/plan">Start planning</a>
      </section>

      <app-section-carousel
        eyebrow="Trending"
        title="Road trips worth saving"
        description="High-confidence road-trip ideas for the current MVP catalog."
        [cards]="trendingRoadTrips()"
      />
      <app-section-carousel
        eyebrow="Destinations"
        title="Popular destination ideas"
        description="Browse places that work well for road-first trip planning."
        [cards]="popularDestinations()"
      />

      <section class="catalog">
        <div>
          <p>Live catalog</p>
          <h2>Open seeded destinations</h2>
        </div>
        <div class="catalog-grid">
          @for (destination of destinations(); track destination.id) {
          <a
            [routerLink]="['/destinations', destination.slug]"
            [style.background-image]="catalogBackground(destination)"
          >
            <span>{{ destination.state }}</span>
            <strong>{{ destination.name }}</strong>
            <small>{{ destination.shortDescription }}</small>
          </a>
          }
        </div>
      </section>

      <app-section-carousel
        eyebrow="Budget"
        title="Trips under Rs 10,000"
        description="Shorter breaks with realistic travel costs."
        [cards]="budgetTrips()"
      />

      <section class="moods">
        @for (mood of moodCards(); track mood.label) {
          <a [routerLink]="mood.link" class="mood-card">
            <mat-card appearance="outlined">
              <h2>{{ mood.label }}</h2>
              <p>{{ mood.description }}</p>
            </mat-card>
          </a>
        }
      </section>
    </main>
  `,
  styles: [
    `
      .explore-page {
      }

      .explore-hero {
        display: grid;
        gap: 14px;
        padding: 40px 0;
      }

      .explore-hero a {
        width: fit-content;
      }

      .catalog {
        padding: 30px 0;
      }

      .catalog > div:first-child p {
        margin: 0;
        color: var(--primary);
        font-weight: 900;
        text-transform: uppercase;
      }

      .catalog h2 {
        margin: 8px 0 0;
        font-size: clamp(1.6rem, 3vw, 2.4rem);
      }

      .catalog-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
        margin-top: 18px;
      }

      .catalog-grid a {
        display: grid;
        width: auto;
        min-height: 150px;
        align-content: end;
        gap: 8px;
        padding: 20px;
        color: #ffffff;
        background-position: center;
        background-size: cover;
      }

      .catalog-grid span,
      .catalog-grid small {
        color: rgba(255, 255, 255, 0.88);
      }

      .catalog-grid strong {
        font-size: 1.7rem;
      }

      .moods {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 14px;
        padding: 40px 0;
      }

      .moods mat-card {
        padding: 18px;
      }

      .mood-card {
        color: inherit;
        text-decoration: none;
      }

      h2,
      .moods p {
        margin: 0;
      }

      .moods p {
        margin-top: 8px;
        color: var(--muted);
      }

      @media (max-width: 760px) {
        .catalog-grid,
        .moods {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }
      }

      @media (max-width: 520px) {
        .catalog-grid,
        .moods {
          grid-template-columns: 1fr;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExploreComponent {
  private readonly destinationsApi = inject(DestinationsApiService);

  protected readonly destinations = signal<Destination[]>([]);
  protected readonly trendingRoadTrips = computed(() => this.toCards(this.destinations()));
  protected readonly popularDestinations = computed(() => this.toCards(this.destinations()));
  protected readonly budgetTrips = computed(() =>
    this.toCards(
      this.destinations().filter((destination) =>
        /uttarakhand|himachal|rajasthan|kerala|goa/i.test(
          `${destination.state} ${destination.name}`
        )
      )
    )
  );
  protected readonly moodCards = computed(() =>
    this.destinations()
      .slice(0, 8)
      .map((destination) => ({
        label: destination.state,
        description: destination.shortDescription,
        link: ['/destinations', destination.slug]
      }))
  );

  constructor() {
    this.destinationsApi
      .list()
      .subscribe((destinations) => this.destinations.set(destinations));
  }

  protected catalogBackground(destination: Destination): string {
    return `linear-gradient(180deg, rgba(8, 18, 14, 0.08), rgba(8, 18, 14, 0.74)), url('${destination.heroImageUrl ?? fallbackImageUrl}')`;
  }

  private toCards(destinations: Destination[]): TravelCard[] {
    return destinations.map((destination) => ({
      title: destination.name,
      subtitle: destination.shortDescription,
      imageUrl: destination.heroImageUrl ?? fallbackImageUrl,
      meta: `${destination.state} • ${destination.bestTimeToVisit ?? destination.country}`,
      tag: destination.country,
      link: ['/destinations', destination.slug]
    }));
  }
}
