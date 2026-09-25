import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal
} from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { finalize, switchMap } from 'rxjs';

import {
  interestOptions,
  preferenceOptions,
  travelModes
} from './models/trip-planner-options.model';
import { CreateTripRequest } from '../trip-result/models/trip.model';
import { TripsApiService } from '../trip-result/services/trips-api.service';
import { TripPlannerFormService } from './services/trip-planner-form.service';

@Component({
  selector: 'app-trip-planner',
  standalone: true,
  imports: [
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
  private readonly formService = inject(TripPlannerFormService);
  private readonly router = inject(Router);
  private readonly tripsApi = inject(TripsApiService);

  protected readonly travelModes = travelModes;
  protected readonly interestOptions = interestOptions;
  protected readonly preferenceOptions = preferenceOptions;
  protected readonly submitted = signal(false);
  protected readonly isGenerating = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form = this.formService.createForm();
  protected readonly selectedTravelMode = computed(
    () => this.form.controls.travelMode.value
  );

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

  protected isInvalid(
    controlName:
      | 'source'
      | 'destination'
      | 'startDate'
      | 'endDate'
      | 'travellers'
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
    const source = this.resolveCoordinates(value.source);
    const destination = this.resolveCoordinates(value.destination);

    return {
      source: {
        name: value.source,
        latitude: source.latitude,
        longitude: source.longitude
      },
      destination: {
        name: value.destination,
        latitude: destination.latitude,
        longitude: destination.longitude
      },
      startDate: value.startDate,
      endDate: value.endDate,
      travellerCount: value.travellers,
      budget: value.budget,
      travelMode: value.travelMode,
      vehicle: {
        brand: value.vehicleBrand,
        model: value.vehicleModel,
        mileage: value.mileage
      },
      interests: value.interests
    };
  }

  private resolveCoordinates(name: string): { latitude: number; longitude: number } {
    const normalizedName = name.trim().toLowerCase();
    const knownCoordinates: Record<string, { latitude: number; longitude: number }> = {
      gurgaon: { latitude: 28.4595, longitude: 77.0266 },
      gurugram: { latitude: 28.4595, longitude: 77.0266 },
      jibhi: { latitude: 31.5964, longitude: 77.3511 },
      manali: { latitude: 32.2432, longitude: 77.1892 },
      rishikesh: { latitude: 30.0869, longitude: 78.2676 },
      jaipur: { latitude: 26.9124, longitude: 75.7873 },
      udaipur: { latitude: 24.5854, longitude: 73.7125 },
      goa: { latitude: 15.2993, longitude: 74.124 },
      mumbai: { latitude: 19.076, longitude: 72.8777 },
      bengaluru: { latitude: 12.9716, longitude: 77.5946 },
      coorg: { latitude: 12.3375, longitude: 75.8069 }
    };

    return knownCoordinates[normalizedName] ?? {
      latitude: 28.4595,
      longitude: 77.0266
    };
  }
}
