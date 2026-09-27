import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';

import { HideOnErrorDirective } from '../../directives/hide-on-error.directive';
import { PackageCard } from '../../../features/content/content.models';
import { formatInr } from '../../utils/content-format.util';

@Component({
  selector: 'app-package-card',
  standalone: true,
  imports: [HideOnErrorDirective, NgOptimizedImage, RouterLink],
  template: `
    @let item = pkg();
    <a class="card" [routerLink]="['/packages', item.slug]">
      <div class="media">
        @if (item.cover; as cover) {
          <img appHideOnError [ngSrc]="cover.url" [alt]="cover.altText" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw" [priority]="priority()" />
        }
        <span class="duration">{{ item.durationNights }}N / {{ item.durationDays }}D</span>
      </div>
      <div class="body">
        <h3>{{ item.title }}</h3>
        <p class="route">{{ route() }}</p>
        @if (item.highlights.length) {
          <ul class="highlights">
            @for (highlight of item.highlights.slice(0, 3); track highlight) {
              <li>{{ highlight }}</li>
            }
          </ul>
        }
        <div class="footer">
          @if (item.fromPrice) {
            <p class="price">
              <small>from</small>
              @if (item.compareAtPrice) {
                <s>{{ format(item.compareAtPrice) }}</s>
              }
              <strong>{{ format(item.fromPrice) }}</strong>
              <small>per person</small>
            </p>
          }
          @if (item.rating && item.reviewCount) {
            <span class="rating" [attr.aria-label]="item.rating + ' out of 5 from ' + item.reviewCount + ' reviews'">★ {{ item.rating }} ({{ item.reviewCount }})</span>
          }
        </div>
      </div>
    </a>
  `,
  styles: `
    .card { display: grid; grid-template-rows: auto 1fr; height: 100%; overflow: hidden; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); color: var(--text); text-decoration: none; }
    .card:hover, .card:focus-visible { border-color: var(--primary); box-shadow: 0 14px 32px var(--shadow); }
    .media { position: relative; aspect-ratio: 16 / 10; background: linear-gradient(135deg, #0b625d, #d9902f); }
    .media img { object-fit: cover; }
    .duration { position: absolute; left: 12px; bottom: 12px; padding: 3px 10px; border-radius: 999px; background: rgba(0,0,0,.7); color: #fff; font-size: .8rem; font-weight: 800; }
    .body { display: grid; align-content: start; gap: 6px; padding: 14px 16px 16px; }
    h3 { margin: 0; font-size: 1.08rem; }
    .route { margin: 0; color: var(--primary); font-size: .85rem; font-weight: 700; }
    .highlights { margin: 0; padding-left: 18px; color: var(--muted); font-size: .88rem; }
    .footer { display: flex; align-items: end; justify-content: space-between; gap: 8px; margin-top: 6px; }
    .price { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px; margin: 0; }
    .price strong { font-size: 1.2rem; }
    .price small { color: var(--muted); }
    .price s { color: var(--muted); font-size: .85rem; }
    .rating { font-size: .85rem; font-weight: 700; white-space: nowrap; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PackageCardComponent {
  readonly pkg = input.required<PackageCard>();
  readonly priority = input(false);

  protected readonly route = computed(() => this.pkg().route.map((stop) => `${stop.name} ${stop.nights}N`).join(' → '));
  protected readonly format = formatInr;
}
