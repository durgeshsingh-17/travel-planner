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

import { Destination } from '../destinations/destination.model';
import { DestinationsApiService } from '../destinations/destinations-api.service';
import { SectionCarouselComponent } from '../../shared/ui/section-carousel/section-carousel.component';
import { TravelCard } from './models/travel-card.model';

const fallbackImageUrl =
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80';

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
    ReactiveFormsModule,
    RouterLink,
    SectionCarouselComponent
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeComponent {
  private readonly destinationsApi = inject(DestinationsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);

  protected readonly destinations = signal<Destination[]>([]);
  protected readonly sourceOptions = signal<Destination[]>([]);
  protected readonly destinationOptions = signal<Destination[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly submitted = signal(false);
  protected readonly today = new Date().toISOString().slice(0, 10);
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

  protected readonly trendingRoadTrips = computed(() => this.toCards(this.destinations()));
  protected readonly popularDestinations = computed(() => this.toCards(this.destinations()));
  protected readonly budgetTrips = computed(() =>
    this.toCards(
      this.destinations().filter((destination) =>
        /uttarakhand|himachal|rajasthan|kerala|goa/i.test(
          `${destination.state} ${destination.name}`
        )
      )
    )
  );
  protected readonly moodCards = computed(() =>
    this.destinations()
      .slice(0, 8)
      .map((destination) => ({
        label: destination.state,
        description: destination.shortDescription,
        link: ['/destinations', destination.slug]
      }))
  );

  constructor() {
    this.destinationsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (destinations) => {
          this.destinations.set(destinations);
          this.sourceOptions.set(destinations);
          this.destinationOptions.set(destinations);
          this.isLoading.set(false);

          if (destinations[0]) {
            this.quickForm.controls.source.setValue(destinations[0].name, {
              emitEvent: false
            });
          }

          if (destinations[1]) {
            this.quickForm.controls.destination.setValue(destinations[1].name, {
              emitEvent: false
            });
          }
        },
        error: (error: Error) => {
          this.errorMessage.set(error.message);
          this.isLoading.set(false);
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

  private filterDestinations(query: string): Destination[] {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return this.destinations();
    }

    return this.destinations().filter((destination) =>
      `${destination.name} ${destination.state} ${destination.country}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }

  private toCards(destinations: Destination[]): TravelCard[] {
    return destinations.map((destination) => ({
      title: destination.name,
      subtitle: destination.shortDescription,
      imageUrl: destination.heroImageUrl ?? fallbackImageUrl,
      meta: `${destination.state} • ${destination.bestTimeToVisit ?? destination.country}`,
      tag: destination.country,
      link: ['/destinations', destination.slug]
    }));
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
