import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, finalize, map, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';

import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { MONTH_NAMES, formatInr } from '../../shared/utils/content-format.util';
import { Quote, QuoteRequestDetail, REQUEST_STATUS_LABELS, TIER_LABELS } from './quotes.models';
import { QuotesApiService } from './quotes-api.service';
import { SeoService } from '../../core/seo/seo.service';
import { ToastService } from '../../shared/services/toast.service';

const OPEN = ['NEW', 'ROUTED', 'QUOTED'];
const MEAL_PLANS: Record<string, string> = { EP: 'Room only', CP: 'Breakfast', MAP: 'Breakfast + dinner', AP: 'All meals' };

@Component({
  selector: 'app-quote-request-detail',
  standalone: true,
  imports: [LoadingStateComponent, MatButtonModule, RouterLink],
  templateUrl: './quote-request-detail.component.html',
  styleUrl: './quote-request-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuoteRequestDetailComponent {
  private readonly api = inject(QuotesApiService);
  private readonly toast = inject(ToastService);

  protected readonly request = signal<QuoteRequestDetail | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly statusLabels = REQUEST_STATUS_LABELS;
  protected readonly tierLabels = TIER_LABELS;
  protected readonly mealPlans = MEAL_PLANS;
  protected readonly format = formatInr;

  protected readonly isOpen = computed(() => OPEN.includes(this.request()?.status ?? ''));
  /** Live offers first, cheapest first; declined and expired ones after. */
  protected readonly quotes = computed(() => {
    const rank = (quote: Quote) => (quote.status === 'ACCEPTED' ? 0 : quote.status === 'SENT' ? 1 : 2);
    return [...(this.request()?.quotes ?? [])].sort((a, b) => rank(a) - rank(b) || a.pricePerPerson - b.pricePerPerson);
  });
  protected readonly accepted = computed(() => this.quotes().find((quote) => quote.status === 'ACCEPTED') ?? null);

  constructor() {
    inject(SeoService).setPage({ title: 'Quote request', description: 'Compare your quotes', path: '/quotes', noindex: true });
    inject(ActivatedRoute)
      .paramMap.pipe(
        map((params) => params.get('id') ?? ''),
        switchMap((id) => this.api.get(id)),
        takeUntilDestroyed()
      )
      .subscribe({ next: (request) => this.request.set(request), error: (error: Error) => this.error.set(error.message) });
  }

  protected when(request: QuoteRequestDetail): string {
    return request.startDate ?? (request.flexibleMonth ? `Flexible, ${MONTH_NAMES[request.flexibleMonth - 1]}` : '');
  }

  protected covers(quote: Quote, coveredBy: string[]): boolean {
    return coveredBy.includes(quote.id);
  }

  protected daysLeft(quote: Quote): string {
    const days = Math.ceil((new Date(quote.validUntil).getTime() - Date.now()) / 86_400_000);
    return days <= 0 ? 'Expires today' : `Valid for ${days} more day${days === 1 ? '' : 's'}`;
  }

  protected accept(quote: Quote): void {
    if (!confirm(`Accept ${quote.agent.displayName}'s quote of ${formatInr(quote.totalPrice)}? Other quotes will be declined.`)) return;
    this.run(this.api.accept(quote.id), 'Quote accepted. The agency will contact you to confirm and take payment.');
  }

  protected decline(quote: Quote): void {
    this.run(this.api.decline(quote.id), 'Quote declined');
  }

  protected cancel(): void {
    const request = this.request();
    if (!request || !confirm('Cancel this request? Agencies will stop sending quotes.')) return;
    this.run(this.api.cancel(request.id), 'Request cancelled');
  }

  private run(call: Observable<QuoteRequestDetail>, message: string): void {
    this.busy.set(true);
    call.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (request) => {
        this.request.set(request);
        this.toast.success(message);
      },
      error: (error: Error) => this.toast.error(error.message)
    });
  }
}
