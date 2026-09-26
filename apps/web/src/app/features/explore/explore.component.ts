import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { BehaviorSubject, catchError, combineLatest, map, of, switchMap, tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { ContentApiService } from '../content/content-api.service';
import { DestinationCard, DestinationFacets, DestinationQuery, Page } from '../content/content.models';
import { DestinationCardComponent } from '../../shared/ui/content-cards/destination-card.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { MONTH_NAMES } from '../../shared/utils/content-format.util';
import { SearchBoxComponent } from '../../shared/ui/search-box/search-box.component';
import { SeoService } from '../../core/seo/seo.service';

const PAGE_SIZE = 24;
const DAY_OPTIONS = [1, 2, 3, 4, 5, 7, 10];
const BUDGET_OPTIONS = [1500, 2500, 4000, 6000];

function queryFrom(params: ParamMap): DestinationQuery {
  const number = (key: string) => {
    const value = Number(params.get(key));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  };

  return {
    q: params.get('q') ?? undefined,
    state: params.get('state') ?? undefined,
    tag: params.getAll('tag').length ? params.getAll('tag') : undefined,
    month: number('month'),
    days: number('days'),
    budgetMax: number('budgetMax'),
    sort: params.get('sort') === 'name' ? 'name' : undefined,
    page: number('page'),
    pageSize: PAGE_SIZE
  };
}

@Component({
  selector: 'app-explore',
  standalone: true,
  imports: [
    DestinationCardComponent,
    LoadingStateComponent,
    MatButtonModule,
    MatChipsModule,
    MatFormFieldModule,
    MatSelectModule,
    RouterLink,
    SearchBoxComponent
  ],
  template: `
    <main class="content-page explore">
      <header class="intro">
        <p class="eyebrow">Explore India</p>
        <h1>Find your next destination</h1>
        <p class="muted">Filter by theme, the month you travel, trip length and daily budget.</p>
        <app-search-box />
      </header>

      <section class="filters" aria-label="Filters">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>State</mat-label>
          <mat-select [value]="query().state ?? ''" (selectionChange)="setFilter('state', $event.value)">
            <mat-option value="">All states</mat-option>
            @for (state of facets()?.states ?? []; track state.value) {
              <mat-option [value]="state.value">{{ state.value }} ({{ state.count }})</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Travel month</mat-label>
          <mat-select [value]="query().month ?? 0" (selectionChange)="setFilter('month', $event.value)">
            <mat-option [value]="0">Any month</mat-option>
            @for (month of months; track month.value) {
              <mat-option [value]="month.value">{{ month.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Trip length</mat-label>
          <mat-select [value]="query().days ?? 0" (selectionChange)="setFilter('days', $event.value)">
            <mat-option [value]="0">Any length</mat-option>
            @for (days of dayOptions; track days) {
              <mat-option [value]="days">{{ days }} day{{ days === 1 ? '' : 's' }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Budget per day</mat-label>
          <mat-select [value]="query().budgetMax ?? 0" (selectionChange)="setFilter('budgetMax', $event.value)">
            <mat-option [value]="0">Any budget</mat-option>
            @for (budget of budgetOptions; track budget) {
              <mat-option [value]="budget">Up to ₹{{ budget.toLocaleString('en-IN') }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Sort</mat-label>
          <mat-select [value]="query().sort ?? 'popular'" (selectionChange)="setFilter('sort', $event.value)">
            <mat-option value="popular">Most popular</mat-option>
            <mat-option value="name">A–Z</mat-option>
          </mat-select>
        </mat-form-field>
      </section>

      @if (themes().length) {
        <mat-chip-listbox
          aria-label="Themes"
          multiple
          [value]="query().tag ?? []"
          (change)="setFilter('tag', $event.value)"
        >
          @for (theme of themes(); track theme.slug) {
            <mat-chip-option [value]="theme.slug">{{ theme.name }} · {{ theme.count }}</mat-chip-option>
          }
        </mat-chip-listbox>
      }

      <section class="content-section" aria-live="polite">
        <header>
          <h2>{{ resultsHeading() }}</h2>
          @if (hasFilters()) {
            <a mat-button routerLink="/destinations">Clear filters</a>
          }
        </header>

        @if (isLoading()) {
          <app-loading-state label="Finding destinations" />
        } @else if (errorMessage()) {
          <div class="state-message">
            <p>{{ errorMessage() }}</p>
            <button mat-stroked-button type="button" (click)="retry()">Try again</button>
          </div>
        } @else if (results()?.items?.length) {
          <div class="card-grid">
            @for (destination of results()!.items; track destination.id; let index = $index) {
              <app-destination-card [destination]="destination" [priority]="index < 3" />
            }
          </div>

          @if (pageCount() > 1) {
            <nav class="pager" aria-label="Pages">
              <a
                mat-stroked-button
                [class.disabled]="currentPage() === 1"
                [attr.aria-disabled]="currentPage() === 1"
                [routerLink]="[]"
                [queryParams]="{ page: currentPage() - 1 > 1 ? currentPage() - 1 : null }"
                queryParamsHandling="merge"
              >Previous</a>
              <span>Page {{ currentPage() }} of {{ pageCount() }}</span>
              <a
                mat-stroked-button
                [class.disabled]="currentPage() === pageCount()"
                [attr.aria-disabled]="currentPage() === pageCount()"
                [routerLink]="[]"
                [queryParams]="{ page: currentPage() + 1 }"
                queryParamsHandling="merge"
              >Next</a>
            </nav>
          }
        } @else {
          <div class="state-message">
            <p>No destinations match these filters yet.</p>
            <a mat-stroked-button routerLink="/destinations">Show all destinations</a>
          </div>
        }
      </section>
    </main>
  `,
  styles: `
    .intro { display: grid; gap: 10px; max-width: 760px; }
    .intro h1 { margin: 0; font-size: clamp(2rem, 5vw, 3rem); }
    .intro p { margin: 0; }
    .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
    .pager { display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 12px; }
    .pager .disabled { pointer-events: none; opacity: .5; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ExploreComponent {
  private readonly content = inject(ContentApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  protected readonly months = MONTH_NAMES.map((label, index) => ({ label, value: index + 1 }));
  protected readonly dayOptions = DAY_OPTIONS;
  protected readonly budgetOptions = BUDGET_OPTIONS;

  protected readonly query = signal<DestinationQuery>({});
  protected readonly facets = signal<DestinationFacets | null>(null);
  protected readonly results = signal<Page<DestinationCard> | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly themes = computed(() => (this.facets()?.tags ?? []).filter((tag) => tag.kind === 'THEME'));
  protected readonly currentPage = computed(() => this.results()?.page ?? 1);
  protected readonly pageCount = computed(() => {
    const page = this.results();
    return page ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;
  });
  protected readonly hasFilters = computed(() => {
    const { pageSize: _pageSize, page: _page, ...filters } = this.query();
    return Object.values(filters).some((value) => value !== undefined);
  });
  protected readonly resultsHeading = computed(() => {
    const total = this.results()?.total;
    return total === undefined ? 'Destinations' : `${total} destination${total === 1 ? '' : 's'}`;
  });

  private readonly reload = new BehaviorSubject<void>(undefined);

  constructor() {
    this.content
      .facets()
      .pipe(takeUntilDestroyed())
      .subscribe({ next: (facets) => this.facets.set(facets), error: () => this.facets.set(null) });

    combineLatest([this.route.queryParamMap, this.reload])
      .pipe(
        map(([params]) => queryFrom(params)),
        tap((query) => {
          this.query.set(query);
          this.isLoading.set(true);
          this.errorMessage.set(null);
          this.updateSeo(query);
        }),
        switchMap((query) =>
          this.content.destinations(query).pipe(
            catchError((error: Error) => {
              this.errorMessage.set(error.message);
              return of(null);
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe((results) => {
        this.results.set(results);
        this.isLoading.set(false);

        if (results) {
          this.seo.setPage({ ...this.pageMeta(this.query()), jsonLd: [this.itemList(results.items)] });
        }
      });
  }

  protected setFilter(key: keyof DestinationQuery, value: unknown): void {
    const empty = value === '' || value === 0 || value === null || (Array.isArray(value) && !value.length);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [key]: empty || (key === 'sort' && value === 'popular') ? null : value, page: null },
      queryParamsHandling: 'merge'
    });
  }

  protected retry(): void {
    this.reload.next();
  }

  private updateSeo(query: DestinationQuery): void {
    this.seo.setPage(this.pageMeta(query));
  }

  private pageMeta(query: DestinationQuery) {
    const filtered = Object.entries(query).some(([key, value]) => key !== 'pageSize' && value !== undefined);
    const month = query.month ? MONTH_NAMES[query.month - 1] : null;

    return {
      title: month ? `Destinations to visit in ${month}` : 'Explore destinations in India',
      description:
        'Browse destination guides across India by theme, best month to visit, trip length and daily budget, then plan a day-wise road trip.',
      path: '/destinations',
      // Filter combinations are for people, not crawlers; the unfiltered list is the indexable page.
      noindex: filtered
    };
  }

  private itemList(items: DestinationCard[]): object {
    return {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      itemListElement: items.map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        url: this.seo.absolute(`/destinations/${item.slug}`)
      }))
    };
  }
}
