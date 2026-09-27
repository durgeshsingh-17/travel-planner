import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { AgentInboxItem, QuotesApiService } from '../quotes/quotes-api.service';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { MONTH_NAMES, formatInr } from '../../shared/utils/content-format.util';
import { SeoService } from '../../core/seo/seo.service';

const ROUTING_LABELS: Record<AgentInboxItem['routingStatus'], string> = {
  NOTIFIED: 'New',
  VIEWED: 'Opened',
  QUOTED: 'Quote sent',
  DECLINED: 'Declined'
};

@Component({
  selector: 'app-agent-inbox',
  standalone: true,
  imports: [LoadingStateComponent, RouterLink],
  template: `
    <main class="admin-page agent">
      @if (data(); as inbox) {
        <p class="eyebrow">{{ inbox.agent.displayName }}</p>
        <h1>Quote requests</h1>
        <table class="admin-table">
          <tr><th>Trip</th><th>When</th><th>Travellers</th><th>Status</th><th>Your quote</th></tr>
          @for (item of inbox.requests; track item.requestId) {
            <tr [class.new]="item.routingStatus === 'NOTIFIED'">
              <td><a [routerLink]="['/agent/requests', item.requestId]">{{ item.package?.title ?? item.destination?.name ?? 'Custom trip' }}</a></td>
              <td>{{ when(item) }} · {{ item.nights }}N</td>
              <td>{{ item.travellers }}</td>
              <td>{{ labels[item.routingStatus] }}@if (!['NEW', 'ROUTED', 'QUOTED'].includes(item.requestStatus)) { · {{ item.requestStatus.toLowerCase() }} }</td>
              <td>{{ item.myQuote ? format(item.myQuote.totalPrice) + ' (' + item.myQuote.status.toLowerCase() + ')' : '—' }}</td>
            </tr>
          } @empty {
            <tr><td colspan="5" class="muted">No requests yet. New ones appear here as soon as travellers send them.</td></tr>
          }
        </table>
      } @else if (error()) {
        <p>{{ error() }}</p>
      } @else {
        <app-loading-state label="Loading requests" />
      }
    </main>
  `,
  styles: `
    .agent { max-width: 1100px; margin: 0 auto; padding: 24px 20px 64px; }
    tr.new td:first-child a::after { content: ' • new'; color: var(--accent); font-weight: 800; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AgentInboxComponent {
  protected readonly data = signal<{ agent: { displayName: string }; requests: AgentInboxItem[] } | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly labels = ROUTING_LABELS;
  protected readonly format = formatInr;

  constructor() {
    inject(SeoService).setPage({ title: 'Agency inbox', description: 'Quote requests', path: '/agent', noindex: true });
    inject(QuotesApiService)
      .agentInbox()
      .pipe(takeUntilDestroyed())
      .subscribe({ next: (data) => this.data.set(data), error: (error: Error) => this.error.set(error.message) });
  }

  protected when(item: AgentInboxItem): string {
    return item.startDate ?? (item.flexibleMonth ? MONTH_NAMES[item.flexibleMonth - 1] : '');
  }
}
