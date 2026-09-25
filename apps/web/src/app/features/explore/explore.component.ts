import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

import {
  budgetTrips,
  moodCards,
  popularDestinations,
  trendingRoadTrips
} from '../home/data/home-travel.data';
import { SectionCarouselComponent } from '../../shared/ui/section-carousel/section-carousel.component';

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
        [cards]="trendingRoadTrips"
      />
      <app-section-carousel
        eyebrow="Destinations"
        title="Popular destination ideas"
        description="Browse places that work well for road-first trip planning."
        [cards]="popularDestinations"
      />

      <section class="catalog">
        <div>
          <p>Live catalog</p>
          <h2>Open seeded destinations</h2>
        </div>
        <div class="catalog-grid">
          <a routerLink="/destinations/jibhi">
            <span>Himachal Pradesh</span>
            <strong>Jibhi</strong>
            <small>Forest stays, cafe hopping and gentle hikes.</small>
          </a>
          <a routerLink="/destinations/rishikesh">
            <span>Uttarakhand</span>
            <strong>Rishikesh</strong>
            <small>Rafting, ghats, yoga and quick mountain routes.</small>
          </a>
        </div>
      </section>

      <app-section-carousel
        eyebrow="Budget"
        title="Trips under Rs 10,000"
        description="Shorter breaks with realistic travel costs."
        [cards]="budgetTrips"
      />

      <section class="moods">
        @for (mood of moodCards; track mood.label) {
          <mat-card appearance="outlined">
            <h2>{{ mood.label }}</h2>
            <p>{{ mood.description }}</p>
          </mat-card>
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
        color: #0b7a75;
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
        background:
          linear-gradient(180deg, rgba(8, 18, 14, 0.08), rgba(8, 18, 14, 0.74)),
          url('https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80')
            center / cover;
      }

      .catalog-grid a:nth-child(2) {
        background:
          linear-gradient(180deg, rgba(8, 18, 14, 0.08), rgba(8, 18, 14, 0.74)),
          url('https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=900&q=80')
            center / cover;
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

      h2,
      .moods p {
        margin: 0;
      }

      .moods p {
        margin-top: 8px;
        color: #66706a;
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
  protected readonly trendingRoadTrips = trendingRoadTrips;
  protected readonly popularDestinations = popularDestinations;
  protected readonly budgetTrips = budgetTrips;
  protected readonly moodCards = moodCards;
}
