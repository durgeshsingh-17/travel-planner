import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap, tap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';

import { CollectionDetail } from '../content/content.models';
import { HideOnErrorDirective } from '../../shared/directives/hide-on-error.directive';
import { ContentApiService } from '../content/content-api.service';
import { DestinationCardComponent } from '../../shared/ui/content-cards/destination-card.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { PlaceCardComponent } from '../../shared/ui/content-cards/place-card.component';
import { SeoService } from '../../core/seo/seo.service';
import { paragraphs } from '../../shared/utils/content-format.util';

@Component({
  selector: 'app-collection-page',
  standalone: true,
  imports: [HideOnErrorDirective, DestinationCardComponent, LoadingStateComponent, MatButtonModule, NgOptimizedImage, PlaceCardComponent, RouterLink],
  template: `
    @if (isLoading()) {
      <main class="content-page"><app-loading-state label="Loading collection" /></main>
    } @else if (collection(); as item) {
      <main class="content-page">
        <section class="page-hero">
          @if (item.cover; as cover) {
            <img appHideOnError [ngSrc]="cover.url" [alt]="cover.altText" fill priority sizes="100vw" />
          }
          <p class="eyebrow light">Collection</p>
          <h1>{{ item.title }}</h1>
          <p class="intro">{{ item.intro }}</p>
        </section>

        @if (body().length) {
          <div class="prose">
            @for (paragraph of body(); track $index) {
              <p>{{ paragraph }}</p>
            }
          </div>
        }

        <ol class="items">
          @for (entry of item.items; track $index) {
            <li>
              @if (entry.destination; as destination) {
                <app-destination-card [destination]="destination" [priority]="$index < 2" />
              } @else if (entry.place; as place) {
                <app-place-card [place]="place" [showRank]="false" />
              }
              @if (entry.blurb) {
                <p class="blurb">{{ entry.blurb }}</p>
              }
            </li>
          }
        </ol>
      </main>
    } @else {
      <main class="content-page">
        <div class="state-message">
          <h1>We could not find that collection</h1>
          <a mat-flat-button color="primary" routerLink="/destinations">Explore destinations</a>
        </div>
      </main>
    }
  `,
  styles: `
    .light { color: rgba(255,255,255,.85); }
    .intro { max-width: 60ch; font-size: 1.1rem; }
    .items { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 18px; margin: 0; padding: 0; list-style: none; }
    .items li { display: grid; gap: 8px; align-content: start; }
    .blurb { margin: 0; color: var(--muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CollectionPageComponent {
  private readonly content = inject(ContentApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly seo = inject(SeoService);

  protected readonly collection = signal<CollectionDetail | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly body = computed(() => paragraphs(this.collection()?.body));

  constructor() {
    this.route.paramMap
      .pipe(
        map((params) => params.get('slug') ?? ''),
        tap(() => this.isLoading.set(true)),
        switchMap((slug) =>
          this.content.collection(slug).pipe(
            catchError(() => {
              this.seo.notFound('Collection');
              return of(null);
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe((collection) => {
        this.collection.set(collection);
        this.isLoading.set(false);

        if (collection) {
          const path = `/collections/${collection.slug}`;
          this.seo.setPage({
            title: collection.seoTitle ?? collection.title,
            description: collection.seoDescription ?? collection.intro,
            path,
            image: collection.cover?.url,
            type: 'article',
            jsonLd: [
              {
                '@context': 'https://schema.org',
                '@type': 'ItemList',
                name: collection.title,
                itemListElement: collection.items.map((entry, index) => ({
                  '@type': 'ListItem',
                  position: index + 1,
                  name: entry.destination?.name ?? entry.place?.name,
                  url: this.seo.absolute(
                    entry.destination
                      ? `/destinations/${entry.destination.slug}`
                      : `/destinations/${entry.place?.destination.slug}/places/${entry.place?.slug}`
                  )
                }))
              }
            ]
          });
        }
      });
  }
}
