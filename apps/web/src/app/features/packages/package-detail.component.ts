import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';

import { ContentApiService } from '../content/content-api.service';
import { HideOnErrorDirective } from '../../shared/directives/hide-on-error.directive';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { MONTH_NAMES, formatInr, monthRanges, paragraphs } from '../../shared/utils/content-format.util';
import { PackageCardComponent } from '../../shared/ui/content-cards/package-card.component';
import { PackageDetail, TierLevel } from '../content/content.models';
import { ReviewsSectionComponent } from '../../shared/ui/reviews/reviews-section.component';
import { SeoService } from '../../core/seo/seo.service';
import { TIER_LABELS } from '../quotes/quotes.models';

const MEAL_PLANS: Record<string, string> = {
  EP: 'Room only',
  CP: 'Breakfast',
  MAP: 'Breakfast and dinner',
  AP: 'All meals'
};
const MEALS: Record<string, string> = { B: 'Breakfast', L: 'Lunch', D: 'Dinner' };
const POLICY_LABELS: Record<string, string> = {
  CANCELLATION: 'Cancellation',
  PAYMENT: 'Payment',
  CHILD: 'Children',
  GENERAL: 'Good to know'
};

@Component({
  selector: 'app-package-detail',
  standalone: true,
  imports: [
    HideOnErrorDirective,
    LoadingStateComponent,
    MatButtonModule,
    MatButtonToggleModule,
    NgOptimizedImage,
    PackageCardComponent,
    ReviewsSectionComponent,
    RouterLink
  ],
  templateUrl: './package-detail.component.html',
  styleUrl: './package-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PackageDetailComponent {
  private readonly content = inject(ContentApiService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  protected readonly pkg = signal<PackageDetail | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly selectedTier = signal<TierLevel | null>(null);
  protected readonly tierLabels = TIER_LABELS;
  protected readonly mealPlans = MEAL_PLANS;
  protected readonly meals = MEALS;
  protected readonly policyLabels = POLICY_LABELS;
  protected readonly format = formatInr;

  protected readonly tier = computed(() => {
    const pkg = this.pkg();
    return pkg?.tiers.find((tier) => tier.level === this.selectedTier()) ?? pkg?.tiers[0] ?? null;
  });
  protected readonly overview = computed(() => paragraphs(this.pkg()?.overview));
  protected readonly routeText = computed(() => (this.pkg()?.route ?? []).map((stop) => `${stop.name} ${stop.nights}N`).join(' → '));
  protected readonly season = computed(() => {
    const months = this.pkg()?.availableMonths ?? [];
    return months.length ? monthRanges(months) : 'All year';
  });
  protected readonly quoteParams = computed(() => ({ package: this.pkg()?.slug, tier: this.tier()?.level }));

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('slug') ?? ''),
        tap(() => this.isLoading.set(true)),
        switchMap((slug) =>
          this.content.package(slug).pipe(
            map((pkg) => ({ slug, pkg })),
            catchError(() => {
              this.seo.notFound('Package');
              return of({ slug, pkg: null });
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe(({ slug, pkg }) => {
        this.pkg.set(pkg);
        this.isLoading.set(false);

        if (!pkg) return;

        const requested = this.route.snapshot.queryParamMap.get('tier') as TierLevel | null;
        this.selectedTier.set(pkg.tiers.some((tier) => tier.level === requested) ? requested : (pkg.tiers[0]?.level ?? null));

        if (pkg.slug !== slug) {
          this.seo.movedPermanently(`/packages/${pkg.slug}`);
          if (this.isBrowser) void this.router.navigate(['/packages', pkg.slug], { replaceUrl: true });
        }

        this.updateSeo(pkg);
      });
  }

  protected monthName(month: number): string {
    return MONTH_NAMES[month - 1];
  }

  protected mealName = (code: string): string => MEALS[code] ?? code;

  private updateSeo(pkg: PackageDetail): void {
    const path = `/packages/${pkg.slug}`;
    this.seo.setPage({
      title: pkg.seoTitle ?? `${pkg.title} (${pkg.durationNights}N/${pkg.durationDays}D)${pkg.fromPrice ? ` from ${formatInr(pkg.fromPrice)}` : ''}`,
      description: pkg.seoDescription ?? pkg.summary,
      path,
      image: pkg.gallery[0]?.url,
      type: 'article',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'TouristTrip',
          name: pkg.title,
          description: pkg.summary,
          url: this.seo.absolute(path),
          image: pkg.gallery.map((image) => image.url).slice(0, 5),
          touristType: pkg.tags.map((tag) => tag.name),
          itinerary: {
            '@type': 'ItemList',
            itemListElement: pkg.route.map((stop, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              item: { '@type': 'TouristDestination', name: stop.name }
            }))
          },
          offers: pkg.tiers.map((tier) => ({
            '@type': 'Offer',
            name: TIER_LABELS[tier.level],
            price: tier.pricePerPerson,
            priceCurrency: 'INR',
            url: this.seo.absolute(`${path}?tier=${tier.level}`)
          })),
          // Only real, moderated reviews are ever marked up.
          ...(pkg.reviewSummary.count
            ? {
                aggregateRating: {
                  '@type': 'AggregateRating',
                  ratingValue: pkg.reviewSummary.average,
                  reviewCount: pkg.reviewSummary.count,
                  bestRating: 5
                }
              }
            : {})
        },
        this.seo.breadcrumbs([
          { name: 'Packages', path: '/packages' },
          { name: pkg.title, path }
        ]),
        ...[this.seo.faqPage(pkg.faqs)].filter((entry): entry is object => entry !== null)
      ]
    });
  }
}
