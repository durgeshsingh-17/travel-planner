import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, switchMap, tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';

import { ContentApiService } from '../content/content-api.service';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { Page, PlaceCard } from '../content/content.models';
import { PlaceCardComponent } from '../../shared/ui/content-cards/place-card.component';
import { SeoService } from '../../core/seo/seo.service';
import { labelize } from '../../shared/utils/content-format.util';

const CATEGORIES = ['ATTRACTION', 'VIEWPOINT', 'ACTIVITY', 'FOOD', 'CAFE', 'HOTEL'];

@Component({
  selector: 'app-destination-places',
  standalone: true,
  imports: [LoadingStateComponent, MatButtonModule, PlaceCardComponent, RouterLink],
  template: `
    <main class="content-page">
      @if (result(); as page) {
        <header class="content-section">
          <ol class="breadcrumbs" aria-label="Breadcrumb">
            <li><a routerLink="/destinations">Destinations</a></li>
            <li><a [routerLink]="['/destinations', page.destination.slug]">{{ page.destination.name }}</a></li>
            <li>Places</li>
          </ol>
          <h1>{{ page.total }} places to visit in {{ page.destination.name }}</h1>
          <ul class="chip-row" aria-label="Filter by category">
            <li><a class="chip" [class.active]="!category()" [routerLink]="[]">All</a></li>
            @for (option of categories; track option) {
              <li>
                <a class="chip" [class.active]="category() === option" [routerLink]="[]" [queryParams]="{ category: option }">
                  {{ labelize(option) }}
                </a>
              </li>
            }
          </ul>
        </header>
        @if (page.items.length) {
          <div class="card-grid">
            @for (place of page.items; track place.id) {
              <app-place-card [place]="place" />
            }
          </div>
        } @else {
          <p class="muted">No places in this category yet.</p>
        }
        @if (page.total > page.page * page.pageSize || page.page > 1) {
          <nav class="chip-row" aria-label="Pages">
            @if (page.page > 1) {
              <a mat-stroked-button [routerLink]="[]" [queryParams]="{ page: page.page - 1 }" queryParamsHandling="merge">Previous</a>
            }
            @if (page.total > page.page * page.pageSize) {
              <a mat-stroked-button [routerLink]="[]" [queryParams]="{ page: page.page + 1 }" queryParamsHandling="merge">Next</a>
            }
          </nav>
        }
      } @else if (isLoading()) {
        <app-loading-state label="Loading places" />
      } @else {
        <div class="state-message">
          <h1>Places not found</h1>
          <a mat-flat-button color="primary" routerLink="/destinations">Explore destinations</a>
        </div>
      }
    </main>
  `,
  styles: `
    h1 { margin: 0; font-size: clamp(1.6rem, 4vw, 2.4rem); }
    .chip.active { border-color: var(--primary); background: var(--primary); color: #fff; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DestinationPlacesComponent {
  private readonly content = inject(ContentApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);

  protected readonly categories = CATEGORIES;
  protected readonly labelize = labelize;
  protected readonly result = signal<(Page<PlaceCard> & { destination: { slug: string; name: string } }) | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly category = signal<string | null>(null);
  protected readonly title = computed(() => this.result()?.destination.name ?? '');

  constructor() {
    combineLatest([this.route.paramMap, this.route.queryParamMap])
      .pipe(
        map(([params, query]) => ({
          slug: params.get('slug') ?? '',
          category: query.get('category'),
          page: Number(query.get('page')) || undefined
        })),
        tap((request) => {
          this.isLoading.set(true);
          this.category.set(request.category);
        }),
        switchMap((request) =>
          this.content
            .destinationPlaces(request.slug, { category: request.category ?? undefined, page: request.page })
            .pipe(
              catchError(() => {
                this.seo.notFound('Places');
                return of(null);
              })
            )
        ),
        takeUntilDestroyed()
      )
      .subscribe((result) => {
        this.result.set(result);
        this.isLoading.set(false);

        if (result) {
          const path = `/destinations/${result.destination.slug}/places`;
          this.seo.setPage({
            title: `${result.total} best places to visit in ${result.destination.name}`,
            description: `Top attractions, viewpoints and things to do in ${result.destination.name}, with time needed, entry fees and opening hours.`,
            path,
            noindex: Boolean(this.category()) || result.page > 1,
            jsonLd: [
              this.seo.breadcrumbs([
                { name: 'Destinations', path: '/destinations' },
                { name: result.destination.name, path: `/destinations/${result.destination.slug}` },
                { name: 'Places', path }
              ])
            ]
          });
        }
      });
  }
}
