import { Injectable, inject } from '@angular/core';
import {
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';

@Injectable()
export class TripPlannerFormService {
  private readonly fb = inject(FormBuilder);

  createForm() {
    return this.fb.nonNullable.group(
      {
        source: this.fb.nonNullable.control('Gurgaon', [Validators.required]),
        destination: this.fb.nonNullable.control('Jibhi', [Validators.required]),
        startDate: this.fb.nonNullable.control('', [Validators.required]),
        endDate: this.fb.nonNullable.control('', [Validators.required]),
        travellers: this.fb.nonNullable.control(2, [
          Validators.required,
          Validators.min(1)
        ]),
        travelMode: this.fb.nonNullable.control('BIKE', [Validators.required]),
        vehicleBrand: this.fb.nonNullable.control('Honda'),
        vehicleModel: this.fb.nonNullable.control('CB350'),
        mileage: this.fb.nonNullable.control(32, [Validators.min(1)]),
        budget: this.fb.nonNullable.control(15000, [Validators.min(0)]),
        interests: this.fb.nonNullable.control<string[]>([
          'mountains',
          'photography',
          'food'
        ]),
        preferences: this.fb.nonNullable.control<string[]>([
          'scenic-route',
          'avoid-night-driving'
        ]),
        notes: this.fb.nonNullable.control('')
      },
      {
        validators: [this.dateRangeValidator]
      }
    );
  }

  private dateRangeValidator(control: AbstractControl): ValidationErrors | null {
    const startDate = control.get('startDate')?.value;
    const endDate = control.get('endDate')?.value;

    if (!startDate || !endDate) {
      return null;
    }

    return new Date(endDate) >= new Date(startDate)
      ? null
      : { invalidDateRange: true };
  }
}
