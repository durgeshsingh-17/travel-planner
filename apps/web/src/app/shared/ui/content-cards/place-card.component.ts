import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';

import { HideOnErrorDirective } from '../../directives/hide-on-error.directive';

import { PlaceCard } from '../../../features/content/content.models';
import { durationRange, formatInr, labelize } from '../../utils/content-format.util';

@Component({
  selector: 'app-place-card',
  standalone: true,
  imports: [HideOnErrorDirective, NgOptimizedImage, RouterLink],
  template: `
    @let item = place();
    <a class="card" [routerLink]="['/destinations', item.destination.slug, 'places', item.slug]">
      <div class="media">
        @if (item.cover; as cover) {
          <img appHideOnError [ngSrc]="cover.url" [alt]="cover.altText" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" />
        }
        @if (item.rankInDestination && showRank()) {
          <span class="rank">#{{ item.rankInDestination }}</span>
        }
      </div>
      <div class="body">
        <p class="category">{{ category() }}</p>
        <h3>{{ item.name }}</h3>
        <p class="summary">{{ item.description }}</p>
        @if (facts().length) {
          <p class="facts">{{ facts().join(' · ') }}</p>
        }
      </div>
    </a>
  `,
  styles: `
    .card { display: grid; grid-template-rows: auto 1fr; height: 100%; overflow: hidden; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); color: var(--text); text-decoration: none; }
    .card:hover, .card:focus-visible { border-color: var(--primary); }
    .media { position: relative; aspect-ratio: 16 / 9; background: linear-gradient(135deg, #3a8f86, #d9902f); }
    .media img { object-fit: cover; }
    .rank { position: absolute; top: 10px; left: 10px; padding: 2px 8px; border-radius: 999px; background: rgba(0,0,0,.65); color: #fff; font-size: .8rem; font-weight: 800; }
    .body { display: grid; align-content: start; gap: 4px; padding: 12px 14px 14px; }
    .category { margin: 0; color: var(--primary); font-size: .75rem; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }
    h3 { margin: 0; font-size: 1.05rem; }
    .summary { margin: 0; color: var(--muted); font-size: .9rem; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .facts { margin: 4px 0 0; font-size: .82rem; font-weight: 700; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlaceCardComponent {
  readonly place = input.required<PlaceCard>();
  readonly showRank = input(true);

  protected readonly category = computed(() => labelize(this.place().category));
  protected readonly facts = computed(() => {
    const item = this.place();
    return [
      item.distanceKm != null ? `${item.distanceKm} km away` : null,
      durationRange(item.timeRequiredMinMinutes, item.timeRequiredMaxMinutes),
      item.isFree ? 'Free entry' : item.entryFeeIndian != null ? formatInr(item.entryFeeIndian) : null,
      item.rating ? `${item.rating}/5` : null
    ].filter((fact): fact is string => Boolean(fact));
  });
}
