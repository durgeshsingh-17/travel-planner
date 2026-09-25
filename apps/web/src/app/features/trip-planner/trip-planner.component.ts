import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  finalize,
  of,
  switchMap,
  tap
} from 'rxjs';

import {
  interestOptions,
  preferenceOptions,
  travelModes
} from './models/trip-planner-options.model';
import { CreateTripRequest } from '../trip-result/models/trip.model';
import { Location } from '../locations/location.model';
import { LocationsApiService } from '../locations/locations-api.service';
import { TripsApiService } from '../trip-result/services/trips-api.service';
import { TripPlannerFormService } from './services/trip-planner-form.service';
import { SessionService } from '../../core/auth/session.service';
import { ApiService } from '../../core/services/api.service';

const PENDING_TRIP_DRAFT_KEY = 'travel-platform.pending-trip-draft';

interface UserVehicleOption {
  id: string;
  nickname?: string | null;
  customMileage?: number | null;
  registrationNumber?: string | null;
  vehicle: {
    id: string;
    brand: string;
    model: string;
    averageMileage?: number | null;
  };
}

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
    MatSelectModule,
    MatTooltipModule,
    ReactiveFormsModule
  ],
  providers: [TripPlannerFormService],
  templateUrl: './trip-planner.component.html',
  styleUrl: './trip-planner.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripPlannerComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly api = inject(ApiService);
  private readonly formService = inject(TripPlannerFormService);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly sessionService = inject(SessionService);
  private readonly tripsApi = inject(TripsApiService);

  protected readonly travelModes = travelModes;
  protected readonly interestOptions = interestOptions;
  protected readonly preferenceOptions = preferenceOptions;
  protected readonly genderOptions = [
    { label: 'Female', value: 'FEMALE' },
    { label: 'Male', value: 'MALE' },
    { label: 'Other', value: 'OTHER' },
    { label: 'Prefer not to say', value: 'PREFER_NOT_TO_SAY' }
  ];
  protected readonly submitted = signal(false);
  protected readonly isGenerating = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly sourceOptions = signal<Location[]>([]);
  protected readonly destinationOptions = signal<Location[]>([]);
  protected readonly isSourceLoading = signal(false);
  protected readonly isDestinationLoading = signal(false);
  protected readonly knownLocations = signal<Location[]>([]);
  protected readonly userVehicles = signal<UserVehicleOption[]>([]);
  protected readonly form = this.formService.createForm();
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected readonly selectedTravelMode = computed(
    () => this.form.controls.travelMode.value
  );
  protected readonly session = this.sessionService.session;
  protected readonly routeSummary = computed(() => {
    const source = this.findLocation(this.form.controls.source.value);
    const destination = this.findLocation(this.form.controls.destination.value);

    if (!source || !destination || source.id === destination.id) {
      return null;
    }

    return `${source.name} -> ${destination.name}`;
  });

  constructor() {
    this.restorePendingDraft();

    this.locationsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((locations) => {
        this.knownLocations.update((current) =>
          this.mergeLocations(current, locations)
        );
        this.sourceOptions.set(locations);
        this.destinationOptions.set(locations);
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
        this.formService.setPassengerCount(
          this.passengers,
          this.toNullableNumber(params.get('travellers')) ?? 1
        );
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
    this.loadUserVehicles();
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

  protected selectLocation(
    controlName: 'source' | 'destination',
    event: MatAutocompleteSelectedEvent
  ): void {
    const locationName = String(event.option.value);
    const location = this.findLocation(locationName);

    this.form.controls[controlName].setValue(locationName);
    this.form.controls[controlName].setErrors(null);

    if (location) {
      this.knownLocations.update((current) => this.mergeLocations(current, [location]));
    }
  }

  protected clearLocation(controlName: 'source' | 'destination'): void {
    this.form.controls[controlName].setValue('');
    this.form.controls[controlName].markAsDirty();
    this.form.controls[controlName].markAsTouched();
    this.errorMessage.set(null);
  }

  protected validateLocationSelection(controlName: 'source' | 'destination'): void {
    const control = this.form.controls[controlName];

    if (!control.value.trim() || this.findLocation(control.value)) {
      return;
    }

    control.setErrors({ unknownLocation: true });
  }

  protected resetPlanner(): void {
    this.form.reset({
      source: '',
      destination: '',
      startDate: '',
      endDate: '',
      passengers: [],
      travelMode: '',
      vehicleId: '',
      budget: null,
      interests: [],
      preferences: [],
      notes: ''
    });

    while (this.passengers.length > 1) {
      this.passengers.removeAt(this.passengers.length - 1);
    }

    this.passengers.at(0).reset({
      fullName: '',
      age: null,
      gender: ''
    });
    this.submitted.set(false);
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
      | 'travelMode'
      | 'vehicleId'
      | 'budget'
  ): boolean {
    const control = this.form.controls[controlName];
    return control.invalid && (control.touched || this.submitted());
  }

  protected get passengers(): FormArray {
    return this.form.controls.passengers;
  }

  protected addPassenger(): void {
    this.passengers.push(this.formService.createPassengerFormGroup());
    this.passengers.markAsDirty();
  }

  protected removePassenger(index: number): void {
    if (this.passengers.length === 1) {
      return;
    }

    this.passengers.removeAt(index);
    this.passengers.markAsDirty();
  }

  protected isPassengerInvalid(
    index: number,
    controlName: 'fullName' | 'age' | 'gender'
  ): boolean {
    const control = this.passengers.at(index).get(controlName);
    return !!control && control.invalid && (control.touched || this.submitted());
  }

  protected generateTrip(): void {
    this.submitted.set(true);
    this.errorMessage.set(null);
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.errorMessage.set('Please fix the highlighted fields before generating.');
      return;
    }

    const source = this.findLocation(this.form.controls.source.value);
    const destination = this.findLocation(this.form.controls.destination.value);

    if (!source) {
      this.errorMessage.set('Select a valid starting point from suggestions.');
      this.form.controls.source.setErrors({ unknownLocation: true });
      return;
    }

    if (!destination) {
      this.errorMessage.set('Select a valid destination from suggestions.');
      this.form.controls.destination.setErrors({ unknownLocation: true });
      return;
    }

    if (source.id === destination.id) {
      this.errorMessage.set('From and Destination cannot be the same location.');
      this.form.controls.destination.setErrors({ sameLocation: true });
      return;
    }

    if (!this.session().isAuthenticated) {
      this.savePendingDraft();
      void this.router.navigate(['/sign-in'], {
        queryParams: {
          returnUrl: '/plan',
          reason: 'generate-trip'
        }
      });
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
          localStorage.removeItem(PENDING_TRIP_DRAFT_KEY);
          void this.router.navigate(['/trip', trip.id]);
        },
        error: (error: Error) => {
          this.errorMessage.set(error.message);
        }
      });
  }

  private buildPayload(): CreateTripRequest {
    const value = this.form.getRawValue();
    const source = this.findLocation(value.source);
    const destination = this.findLocation(value.destination);

    if (!source || !destination) {
      throw new Error('Selected locations were not found in location data.');
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
      travellerCount: value.passengers.length,
      travellers: value.passengers.map((passenger) => ({
        fullName: passenger.fullName.trim(),
        age: Number(passenger.age),
        gender: passenger.gender
      })),
      budget: value.budget === null ? undefined : Number(value.budget),
      travelMode: value.travelMode,
      vehicleId: value.vehicleId || undefined,
      interests: value.interests,
      preferences: value.preferences,
      notes: value.notes || undefined
    };
  }

  private savePendingDraft(): void {
    localStorage.setItem(
      PENDING_TRIP_DRAFT_KEY,
      JSON.stringify(this.form.getRawValue())
    );
  }

  private restorePendingDraft(): void {
    const rawDraft = localStorage.getItem(PENDING_TRIP_DRAFT_KEY);

    if (!rawDraft) {
      return;
    }

    try {
      const draft = JSON.parse(rawDraft) as ReturnType<typeof this.form.getRawValue>;
      this.formService.setPassengerCount(
        this.passengers,
        Math.max(draft.passengers?.length ?? 1, 1)
      );
      this.form.patchValue({
        ...draft,
        passengers: undefined
      });
      draft.passengers?.forEach((passenger, index) => {
        this.passengers.at(index)?.patchValue(passenger);
      });
    } catch {
      localStorage.removeItem(PENDING_TRIP_DRAFT_KEY);
    }
  }

  private bindDestinationSearch(
    controlName: 'source' | 'destination',
    target: typeof this.sourceOptions
  ): void {
    const loading = controlName === 'source'
      ? this.isSourceLoading
      : this.isDestinationLoading;

    this.form.controls[controlName].valueChanges
      .pipe(
        debounceTime(220),
        distinctUntilChanged(),
        tap(() => loading.set(true)),
        switchMap((query) =>
          this.locationsApi.list({ q: query, limit: 30 }).pipe(
            catchError(() => of([] as Location[])),
            finalize(() => loading.set(false))
          )
        ),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe((locations) => {
        this.knownLocations.update((current) =>
          this.mergeLocations(current, locations)
        );
        target.set(locations);
      });
  }

  private loadUserVehicles(): void {
    if (!this.session().isAuthenticated) {
      return;
    }

    this.api
      .get<UserVehicleOption[]>('/vehicles/my')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (vehicles) => this.userVehicles.set(vehicles),
        error: () => this.userVehicles.set([])
      });
  }

  private filterLocations(query: string): Location[] {
    const normalizedQuery = query.trim().toLowerCase();
    const locations = this.knownLocations();

    if (!normalizedQuery) {
      return locations;
    }

    return locations.filter((location) =>
      `${location.name} ${location.state} ${location.country}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }

  private findLocation(name: string): Location | undefined {
    const normalizedName = name.trim().toLowerCase();
    return this.knownLocations().find(
      (location) => location.name.trim().toLowerCase() === normalizedName
    );
  }

  private mergeLocations(
    current: Location[],
    incoming: Location[]
  ): Location[] {
    const locations = new Map(current.map((location) => [location.id, location]));
    incoming.forEach((location) => locations.set(location.id, location));
    return [...locations.values()];
  }

  private toNullableNumber(value: string | null): number | null {
    if (value === null || value.trim() === '') {
      return null;
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }
}
