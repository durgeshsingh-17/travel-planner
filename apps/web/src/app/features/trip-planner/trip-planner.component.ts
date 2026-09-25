import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { debounceTime, distinctUntilChanged, finalize, switchMap } from 'rxjs';

import {
  interestOptions,
  preferenceOptions,
  travelModes
} from './models/trip-planner-options.model';
import { CreateTripRequest } from '../trip-result/models/trip.model';
import { Destination } from '../destinations/destination.model';
import { DestinationsApiService } from '../destinations/destinations-api.service';
import { TripsApiService } from '../trip-result/services/trips-api.service';
import { TripPlannerFormService } from './services/trip-planner-form.service';

@Component({
  selector: 'app-trip-planner',
  standalone: true,
  imports: [
    MatAutocompleteModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    ReactiveFormsModule
  ],
  providers: [TripPlannerFormService],
  templateUrl: './trip-planner.component.html',
  styleUrl: './trip-planner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripPlannerComponent {
  private readonly destinationsApi = inject(DestinationsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formService = inject(TripPlannerFormService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly tripsApi = inject(TripsApiService);

  protected readonly travelModes = travelModes;
  protected readonly interestOptions = interestOptions;
  protected readonly preferenceOptions = preferenceOptions;
  protected readonly submitted = signal(false);
  protected readonly isGenerating = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly sourceOptions = signal<Destination[]>([]);
  protected readonly destinationOptions = signal<Destination[]>([]);
  protected readonly knownDestinations = signal<Destination[]>([]);
  protected readonly form = this.formService.createForm();
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected readonly selectedTravelMode = computed(
    () => this.form.controls.travelMode.value
  );

  constructor() {
    this.destinationsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((destinations) => {
        this.knownDestinations.update((current) =>
          this.mergeDestinations(current, destinations)
        );
        this.sourceOptions.set(destinations);
        this.destinationOptions.set(destinations);

        if (!this.form.controls.source.value && destinations[0]) {
          this.form.controls.source.setValue(destinations[0].name, {
            emitEvent: false
          });
        }

        if (!this.form.controls.destination.value && destinations[1]) {
          this.form.controls.destination.setValue(destinations[1].name, {
            emitEvent: false
          });
        }
      });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const interests = params.get('interests');
      const patch: Partial<ReturnType<typeof this.form.getRawValue>> = {};

      if (params.has('source')) {
        patch.source = params.get('source') ?? '';
      }

      if (params.has('destination')) {
        patch.destination = params.get('destination') ?? '';
      }

      if (params.has('startDate')) {
        patch.startDate = params.get('startDate') ?? '';
      }

      if (params.has('endDate')) {
        patch.endDate = params.get('endDate') ?? '';
      }

      if (params.has('travellers')) {
        patch.travellers = this.toNullableNumber(params.get('travellers'));
      }

      if (params.has('travelMode')) {
        patch.travelMode = params.get('travelMode') ?? '';
      }

      if (params.has('budget')) {
        patch.budget = this.toNullableNumber(params.get('budget'));
      }

      if (params.has('interests')) {
        patch.interests = interests
          ? interests
              .split(',')
              .map((interest) => interest.trim())
              .filter(Boolean)
          : [];
      }

      this.form.patchValue(patch);
    });

    this.bindDestinationSearch('source', this.sourceOptions);
    this.bindDestinationSearch('destination', this.destinationOptions);
  }

  protected toggleMultiValue(controlName: 'interests' | 'preferences', value: string): void {
    const control = this.form.controls[controlName];
    const current = control.value;
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];

    control.setValue(next);
    control.markAsDirty();
  }

  protected hasValue(controlName: 'interests' | 'preferences', value: string): boolean {
    return this.form.controls[controlName].value.includes(value);
  }

  protected swapLocations(): void {
    const source = this.form.controls.source.value;
    const destination = this.form.controls.destination.value;
    const sourceOptions = this.sourceOptions();
    const destinationOptions = this.destinationOptions();

    this.form.patchValue({
      source: destination,
      destination: source
    });
    this.form.controls.source.setErrors(null);
    this.form.controls.destination.setErrors(null);
    this.form.controls.source.markAsDirty();
    this.form.controls.destination.markAsDirty();
    this.sourceOptions.set(destinationOptions);
    this.destinationOptions.set(sourceOptions);
    this.errorMessage.set(null);
  }

  protected dateError(controlName: 'startDate' | 'endDate'): string {
    const control = this.form.controls[controlName];

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

  protected isInvalid(
    controlName:
      | 'source'
      | 'destination'
      | 'startDate'
      | 'endDate'
      | 'travellers'
      | 'travelMode'
      | 'mileage'
      | 'budget'
  ): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.submitted());
  }

  protected generateTrip(): void {
    this.submitted.set(true);
    this.errorMessage.set(null);
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.errorMessage.set('Please fix the highlighted fields before generating.');
      return;
    }

    if (!this.findDestination(this.form.controls.source.value)) {
      this.errorMessage.set('Select a valid starting point from suggestions.');
      this.form.controls.source.setErrors({ unknownLocation: true });
      return;
    }

    if (!this.findDestination(this.form.controls.destination.value)) {
      this.errorMessage.set('Select a valid destination from suggestions.');
      this.form.controls.destination.setErrors({ unknownLocation: true });
      return;
    }

    this.isGenerating.set(true);
    this.tripsApi
      .createTrip(this.buildPayload())
      .pipe(
        switchMap((trip) => this.tripsApi.generateItinerary(trip.id)),
        finalize(() => this.isGenerating.set(false))
      )
      .subscribe({
        next: (trip) => {
          void this.router.navigate(['/trip', trip.id]);
        },
        error: (error: Error) => {
          this.errorMessage.set(error.message);
        }
      });
  }

  private buildPayload(): CreateTripRequest {
    const value = this.form.getRawValue();
    const source = this.findDestination(value.source);
    const destination = this.findDestination(value.destination);

    if (!source || !destination) {
      throw new Error('Selected locations were not found in destination data.');
    }

    return {
      source: {
        name: source.name,
        latitude: source.latitude,
        longitude: source.longitude
      },
      destination: {
        name: destination.name,
        latitude: destination.latitude,
        longitude: destination.longitude
      },
      startDate: value.startDate,
      endDate: value.endDate,
      travellerCount: Number(value.travellers),
      budget: value.budget === null ? undefined : Number(value.budget),
      travelMode: value.travelMode,
      vehicle:
        value.vehicleBrand || value.vehicleModel || value.mileage
          ? {
              brand: value.vehicleBrand || undefined,
              model: value.vehicleModel || undefined,
              mileage: value.mileage === null ? undefined : Number(value.mileage)
            }
          : undefined,
      interests: value.interests,
      preferences: value.preferences,
      notes: value.notes || undefined
    };
  }

  private bindDestinationSearch(
    controlName: 'source' | 'destination',
    target: typeof this.sourceOptions
  ): void {
    this.form.controls[controlName].valueChanges
      .pipe(
        debounceTime(180),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((query) => target.set(this.filterDestinations(query)));
  }

  private filterDestinations(query: string): Destination[] {
    const normalizedQuery = query.trim().toLowerCase();
    const destinations = this.knownDestinations();

    if (!normalizedQuery) {
      return destinations;
    }

    return destinations.filter((destination) =>
      `${destination.name} ${destination.state} ${destination.country}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }

  private findDestination(name: string): Destination | undefined {
    const normalizedName = name.trim().toLowerCase();
    return this.knownDestinations().find(
      (destination) => destination.name.trim().toLowerCase() === normalizedName
    );
  }

  private mergeDestinations(
    current: Destination[],
    incoming: Destination[]
  ): Destination[] {
    const destinations = new Map(current.map((destination) => [destination.id, destination]));
    incoming.forEach((destination) => destinations.set(destination.id, destination));
    return [...destinations.values()];
  }

  private toNullableNumber(value: string | null): number | null {
    if (value === null || value.trim() === '') {
      return null;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }
}
