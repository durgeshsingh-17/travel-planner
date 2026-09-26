import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';

import { HideOnErrorDirective } from '../../shared/directives/hide-on-error.directive';
import { ContentApiService } from '../content/content-api.service';
import { DestinationCardComponent } from '../../shared/ui/content-cards/destination-card.component';
import { DestinationDetail, HowToReach, MonthRating } from '../content/content.models';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { PlaceCardComponent } from '../../shared/ui/content-cards/place-card.component';
import { RouteMapComponent } from '../../shared/ui/route-map/route-map.component';
import { SeoService } from '../../core/seo/seo.service';
import {
  MONTH_NAMES,
  dayRange,
  formatMinutes,
  inrRange,
  labelize,
  monthRanges,
  paragraphs
} from '../../shared/utils/content-format.util';

const REACH_LABELS: Record<HowToReach['mode'], string> = {
  ROAD: 'By road',
  TRAIN: 'By train',
  AIR: 'By air',
  BUS: 'By bus'
};

const RATING_LABELS: Record<MonthRating, string> = { GOOD: 'Great time', OK: 'Okay', AVOID: 'Avoid' };

@Component({
  selector: 'app-destination-detail',
  standalone: true,
  imports: [
    HideOnErrorDirective,
    DestinationCardComponent,
    LoadingStateComponent,
    MatButtonModule,
    NgOptimizedImage,
    PlaceCardComponent,
    RouteMapComponent,
    RouterLink
  ],
  templateUrl: './destination-detail.component.html',
  styleUrl: './destination-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DestinationDetailComponent {
  private readonly content = inject(ContentApiService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  protected readonly destination = signal<DestinationDetail | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly notFound = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly reachLabels = REACH_LABELS;
  protected readonly ratingLabels = RATING_LABELS;
  protected readonly monthNames = MONTH_NAMES;
  protected readonly formatMinutes = formatMinutes;
  protected readonly inrRange = inrRange;

  protected readonly overview = computed(() => paragraphs(this.destination()?.overview));
  protected readonly facts = computed(() => {
    const item = this.destination();

    if (!item) {
      return [];
    }

    const good = item.months.filter((month) => month.rating === 'GOOD').map((month) => month.month);
    return [
      { label: 'Best time', value: monthRanges(good) ?? item.bestTimeToVisit },
      { label: 'Ideal trip', value: dayRange(item.idealDaysMin, item.idealDaysMax) },
      { label: 'Budget per day', value: inrRange(item.budgetPerDayMin, item.budgetPerDayMax) },
      { label: 'Altitude', value: item.altitudeM ? `${item.altitudeM.toLocaleString('en-IN')} m` : null },
      {
        label: 'Nearest airport',
        value: item.nearestAirport
          ? `${item.nearestAirport}${item.nearestAirportKm ? ` (${item.nearestAirportKm} km)` : ''}`
          : null
      },
      {
        label: 'Nearest railway',
        value: item.nearestRailway
          ? `${item.nearestRailway}${item.nearestRailwayKm ? ` (${item.nearestRailwayKm} km)` : ''}`
          : null
      }
    ].filter((fact): fact is { label: string; value: string } => Boolean(fact.value));
  });
  protected readonly monthStrip = computed(() => {
    const months = new Map((this.destination()?.months ?? []).map((month) => [month.month, month]));
    return MONTH_NAMES.map((name, index) => ({ name, info: months.get(index + 1) ?? null }));
  });
  protected readonly themes = computed(() => (this.destination()?.tags ?? []).map((tag) => ({ ...tag, label: labelize(tag.kind) })));

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('slug') ?? ''),
        tap(() => {
          this.isLoading.set(true);
          this.notFound.set(false);
          this.errorMessage.set(null);
        }),
        switchMap((slug) =>
          this.content.destination(slug).pipe(
            map((destination) => ({ slug, destination })),
            catchError((error: Error & { status?: number }) => {
              if (error.status === 404) {
                this.notFound.set(true);
                this.seo.notFound('Destination');
              } else {
                this.errorMessage.set(error.message);
              }

              return of({ slug, destination: null });
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe(({ slug, destination }) => {
        this.isLoading.set(false);
        this.destination.set(destination);

        if (!destination) {
          return;
        }

        if (destination.slug !== slug) {
          // The API followed a slug redirect: make the URL match the content.
          this.seo.movedPermanently(`/destinations/${destination.slug}`);

          if (this.isBrowser) {
            void this.router.navigate(['/destinations', destination.slug], { replaceUrl: true });
          }
        }

        this.updateSeo(destination);
      });
  }

  private updateSeo(item: DestinationDetail): void {
    const path = `/destinations/${item.slug}`;

    this.seo.setPage({
      title: item.seoTitle ?? `${item.name} travel guide: places to visit, best time, how to reach`,
      description: item.seoDescription ?? item.shortDescription,
      path,
      image: item.cover?.url,
      type: 'article',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'TouristDestination',
          name: item.name,
          description: item.shortDescription,
          url: this.seo.absolute(path),
          image: item.gallery.map((image) => image.url).slice(0, 5),
          geo: { '@type': 'GeoCoordinates', latitude: item.latitude, longitude: item.longitude },
          containedInPlace: { '@type': 'AdministrativeArea', name: item.state },
          includesAttraction: item.places.map((place) => ({
            '@type': 'TouristAttraction',
            name: place.name,
            url: this.seo.absolute(`${path}/places/${place.slug}`)
          }))
        },
        this.seo.breadcrumbs([
          { name: 'Destinations', path: '/destinations' },
          { name: item.name, path }
        ]),
        ...[this.seo.faqPage(item.faqs)].filter((entry): entry is object => entry !== null)
      ]
    });
  }
}
