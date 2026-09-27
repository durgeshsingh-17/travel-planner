import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { AgentRequestDetail, QuotesApiService } from '../quotes/quotes-api.service';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { MONTH_NAMES, formatInr } from '../../shared/utils/content-format.util';
import { SubmitQuote, TIER_LABELS } from '../quotes/quotes.models';
import { TierLevel } from '../content/content.models';
import { ToastService } from '../../shared/services/toast.service';

function inDays(days: number): string {
  const date = new Date(Date.now() + days * 86_400_000);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** A request routed to the signed-in agency, and the form to answer it. Also used by admins entering a quote. */
@Component({
  selector: 'app-agent-request',
  standalone: true,
  imports: [LoadingStateComponent, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatInputModule, MatSelectModule, ReactiveFormsModule, RouterLink],
  templateUrl: './agent-request.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AgentRequestComponent {
  private readonly api = inject(QuotesApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';

  protected readonly request = signal<AgentRequestDetail | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly declining = signal(false);
  protected readonly tiers = (Object.keys(TIER_LABELS) as TierLevel[]).map((value) => ({ value, label: TIER_LABELS[value] }));
  protected readonly format = formatInr;
  protected readonly minDate = inDays(1);
  protected readonly maxDate = inDays(60);

  protected readonly travellers = computed(() => {
    const request = this.request();
    return request ? request.adults + request.childAges.length : 1;
  });
  protected readonly canQuote = computed(() => {
    const request = this.request();
    return Boolean(request && !request.myQuote && ['NEW', 'ROUTED', 'QUOTED'].includes(request.status) && request.routingStatus !== 'DECLINED');
  });

  protected readonly form = this.fb.nonNullable.group({
    tier: ['' as TierLevel | ''],
    totalPrice: this.fb.control<number | null>(null, [Validators.required, Validators.min(1)]),
    taxesIncluded: [true],
    hotels: this.fb.array<FormGroup>([]),
    inclusions: ['', Validators.required],
    exclusions: [''],
    message: ['', Validators.maxLength(2000)],
    validUntil: [inDays(7), Validators.required]
  });
  protected readonly declineReason = this.fb.nonNullable.control('', [Validators.required, Validators.minLength(3)]);

  constructor() {
    this.api.agentRequest(this.id).subscribe({
      next: (request) => {
        this.request.set(request);
        this.form.patchValue({ tier: (request.packageTier as TierLevel | null) ?? '' });
        this.addHotel();
      },
      error: (error: Error) => this.error.set(error.message)
    });
  }

  protected get hotels(): FormArray<FormGroup> {
    return this.form.controls.hotels;
  }

  protected addHotel(): void {
    this.hotels.push(
      this.fb.nonNullable.group({
        destinationName: [this.request()?.destination?.name ?? '', Validators.required],
        hotelName: ['', Validators.required],
        hotelCategory: this.fb.control<number | null>(null),
        mealPlan: [''],
        nights: [this.request()?.nights ?? 1, [Validators.required, Validators.min(1)]]
      })
    );
  }

  protected removeHotel(index: number): void {
    this.hotels.removeAt(index);
  }

  protected when(request: AgentRequestDetail): string {
    return request.startDate ?? (request.flexibleMonth ? `Flexible, ${MONTH_NAMES[request.flexibleMonth - 1]}` : '');
  }

  protected perPerson(): string {
    const total = Number(this.form.controls.totalPrice.value);
    return total > 0 ? formatInr(Math.ceil(total / this.travellers())) : '—';
  }

  protected submit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.toast.error('Add a total price, at least one inclusion and a validity date.');
      return;
    }

    const value = this.form.getRawValue();
    const lines = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean);
    const quote: SubmitQuote = {
      tier: value.tier || undefined,
      totalPrice: Number(value.totalPrice),
      taxesIncluded: value.taxesIncluded,
      hotels: value.hotels
        .filter((hotel) => hotel['hotelName'])
        .map((hotel) => ({
          destinationName: hotel['destinationName'],
          hotelName: hotel['hotelName'],
          hotelCategory: hotel['hotelCategory'] ? Number(hotel['hotelCategory']) : undefined,
          mealPlan: hotel['mealPlan'] || undefined,
          nights: Number(hotel['nights'])
        })),
      inclusions: lines(value.inclusions),
      exclusions: lines(value.exclusions),
      message: value.message || undefined,
      validUntil: new Date(`${value.validUntil}T23:59:59`).toISOString()
    };

    this.busy.set(true);
    this.api
      .agentSubmit(this.id, quote)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (request) => {
          this.request.set(request);
          this.toast.success('Quote sent to the traveller');
        },
        error: (error: Error) => this.toast.error(error.message)
      });
  }

  protected decline(): void {
    if (this.declineReason.invalid) {
      this.toast.error('Tell us briefly why you are declining.');
      return;
    }

    this.busy.set(true);
    this.api
      .agentDecline(this.id, this.declineReason.value)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.request.update((request) => (request ? { ...request, routingStatus: 'DECLINED' } : request));
          this.declining.set(false);
          this.toast.success('Request declined');
        },
        error: (error: Error) => this.toast.error(error.message)
      });
  }
}
