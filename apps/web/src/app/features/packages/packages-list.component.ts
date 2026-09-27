import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';

import { ContentApiService } from '../content/content-api.service';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { MONTH_NAMES } from '../../shared/utils/content-format.util';
import { PackageCard, PackageFacets, PackageQuery, Page, TierLevel } from '../content/content.models';
import { PackageCardComponent } from '../../shared/ui/content-cards/package-card.component';
import { SeoService } from '../../core/seo/seo.service';
import { TIER_LABELS } from '../quotes/quotes.models';

const PAGE_SIZE = 24;
const LENGTHS = [
  { value: '1-2', label: '1–2 nights', min: 1, max: 2 },
  { value: '3-4', label: '3–4 nights', min: 3, max: 4 },
  { value: '5-7', label: '5–7 nights', min: 5, max: 7 },
  { value: '8-59', label: '8+ nights', min: 8, max: 59 }
];
const BUDGETS = [10000, 20000, 35000, 50000];

function queryFrom(params: ParamMap): PackageQuery & { length?: string } {
  const number = (key: string) => {
    const value = Number(params.get(key));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  };
  const length = LENGTHS.find((option) => option.value === params.get('length'));

  return {
    destination: params.get('destination') ?? undefined,
    month: number('month'),
    length: length?.value,
    nightsMin: length?.min,
    nightsMax: length?.max,
    priceMax: number('priceMax'),
    tier: (params.get('tier') as TierLevel | null) ?? undefined,
    tag: params.getAll('tag').length ? params.getAll('tag') : undefined,
    sort: (params.get('sort') as PackageQuery['sort']) ?? undefined,
    page: number('page'),
    pageSize: PAGE_SIZE
  };
}

