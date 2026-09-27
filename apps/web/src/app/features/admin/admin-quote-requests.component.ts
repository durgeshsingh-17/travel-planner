import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { AdminApiService } from './admin-api.service';
import { AdminQuoteRequestDetail, AdminQuoteRequestRow, AgentRow } from './admin.models';
import { MONTH_NAMES, formatInr } from '../../shared/utils/content-format.util';
import { REQUEST_STATUS_LABELS, QuoteRequestStatus } from '../quotes/quotes.models';
import { ToastService } from '../../shared/services/toast.service';

/** List of every request, or one request with routing and on-behalf quoting (when the route has an id). */
@Component({
  selector: 'app-admin-quote-requests',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, ReactiveFormsModule, RouterLink],
  templateUrl: './admin-quote-requests.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminQuoteRequestsComponent {
  private readonly admin = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  protected readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');

  protected readonly statusLabels = REQUEST_STATUS_LABELS;
  protected readonly statuses = Object.keys(REQUEST_STATUS_LABELS) as QuoteRequestStatus[];
  protected readonly format = formatInr;
  protected readonly rows = signal<AdminQuoteRequestRow[]>([]);
  protected readonly detail = signal<AdminQuoteRequestDetail | null>(null);
  protected readonly agents = signal<AgentRow[]>([]);
  protected readonly status = signal<string>('');

  protected readonly assignable = computed(() => {
    const routed = new Set(this.detail()?.routings.map((routing) => routing.agent.id) ?? []);
    return this.agents().filter((agent) => agent.isActive && !routed.has(agent.id));
  });
  /** Routed agencies that have not quoted or declined yet. */
  protected readonly awaiting = computed(() => {
    const detail = this.detail();
    const quoted = new Set(detail?.quotes.map((quote) => quote.agent.id) ?? []);
    return (detail?.routings ?? []).filter((routing) => routing.status !== 'DECLINED' && !quoted.has(routing.agent.id));
  });

  protected readonly assignForm = this.fb.nonNullable.group({ agentIds: this.fb.nonNullable.control<string[]>([]) });
  protected readonly quoteForm = this.fb.nonNullable.group({
    agentId: ['', Validators.required],
    totalPrice: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    validUntil: ['', Validators.required],
    inclusions: ['', Validators.required],
    exclusions: [''],
    message: ['']
  });

  constructor() {
    if (this.id) {
      this.loadDetail();
      this.admin.agents().subscribe((agents) => this.agents.set(agents));
    } else {
      this.loadList();
    }
  }

  protected statusLabel(status: string): string {
    return REQUEST_STATUS_LABELS[status as QuoteRequestStatus] ?? status;
  }

  protected when(row: { startDate: string | null; flexibleMonth: number | null }): string {
    return row.startDate ?? (row.flexibleMonth ? `Flexible, ${MONTH_NAMES[row.flexibleMonth - 1]}` : '');
  }

  protected filter(status: string): void {
    this.status.set(status);
    this.loadList();
  }

  protected route(auto: boolean): void {
    const ids = auto ? [] : this.assignForm.getRawValue().agentIds;

    if (!auto && !ids.length) {
      this.toast.error('Choose at least one agency.');
      return;
    }

    this.admin.routeQuoteRequest(this.id!, ids).subscribe({
      next: (detail) => {
        this.detail.set(detail);
        this.assignForm.reset({ agentIds: [] });
        this.toast.success('Routing updated');
      },
      error: (error: Error) => this.toast.error(error.message)
    });
  }

  protected submitQuote(): void {
    this.quoteForm.markAllAsTouched();

    if (this.quoteForm.invalid) {
      this.toast.error('Choose the agency and add a price, validity and inclusions.');
      return;
    }

    const value = this.quoteForm.getRawValue();
    const lines = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean);
    this.admin
      .submitQuoteForAgent(this.id!, value.agentId, {
        totalPrice: Number(value.totalPrice),
        validUntil: new Date(`${value.validUntil}T23:59:59`).toISOString(),
        hotels: [],
        inclusions: lines(value.inclusions),
        exclusions: lines(value.exclusions),
        message: value.message || undefined
      })
      .subscribe({
        next: (detail) => {
          this.detail.set(detail);
          this.quoteForm.reset();
          this.toast.success('Quote added for the traveller');
        },
        error: (error: Error) => this.toast.error(error.message)
      });
  }

  private loadList(): void {
    this.admin.quoteRequests(this.status() || undefined).subscribe((rows) => this.rows.set(rows));
  }

  private loadDetail(): void {
    this.admin.quoteRequest(this.id!).subscribe({
      next: (detail) => this.detail.set(detail),
      error: (error: Error) => this.toast.error(error.message)
    });
  }
}
