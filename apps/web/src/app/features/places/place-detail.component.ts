import { ChangeDetectionStrategy, Component, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { NgOptimizedImage, isPlatformBrowser } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';

import { HideOnErrorDirective } from '../../shared/directives/hide-on-error.directive';
import { ContentApiService } from '../content/content-api.service';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { OpenState, PlaceDetail } from '../content/content.models';
import { PlaceCardComponent } from '../../shared/ui/content-cards/place-card.component';
import { RouteMapComponent } from '../../shared/ui/route-map/route-map.component';
import { SeoService } from '../../core/seo/seo.service';
import { WEEKDAY_NAMES, durationRange, formatInr, labelize, paragraphs } from '../../shared/utils/content-format.util';

const SCHEMA_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

@Component({
  selector: 'app-place-detail',
  standalone: true,
  imports: [HideOnErrorDirective, LoadingStateComponent, MatButtonModule, NgOptimizedImage, PlaceCardComponent, RouteMapComponent, RouterLink],
  template: `
    @if (isLoading()) {
      <main class="content-page"><app-loading-state label="Loading place" /></main>
    } @else if (!place()) {
      <main class="content-page">
        <div class="state-message">
          <h1>We could not find that place</h1>
          <a mat-flat-button color="primary" routerLink="/destinations">Explore destinations</a>
        </div>
      </main>
    } @else if (place(); as item) {
      <main class="content-page">
        <section class="page-hero">
          @if (item.gallery[0]; as cover) {
            <img appHideOnError [ngSrc]="cover.url" [alt]="cover.altText" fill priority sizes="100vw" />
          }
          <ol class="breadcrumbs" aria-label="Breadcrumb">
            <li><a routerLink="/destinations">Destinations</a></li>
            <li><a [routerLink]="['/destinations', item.destination.slug]">{{ item.destination.name }}</a></li>
            <li><a [routerLink]="['/destinations', item.destination.slug, 'places']">Places</a></li>
          </ol>
          <h1>{{ item.name }}</h1>
          <p>
            {{ category() }}
            @if (item.rankInDestination) { · #{{ item.rankInDestination }} of {{ item.placeCount }} in {{ item.destination.name }} }
            @if (item.rating) { · {{ item.rating }}/5 }
          </p>
        </section>

        <div class="layout">
          <div class="content-section">
            <div class="prose">
              <p class="lead">{{ item.description }}</p>
              @for (paragraph of overview(); track $index) {
                <p>{{ paragraph }}</p>
              }
            </div>

            @if (item.tips.length) {
              <section class="content-section">
                <h2>Tips</h2>
                <ul class="tips">
                  @for (tip of item.tips; track tip) {
                    <li>{{ tip }}</li>
                  }
                </ul>
              </section>
            }

            @if (item.tags.length) {
              <ul class="chip-row" aria-label="Tags">
                @for (tag of item.tags; track tag.slug) {
                  <li><span class="chip">{{ tag.name }}</span></li>
                }
              </ul>
            }
          </div>

          <aside class="info-card" aria-label="Visitor information">
            @if (openLabel(); as open) {
              <p class="open" [class.is-open]="item.openNow.status === 'OPEN'">{{ open }}</p>
            }
            <dl>
              @if (timeNeeded(); as time) {
                <div><dt>Time needed</dt><dd>{{ time }}</dd></div>
              }
              @if (item.bestTimeOfDay) {
                <div><dt>Best time</dt><dd>{{ item.bestTimeOfDay }}</dd></div>
              }
              @if (item.isFree) {
                <div><dt>Entry</dt><dd>Free</dd></div>
              } @else {
                @for (fee of fees(); track fee.label) {
                  <div><dt>{{ fee.label }}</dt><dd>{{ fee.value }}</dd></div>
                }
              }
              @if (item.address) {
                <div><dt>Address</dt><dd>{{ item.address }}</dd></div>
              }
            </dl>
            @if (item.feeNotes) {
              <p class="muted small">{{ item.feeNotes }}</p>
            }
            @if (item.timings.length) {
              <details>
                <summary>Opening hours</summary>
                <table>
                  @for (timing of item.timings; track timing.dayOfWeek) {
                    <tr>
                      <th scope="row">{{ weekdays[timing.dayOfWeek] }}</th>
                      <td>{{ timing.isClosed ? 'Closed' : timing.opensAt + ' – ' + timing.closesAt }}</td>
                    </tr>
                  }
                </table>
              </details>
            }
            <a mat-flat-button color="primary" routerLink="/plan" [queryParams]="{ destination: item.destination.name }">
              Plan a trip to {{ item.destination.name }}
            </a>
            <p class="muted small">Details can change. Check locally before you go.</p>
          </aside>
        </div>

        <section class="content-section">
          <header><h2>Location</h2></header>
          <app-route-map [destinationLatitude]="item.latitude" [destinationLongitude]="item.longitude" />
        </section>

        @if (item.faqs.length) {
          <section class="content-section faq-list">
            <header><h2>Frequently asked questions</h2></header>
            <div>
              @for (faq of item.faqs; track faq.question) {
                <details><summary>{{ faq.question }}</summary><p>{{ faq.answer }}</p></details>
              }
            </div>
          </section>
        }

        @if (item.nearby.length) {
          <section class="content-section">
            <header><h2>Nearby places</h2></header>
            <div class="card-grid">
              @for (nearby of item.nearby; track nearby.id) {
                <app-place-card [place]="nearby" [showRank]="false" />
              }
            </div>
          </section>
        }
      </main>
    }
  `,
  styles: `
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 28px; align-items: start; }
    .lead { font-size: 1.1rem; font-weight: 600; }
    .tips { display: grid; gap: 6px; margin: 0; padding-left: 20px; }
    .info-card { position: sticky; top: 84px; display: grid; gap: 12px; padding: 20px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
    .info-card dl { display: grid; gap: 10px; margin: 0; }
    .info-card dt { color: var(--muted); font-size: .8rem; }
    .info-card dd { margin: 2px 0 0; font-weight: 700; }
    .open { margin: 0; font-weight: 800; color: var(--danger); }
    .open.is-open { color: var(--primary); }
    table { width: 100%; margin-top: 8px; border-collapse: collapse; font-size: .9rem; }
    th { text-align: left; font-weight: 600; padding: 3px 0; }
    td { text-align: right; }
    .small { margin: 0; font-size: .82rem; }
    h2 { margin: 0; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } .info-card { position: static; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaceDetailComponent {
  private readonly content = inject(ContentApiService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly seo = inject(SeoService);

  protected readonly weekdays = WEEKDAY_NAMES;
  protected readonly place = signal<PlaceDetail | null>(null);
  protected readonly isLoading = signal(true);

  protected readonly category = computed(() => labelize(this.place()?.category ?? ''));
  protected readonly overview = computed(() => paragraphs(this.place()?.overview));
  protected readonly timeNeeded = computed(() =>
    durationRange(this.place()?.timeRequiredMinMinutes, this.place()?.timeRequiredMaxMinutes)
  );
  protected readonly fees = computed(() => {
    const item = this.place();
    return [
      { label: 'Entry (Indian adult)', value: item?.entryFeeIndian },
      { label: 'Entry (child)', value: item?.entryFeeChild },
      { label: 'Entry (foreign visitor)', value: item?.entryFeeForeigner }
    ]
      .filter((fee): fee is { label: string; value: number } => fee.value != null)
      .map((fee) => ({ label: fee.label, value: fee.value === 0 ? 'Free' : formatInr(fee.value) }));
  });
  protected readonly openLabel = computed(() => this.describeOpen(this.place()?.openNow));

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => ({ destination: params.get('slug') ?? '', place: params.get('placeSlug') ?? '' })),
        tap(() => this.isLoading.set(true)),
        switchMap((slugs) =>
          this.content.place(slugs.destination, slugs.place).pipe(
            map((place) => ({ slugs, place })),
            catchError(() => {
              this.seo.notFound('Place');
              return of({ slugs, place: null });
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe(({ slugs, place }) => {
        this.place.set(place);
        this.isLoading.set(false);

        if (!place) {
          return;
        }

        const path = `/destinations/${place.destination.slug}/places/${place.slug}`;

        if (place.slug !== slugs.place || place.destination.slug !== slugs.destination) {
          this.seo.movedPermanently(path);

          if (this.isBrowser) {
            void this.router.navigateByUrl(path, { replaceUrl: true });
          }
        }

        this.updateSeo(place, path);
      });
  }

  private describeOpen(state?: OpenState): string | null {
    switch (state?.status) {
      case 'OPEN':
        return `Open now · closes ${state.closesAt}`;
      case 'OPENS_LATER':
        return `Opens today at ${state.opensAt}`;
      case 'CLOSED_NOW':
        return 'Closed for today';
      case 'CLOSED_TODAY':
        return 'Closed today';
      default:
        return null;
    }
  }

  private updateSeo(item: PlaceDetail, path: string): void {
    this.seo.setPage({
      title: item.seoTitle ?? `${item.name}, ${item.destination.name}: timings, entry fee, tips`,
      description: item.seoDescription ?? item.description,
      path,
      image: item.gallery[0]?.url,
      type: 'article',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'TouristAttraction',
          name: item.name,
          description: item.description,
          url: this.seo.absolute(path),
          image: item.gallery.map((image) => image.url).slice(0, 5),
          geo: { '@type': 'GeoCoordinates', latitude: item.latitude, longitude: item.longitude },
          isAccessibleForFree: item.isFree || undefined,
          containedInPlace: { '@type': 'TouristDestination', name: item.destination.name },
          openingHoursSpecification: item.timings
            .filter((timing) => !timing.isClosed && timing.opensAt && timing.closesAt)
            .map((timing) => ({
              '@type': 'OpeningHoursSpecification',
              dayOfWeek: `https://schema.org/${SCHEMA_DAYS[timing.dayOfWeek]}`,
              opens: timing.opensAt,
              closes: timing.closesAt
            }))
        },
        this.seo.breadcrumbs([
          { name: 'Destinations', path: '/destinations' },
          { name: item.destination.name, path: `/destinations/${item.destination.slug}` },
          { name: item.name, path }
        ]),
        ...[this.seo.faqPage(item.faqs)].filter((entry): entry is object => entry !== null)
      ]
    });
  }
}
