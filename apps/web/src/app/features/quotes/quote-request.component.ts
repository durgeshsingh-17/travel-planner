import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, finalize, switchMap } from 'rxjs';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';

import { ContentApiService } from '../content/content-api.service';
import { DestinationCard, PackageDetail, TierLevel } from '../content/content.models';
import { INDIA_PHONE_PATTERN, PERSON_NAME_PATTERN } from '../../shared/utils/identity-validation.util';
import { Location } from '../locations/location.model';
import { LocationsApiService } from '../locations/locations-api.service';
import { MONTH_NAMES, formatInr } from '../../shared/utils/content-format.util';
import { MeApiService } from '../profile/me-api.service';
import { QuotesApiService } from './quotes-api.service';
import { SeoService } from '../../core/seo/seo.service';
import { SessionService } from '../../core/auth/session.service';
import { TIER_LABELS } from './quotes.models';
import { ToastService } from '../../shared/services/toast.service';

function localIsoDate(date = new Date()): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

@Component({
  selector: 'app-quote-request',
  standalone: true,
  imports: [
    MatAutocompleteModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './quote-request.component.html',
  styleUrl: './quote-request.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuoteRequestComponent {
  private readonly content = inject(ContentApiService);
  private readonly fb = inject(FormBuilder);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly meApi = inject(MeApiService);
  private readonly quotesApi = inject(QuotesApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);

  protected readonly months = MONTH_NAMES.map((label, index) => ({ label, value: index + 1 }));
  protected readonly tierLabels = TIER_LABELS;
  protected readonly format = formatInr;
  protected readonly today = localIsoDate();
  protected readonly steps = ['Your trip', 'Travellers & budget', 'Contact'];

  protected readonly step = signal(0);
  protected readonly pkg = signal<PackageDetail | null>(null);
  protected readonly destinations = signal<DestinationCard[]>([]);
  protected readonly cityOptions = signal<Location[]>([]);
  protected readonly verifiedPhone = signal<string | null>(null);
  protected readonly codeSentTo = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly duplicateId = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    trip: this.fb.nonNullable.group({
      destinationSlug: [''],
      packageTier: ['' as TierLevel | ''],
      dateMode: ['exact' as 'exact' | 'flexible'],
      startDate: [''],
      flexibleMonth: [0],
      nights: [3, [Validators.required, Validators.min(1), Validators.max(60)]],
      departureCity: [''],
      departureLocationSlug: ['']
    }),
    people: this.fb.nonNullable.group({
      adults: [2, [Validators.required, Validators.min(1), Validators.max(30)]],
      childAges: this.fb.array<number>([]),
      rooms: [1, [Validators.required, Validators.min(1), Validators.max(20)]],
      budgetPerPersonMin: this.fb.control<number | null>(null, Validators.min(0)),
      budgetPerPersonMax: this.fb.control<number | null>(null, Validators.min(0)),
      hotelCategory: [0],
      notes: ['', Validators.maxLength(1000)]
    }),
    contact: this.fb.nonNullable.group({
      contactName: ['', [Validators.required, Validators.pattern(PERSON_NAME_PATTERN)]],
      contactEmail: ['', Validators.email],
      phone: ['', Validators.pattern(INDIA_PHONE_PATTERN)],
      code: ['', Validators.pattern(/^\d{6}$/)],
      consent: [false, Validators.requiredTrue]
    })
  });

  protected readonly summary = computed(() => {
    const pkg = this.pkg();
    return pkg ? `${pkg.title} · ${pkg.durationNights}N/${pkg.durationDays}D` : null;
  });

  constructor() {
    inject(SeoService).setPage({ title: 'Request quotes', description: 'Get quotes from verified travel agencies.', path: '/quote', noindex: true });
    const params = this.route.snapshot.queryParamMap;
    const packageSlug = params.get('package');
    const user = this.session.session().user;
    this.form.controls.contact.patchValue({ contactName: user?.name ?? '', contactEmail: user?.email ?? '' });

    if (packageSlug) {
      this.content.package(packageSlug).subscribe({
        next: (pkg) => {
          this.pkg.set(pkg);
          const tier = params.get('tier') as TierLevel | null;
          this.form.controls.trip.patchValue({
            nights: pkg.durationNights || 1,
            packageTier: pkg.tiers.some((option) => option.level === tier) ? (tier as TierLevel) : (pkg.tiers[0]?.level ?? '')
          });
        },
        error: () => this.toast.error('That package is no longer available.')
      });
    } else {
      this.content.destinations({ pageSize: 48, sort: 'name' }).subscribe((page) => this.destinations.set(page.items));
      this.form.controls.trip.patchValue({ destinationSlug: params.get('destination') ?? '' });
    }

    this.meApi.get().subscribe({
      next: (me) => {
        if (me.phoneVerifiedAt && me.phone) {
          this.verifiedPhone.set(me.phone);
        } else if (me.phone) {
          this.form.controls.contact.patchValue({ phone: me.phone.replace(/^\+91/, '') });
        }
      }
    });

    this.form.controls.trip.controls.departureCity.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        filter((query) => query.trim().length >= 2),
        switchMap((query) => this.locationsApi.list({ q: query, limit: 8 })),
        takeUntilDestroyed()
      )
      .subscribe((cities) => this.cityOptions.set(cities));
  }

  protected get childAges(): FormArray {
    return this.form.controls.people.controls.childAges;
  }

  protected addChild(): void {
    this.childAges.push(this.fb.nonNullable.control(8, [Validators.required, Validators.min(0), Validators.max(17)]));
  }

  protected removeChild(index: number): void {
    this.childAges.removeAt(index);
  }

  protected selectCity(city: Location): void {
    this.form.controls.trip.patchValue({ departureCity: `${city.name}, ${city.state}`, departureLocationSlug: city.slug });
  }

  protected next(): void {
    const problem = this.stepProblem(this.step());

    if (problem) {
      this.toast.error(problem);
      return;
    }

    this.step.update((step) => Math.min(step + 1, this.steps.length - 1));
  }

  protected back(): void {
    this.step.update((step) => Math.max(step - 1, 0));
  }

  protected sendCode(): void {
    const phone = this.form.controls.contact.controls.phone;
    phone.markAsTouched();

    if (!phone.value || phone.invalid) {
      this.toast.error('Enter a valid Indian mobile number.');
      return;
    }

    this.busy.set(true);
    this.quotesApi
      .requestPhoneCode(phone.value)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.codeSentTo.set(phone.value);
          this.toast.success('Code sent. It expires in 5 minutes.');
        },
        error: (error: Error) => this.toast.error(error.message)
      });
  }

  protected confirmCode(): void {
    const { phone, code } = this.form.controls.contact.getRawValue();

    if (!/^\d{6}$/.test(code)) {
      this.toast.error('Enter the 6-digit code.');
      return;
    }

    this.busy.set(true);
    this.quotesApi
      .confirmPhoneCode(phone, code)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (result) => {
          this.verifiedPhone.set(result.phone);
          this.codeSentTo.set(null);
          this.toast.success('Number verified');
        },
        error: (error: Error) => this.toast.error(error.message)
      });
  }

  protected changePhone(): void {
    this.verifiedPhone.set(null);
    this.form.controls.contact.patchValue({ code: '' });
  }

  protected submit(): void {
    const problem = this.stepProblem(0) ?? this.stepProblem(1) ?? this.stepProblem(2);

    if (problem) {
      this.toast.error(problem);
      return;
    }

    const { trip, people, contact } = this.form.getRawValue();
    const pkg = this.pkg();
    this.busy.set(true);
    this.duplicateId.set(null);
    this.quotesApi
      .create({
        packageSlug: pkg?.slug,
        packageTier: pkg && trip.packageTier ? trip.packageTier : undefined,
        destinationSlug: pkg ? undefined : trip.destinationSlug,
        departureLocationSlug: trip.departureLocationSlug || undefined,
        startDate: trip.dateMode === 'exact' ? trip.startDate : undefined,
        flexibleMonth: trip.dateMode === 'flexible' ? trip.flexibleMonth : undefined,
        nights: Number(trip.nights),
        adults: Number(people.adults),
        childAges: people.childAges.map(Number),
        rooms: Number(people.rooms),
        budgetPerPersonMin: people.budgetPerPersonMin ?? undefined,
        budgetPerPersonMax: people.budgetPerPersonMax ?? undefined,
        hotelCategory: people.hotelCategory || undefined,
        notes: people.notes || undefined,
        contactName: contact.contactName,
        contactEmail: contact.contactEmail || undefined,
        consent: contact.consent,
        source: pkg ? 'PACKAGE' : 'DESTINATION'
      })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (request) => {
          this.toast.success('Request sent. Agencies usually reply within a day.');
          void this.router.navigate(['/quotes', request.id]);
        },
        error: (error: Error & { status?: number }) => {
          if (error.status === 409) {
            this.duplicateId.set('existing');
          }
          this.toast.error(error.message);
        }
      });
  }

  private stepProblem(step: number): string | null {
    const { trip, people, contact } = this.form.getRawValue();

    if (step === 0) {
      if (!this.pkg() && !trip.destinationSlug) return 'Choose where you want to go.';
      if (trip.dateMode === 'exact' && (!trip.startDate || trip.startDate < this.today)) return 'Choose a start date from today onwards.';
      if (trip.dateMode === 'flexible' && !trip.flexibleMonth) return 'Choose the month you want to travel.';
      if (this.form.controls.trip.controls.nights.invalid) return 'Nights must be between 1 and 60.';
      if (trip.departureCity && !trip.departureLocationSlug) return 'Pick your departure city from the suggestions, or leave it empty.';
    }

    if (step === 1) {
      if (this.form.controls.people.invalid) return 'Check the number of travellers, rooms and budget.';
      if (people.rooms > people.adults + people.childAges.length) return 'Rooms cannot exceed the number of travellers.';
      if (people.budgetPerPersonMin != null && people.budgetPerPersonMax != null && people.budgetPerPersonMin > people.budgetPerPersonMax) {
        return 'Minimum budget cannot be higher than the maximum.';
      }
    }

    if (step === 2) {
      if (this.form.controls.contact.controls.contactName.invalid) return 'Enter your name.';
      if (this.form.controls.contact.controls.contactEmail.invalid) return 'Enter a valid email or leave it empty.';
      if (!this.verifiedPhone()) return 'Verify your mobile number so agencies can reach you.';
      if (!contact.consent) return 'Please agree to share your request with up to three agencies.';
    }

    return null;
  }
}