@Component({
  selector: 'app-packages-list',
  standalone: true,
  imports: [LoadingStateComponent, MatButtonModule, MatChipsModule, MatFormFieldModule, MatSelectModule, PackageCardComponent, RouterLink],
  template: `
    <main class="content-page">
      <header class="intro">
        <p class="eyebrow">Holiday packages</p>
        <h1>Packages you can customise</h1>
        <p class="muted">Pick a package, choose a hotel tier, and get quotes from up to three verified agencies.</p>
      </header>

      <section class="filters" aria-label="Filters">
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Destination</mat-label>
          <mat-select [value]="query().destination ?? ''" (selectionChange)="set('destination', $event.value)">
            <mat-option value="">Anywhere</mat-option>
            @for (destination of facets()?.destinations ?? []; track destination.slug) {
              <mat-option [value]="destination.slug">{{ destination.name }} ({{ destination.count }})</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Travel month</mat-label>
          <mat-select [value]="query().month ?? 0" (selectionChange)="set('month', $event.value)">
            <mat-option [value]="0">Any month</mat-option>
            @for (month of months; track month.value) { <mat-option [value]="month.value">{{ month.label }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Length</mat-label>
          <mat-select [value]="query().length ?? ''" (selectionChange)="set('length', $event.value)">
            <mat-option value="">Any length</mat-option>
            @for (option of lengths; track option.value) { <mat-option [value]="option.value">{{ option.label }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Budget per person</mat-label>
          <mat-select [value]="query().priceMax ?? 0" (selectionChange)="set('priceMax', $event.value)">
            <mat-option [value]="0">Any budget</mat-option>
            @for (budget of budgets; track budget) { <mat-option [value]="budget">Up to ₹{{ budget.toLocaleString('en-IN') }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Hotel tier</mat-label>
          <mat-select [value]="query().tier ?? ''" (selectionChange)="set('tier', $event.value)">
            <mat-option value="">Any tier</mat-option>
            @for (tier of tiers; track tier.value) { <mat-option [value]="tier.value">{{ tier.label }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" subscriptSizing="dynamic">
          <mat-label>Sort</mat-label>
          <mat-select [value]="query().sort ?? 'popular'" (selectionChange)="set('sort', $event.value)">
            <mat-option value="popular">Recommended</mat-option>
            <mat-option value="price_asc">Price: low to high</mat-option>
            <mat-option value="price_desc">Price: high to low</mat-option>
            <mat-option value="duration">Shortest first</mat-option>
            <mat-option value="rating">Best rated</mat-option>
          </mat-select>
        </mat-form-field>
      </section>

      @if (themes().length) {
        <mat-chip-listbox aria-label="Themes" multiple [value]="query().tag ?? []" (change)="set('tag', $event.value)">
          @for (theme of themes(); track theme.slug) {
            <mat-chip-option [value]="theme.slug">{{ theme.name }} · {{ theme.count }}</mat-chip-option>
          }
        </mat-chip-listbox>
      }

      <section class="content-section" aria-live="polite">
        <header>
          <h2>{{ heading() }}</h2>
          @if (filtered()) { <a mat-button routerLink="/packages">Clear filters</a> }
        </header>
        @if (isLoading()) {
          <app-loading-state label="Finding packages" />
        } @else if (results()?.items?.length) {
          <div class="card-grid">
            @for (pkg of results()!.items; track pkg.id; let index = $index) {
              <app-package-card [pkg]="pkg" [priority]="index < 3" />
            }
          </div>
          @if (pages() > 1) {
            <nav class="chip-row pager" aria-label="Pages">
              @if (page() > 1) {
                <a mat-stroked-button [routerLink]="[]" [queryParams]="{ page: page() - 1 > 1 ? page() - 1 : null }" queryParamsHandling="merge">Previous</a>
              }
              <span>Page {{ page() }} of {{ pages() }}</span>
              @if (page() < pages()) {
                <a mat-stroked-button [routerLink]="[]" [queryParams]="{ page: page() + 1 }" queryParamsHandling="merge">Next</a>
              }
            </nav>
          }
        } @else {
          <div class="state-message">
            <p>No packages match these filters yet.</p>
            <p class="muted">Tell us what you have in mind and agencies will build one for you.</p>
            <a mat-flat-button color="primary" routerLink="/quote">Request a custom quote</a>
          </div>
        }
      </section>
    </main>
  `,
  styles: `
    .intro { display: grid; gap: 8px; max-width: 760px; }
    .intro h1 { margin: 0; font-size: clamp(2rem, 5vw, 3rem); }
    .intro p { margin: 0; }
    .filters { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 12px; }
    .pager { justify-content: center; align-items: center; gap: 16px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PackagesListComponent {
  private readonly content = inject(ContentApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  protected readonly months = MONTH_NAMES.map((label, index) => ({ label, value: index + 1 }));
  protected readonly lengths = LENGTHS;
  protected readonly budgets = BUDGETS;
  protected readonly tiers = (Object.keys(TIER_LABELS) as TierLevel[]).map((value) => ({ value, label: TIER_LABELS[value] }));

  protected readonly query = signal<ReturnType<typeof queryFrom>>({});
  protected readonly facets = signal<PackageFacets | null>(null);
  protected readonly results = signal<Page<PackageCard> | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly themes = computed(() => (this.facets()?.tags ?? []).filter((tag) => tag.kind === 'THEME'));
  protected readonly page = computed(() => this.results()?.page ?? 1);
  protected readonly pages = computed(() => {
    const results = this.results();
    return results ? Math.max(1, Math.ceil(results.total / results.pageSize)) : 1;
  });
  protected readonly filtered = computed(() =>
    Object.entries(this.query()).some(([key, value]) => !['pageSize', 'page', 'nightsMin', 'nightsMax'].includes(key) && value !== undefined)
  );
  protected readonly heading = computed(() => {
    const total = this.results()?.total;
    return total === undefined ? 'Packages' : `${total} package${total === 1 ? '' : 's'}`;
  });

  constructor() {
    this.content.packageFacets().pipe(takeUntilDestroyed()).subscribe({ next: (facets) => this.facets.set(facets), error: () => this.facets.set(null) });

    this.route.queryParamMap
      .pipe(
        map(queryFrom),
        tap((query) => {
          this.query.set(query);
          this.isLoading.set(true);
        }),
        switchMap(({ length: _length, ...query }) => this.content.packages(query).pipe(catchError(() => of(null)))),
        takeUntilDestroyed()
      )
      .subscribe((results) => {
        this.results.set(results);
        this.isLoading.set(false);
        this.seo.setPage({
          title: 'Holiday packages in India',
          description: 'Customisable holiday packages with day-wise itineraries, hotel tiers and transparent prices. Compare quotes from verified agencies.',
          path: '/packages',
          noindex: this.filtered(),
          jsonLd: results
            ? [
                {
                  '@context': 'https://schema.org',
                  '@type': 'ItemList',
                  itemListElement: results.items.map((item, index) => ({
                    '@type': 'ListItem',
                    position: index + 1,
                    name: item.title,
                    url: this.seo.absolute(`/packages/${item.slug}`)
                  }))
                }
              ]
            : []
        });
      });
  }

  protected set(key: string, value: unknown): void {
    const empty = value === '' || value === 0 || value === null || (Array.isArray(value) && !value.length);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { [key]: empty || (key === 'sort' && value === 'popular') ? null : value, page: null },
      queryParamsHandling: 'merge'
    });
  }
}
