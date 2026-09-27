import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';

import { ContentApiService } from '../content/content-api.service';
import { DestinationCardComponent } from '../../shared/ui/content-cards/destination-card.component';
import { PackageCardComponent } from '../../shared/ui/content-cards/package-card.component';
import { HomeContent } from '../content/content.models';
import { MONTH_NAMES } from '../../shared/utils/content-format.util';
import { SearchBoxComponent } from '../../shared/ui/search-box/search-box.component';
import { SeoService } from '../../core/seo/seo.service';
import { Location } from '../locations/location.model';
import { LocationsApiService } from '../locations/locations-api.service';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';

/** Local calendar date (not UTC), so "today" is right in India before 05:30. */
function localIsoDate(date = new Date()): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    MatAutocompleteModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    LoadingStateComponent,
    ReactiveFormsModule,
    RouterLink,
    DestinationCardComponent,
    PackageCardComponent,
    SearchBoxComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent {
  private readonly content = inject(ContentApiService);
  private readonly seo = inject(SeoService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly router = inject(Router);

  protected readonly home = signal<HomeContent | null>(null);
  protected readonly locations = signal<Location[]>([]);
  protected readonly sourceOptions = signal<Location[]>([]);
  protected readonly destinationOptions = signal<Location[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly submitted = signal(false);
  protected readonly today = localIsoDate();
  protected readonly quickForm = this.fb.nonNullable.group(
    {
      source: this.fb.nonNullable.control('', [Validators.required]),
      destination: this.fb.nonNullable.control('', [Validators.required]),
      startDate: this.fb.nonNullable.control('', [
        Validators.required,
        this.notPastDate
      ]),
      endDate: this.fb.nonNullable.control('', [Validators.required]),
      travellers: this.fb.control<number | null>(null, [
        Validators.required,
        Validators.min(1)
      ]),
      travelMode: this.fb.nonNullable.control('', [Validators.required]),
      budget: this.fb.control<number | null>(null, [
        Validators.required,
        Validators.min(0)
      ]),
      interests: this.fb.nonNullable.control('')
    },
    {
      validators: [this.dateRangeValidator]
    }
  );

  protected readonly monthName = computed(() => MONTH_NAMES[(this.home()?.month ?? 1) - 1]);
  protected readonly bestNow = computed(() => {
    const home = this.home();
    return home?.trending.length ? home.trending : (home?.featured ?? []);
  });
  protected readonly stats = computed(() => {
    const stats = this.home()?.stats;

    if (!stats) {
      return [];
    }

    // Real counts only, and only once they are worth showing.
    return [
      { label: 'destination guides', value: stats.destinations },
      { label: 'places to visit', value: stats.places },
      { label: 'trips planned', value: stats.tripsPlanned }
    ].filter((stat) => stat.value >= 5);
  });

  constructor() {
    this.seo.setPage({
      title: 'Travel Platform: plan India road trips and explore destinations',
      description:
        'Destination guides, places to visit and day-wise road-trip plans with vehicle-aware costs for travel across India.',
      path: '/',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Travel Platform',
          url: this.seo.absolute('/'),
          potentialAction: {
            '@type': 'SearchAction',
            target: `${this.seo.absolute('/destinations')}?q={search_term_string}`,
            'query-input': 'required name=search_term_string'
          }
        }
      ]
    });

    this.content
      .home()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (home) => {
          this.home.set(home);
          this.isLoading.set(false);
        },
        error: (error: Error) => {
          this.errorMessage.set(error.message);
          this.isLoading.set(false);
        }
      });

    this.locationsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((locations) => {
        this.locations.set(locations);
        this.sourceOptions.set(locations);
        this.destinationOptions.set(locations);

        if (locations[0]) {
          this.quickForm.controls.source.setValue(locations[0].name, {
            emitEvent: false
          });
        }

        if (locations[1]) {
          this.quickForm.controls.destination.setValue(locations[1].name, {
            emitEvent: false
          });
        }
      });

    this.bindDestinationSearch('source', this.sourceOptions);
    this.bindDestinationSearch('destination', this.destinationOptions);
  }

  protected openFullPlanner(): void {
    this.submitted.set(true);
    this.quickForm.markAllAsTouched();

    if (this.quickForm.invalid) {
      return;
    }

    const source = this.findLocation(this.quickForm.controls.source.value);
    const destination = this.findLocation(this.quickForm.controls.destination.value);

    if (!source) {
      this.quickForm.controls.source.setErrors({ unknownLocation: true });
      return;
    }

    if (!destination) {
      this.quickForm.controls.destination.setErrors({ unknownLocation: true });
      return;
    }

    if (source.id === destination.id) {
      this.quickForm.controls.destination.setErrors({ sameLocation: true });
      return;
    }

    const value = this.quickForm.getRawValue();
    void this.router.navigate(['/plan'], {
      queryParams: {
        source: value.source,
        destination: value.destination,
        startDate: value.startDate,
        endDate: value.endDate,
        travellers: value.travellers,
        travelMode: value.travelMode,
        budget: value.budget,
        interests: value.interests
      }
    });
  }

  protected isInvalid(controlName: keyof typeof this.quickForm.controls): boolean {
    const control = this.quickForm.controls[controlName];
    return control.invalid && (control.touched || this.submitted());
  }

  protected dateError(controlName: 'startDate' | 'endDate'): string {
    const control = this.quickForm.controls[controlName];

    if (control.hasError('required')) {
      return controlName === 'startDate'
        ? 'Start date is required.'
        : 'End date is required.';
    }

    if (control.hasError('pastDate')) {
      return 'Start date cannot be in the past.';
    }

    return 'Enter a valid date.';
  }

  protected switchLocations(): void {
    const source = this.quickForm.controls.source.value;
    const destination = this.quickForm.controls.destination.value;
    const sourceOptions = this.sourceOptions();
    const destinationOptions = this.destinationOptions();

    this.quickForm.patchValue({
      source: destination,
      destination: source
    });
    this.quickForm.controls.source.setErrors(null);
    this.quickForm.controls.destination.setErrors(null);
    this.quickForm.controls.source.markAsDirty();
    this.quickForm.controls.destination.markAsDirty();
    this.sourceOptions.set(destinationOptions);
    this.destinationOptions.set(sourceOptions);
    this.errorMessage.set(null);
  }

  private bindDestinationSearch(
    controlName: 'source' | 'destination',
    target: typeof this.sourceOptions
  ): void {
    this.quickForm.controls[controlName].valueChanges
      .pipe(
        debounceTime(180),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((query) => target.set(this.filterDestinations(query)));
  }

  private filterDestinations(query: string): Location[] {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return this.locations();
    }

    return this.locations().filter((location) =>
      `${location.name} ${location.state} ${location.country}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }

  private findLocation(name: string): Location | undefined {
    const normalizedName = name.trim().toLowerCase();
    return this.locations().find(
      (location) => location.name.trim().toLowerCase() === normalizedName
    );
  }

  private dateRangeValidator(control: AbstractControl) {
    const startDate = control.get('startDate')?.value;
    const endDate = control.get('endDate')?.value;

    if (!startDate || !endDate) {
      return null;
    }

    return new Date(endDate) >= new Date(startDate)
      ? null
      : { invalidDateRange: true };
  }

  private notPastDate(control: AbstractControl) {
    if (!control.value) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(control.value);
    selectedDate.setHours(0, 0, 0, 0);

    return selectedDate >= today ? null : { pastDate: true };
  }
}
