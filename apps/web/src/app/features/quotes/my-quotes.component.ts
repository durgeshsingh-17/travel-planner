import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { MONTH_NAMES } from '../../shared/utils/content-format.util';
import { QuoteRequestSummary, REQUEST_STATUS_LABELS } from './quotes.models';
import { QuotesApiService } from './quotes-api.service';
import { SeoService } from '../../core/seo/seo.service';

@Component({
  selector: 'app-my-quotes',
  standalone: true,
  imports: [LoadingStateComponent, MatButtonModule, RouterLink],
  template: `
    <main class="content-page narrow">
      <header class="head">
        <div>
          <p class="eyebrow">My quotes</p>
          <h1>Your quote requests</h1>
        </div>
        <a mat-stroked-button routerLink="/packages">Browse packages</a>
      </header>
      @if (requests(); as list) {
        @if (list.length) {
          <ul class="list">
            @for (request of list; track request.id) {
              <li>
                <a [routerLink]="['/quotes', request.id]">
                  <strong>{{ request.package?.title ?? request.destination?.name ?? 'Custom trip' }}</strong>
                  <span class="muted">{{ when(request) }} · {{ request.nights }} nights · {{ request.adults + request.children }} travellers</span>
                  <span class="status" [class]="'status ' + request.status.toLowerCase()">{{ statusLabels[request.status] }}</span>
                  <span class="muted small">{{ request.quotesReceived }} quote{{ request.quotesReceived === 1 ? '' : 's' }} · {{ request.agenciesContacted }} agencies contacted</span>
                </a>
              </li>
            }
          </ul>
        } @else {
          <div class="state-message">
            <p>You have not requested any quotes yet.</p>
            <a mat-flat-button color="primary" routerLink="/packages">Find a package</a>
          </div>
        }
      } @else {
        <app-loading-state label="Loading your requests" />
      }
    </main>
  `,
  styles: `
    .narrow { max-width: 860px; }
    .head { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: end; gap: 12px; }
    h1 { margin: 0; }
    .list { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
    .list a { display: grid; gap: 4px; padding: 16px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); color: var(--text); text-decoration: none; }
    .list a:hover { border-color: var(--primary); }
    .small { font-size: .85rem; }
    .status { justify-self: start; padding: 2px 10px; border-radius: 999px; background: var(--surface-soft); font-size: .8rem; font-weight: 800; }
    .status.quoted, .status.accepted { background: rgba(11, 98, 93, .16); color: var(--primary); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyQuotesComponent {
  protected readonly requests = signal<QuoteRequestSummary[] | null>(null);
  protected readonly statusLabels = REQUEST_STATUS_LABELS;

  constructor() {
    inject(SeoService).setPage({ title: 'My quotes', description: 'Your quote requests', path: '/quotes', noindex: true });
    inject(QuotesApiService)
      .mine()
      .pipe(takeUntilDestroyed())
      .subscribe({ next: (list) => this.requests.set(list), error: () => this.requests.set([]) });
  }

  protected when(request: QuoteRequestSummary): string {
    return request.startDate ?? (request.flexibleMonth ? `Flexible, ${MONTH_NAMES[request.flexibleMonth - 1]}` : '');
  }
}
