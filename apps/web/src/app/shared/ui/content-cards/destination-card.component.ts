import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';

import { HideOnErrorDirective } from '../../directives/hide-on-error.directive';

import { DestinationCard } from '../../../features/content/content.models';
import { dayRange, inrRange, monthRanges } from '../../utils/content-format.util';

@Component({
  selector: 'app-destination-card',
  standalone: true,
  imports: [HideOnErrorDirective, NgOptimizedImage, RouterLink],
  template: `
    @let item = destination();
    <a class="card" [routerLink]="['/destinations', item.slug]">
      <div class="media">
        @if (item.cover; as cover) {
          <img
            appHideOnError
            [ngSrc]="cover.url"
            [alt]="cover.altText"
            fill
            sizes="(max-width: 640px) 100vw, 300px"
            [priority]="priority()"
          />
        } @else {
          <span class="placeholder" aria-hidden="true">{{ item.name.charAt(0) }}</span>
        }
      </div>
      <div class="body">
        <p class="state">{{ item.state }}</p>
        <h3>{{ item.name }}</h3>
        <p class="summary">{{ item.tagline || item.shortDescription }}</p>
        @if (facts().length) {
          <ul class="facts">
            @for (fact of facts(); track fact) {
              <li>{{ fact }}</li>
            }
          </ul>
        }
      </div>
    </a>
  `,
  styles: `
    .card {
      display: grid;
      height: 100%;
      overflow: hidden;
      border: 1px solid var(--border);
      border-radius: 16px;
      background: var(--surface);
      color: var(--text);
      text-decoration: none;
      transition: transform 160ms ease, box-shadow 160ms ease;
    }
    .card:hover, .card:focus-visible { transform: translateY(-2px); box-shadow: 0 16px 36px var(--shadow); }
    .media { position: relative; aspect-ratio: 4 / 3; background: linear-gradient(135deg, #0b625d, #3a8f86); }
    .media img { object-fit: cover; }
    .placeholder { display: grid; place-items: center; height: 100%; color: rgba(255,255,255,.85); font-size: 3rem; font-weight: 800; }
    .body { display: grid; align-content: start; gap: 6px; padding: 14px 16px 16px; }
    .state { margin: 0; color: var(--primary); font-size: .78rem; font-weight: 800; text-transform: uppercase; letter-spacing: .05em; }
    h3 { margin: 0; font-size: 1.15rem; }
    .summary { margin: 0; color: var(--muted); font-size: .92rem; line-height: 1.45; }
    .facts { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 0; padding: 0; list-style: none; }
    .facts li { padding: 2px 8px; border-radius: 999px; background: var(--surface-soft); color: var(--text); font-size: .78rem; }
    @media (prefers-reduced-motion: reduce) { .card { transition: none; } .card:hover { transform: none; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DestinationCardComponent {
  readonly destination = input.required<DestinationCard>();
  /** Set for the first cards above the fold so the browser fetches their image early. */
  readonly priority = input(false);

  protected readonly facts = computed(() => {
    const item = this.destination();
    return [
      monthRanges(item.bestMonths) ?? item.bestTimeToVisit,
      dayRange(item.idealDaysMin, item.idealDaysMax),
      inrRange(item.budgetPerDayMin, item.budgetPerDayMax)?.concat('/day')
    ].filter((fact): fact is string => Boolean(fact));
  });
}
