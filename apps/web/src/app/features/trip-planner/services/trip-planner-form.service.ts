import { Injectable } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors
} from '@angular/forms';

import { normalizePassengerCount } from './trip-planner-form.util';

@Injectable()
export class TripPlannerFormService {
  constructor(private readonly fb: FormBuilder) {}

  createForm() {
    return this.fb.nonNullable.group(
      {
        source: this.fb.nonNullable.control('', [Validators.required]),
        destination: this.fb.nonNullable.control('', [Validators.required]),
        startDate: this.fb.nonNullable.control('', [
          Validators.required,
          this.notPastDate
        ]),
        endDate: this.fb.nonNullable.control('', [Validators.required]),
        passengers: this.fb.array([this.createPassengerFormGroup()]),
        travelMode: this.fb.nonNullable.control('', [Validators.required]),
        vehicleId: this.fb.nonNullable.control(''),
        budget: this.fb.control<number | null>(null, [
          Validators.required,
          Validators.min(0)
        ]),
        interests: this.fb.nonNullable.control<string[]>([], [this.arrayRequired]),
        preferences: this.fb.nonNullable.control<string[]>([]),
        notes: this.fb.nonNullable.control('')
      },
      {
        validators: [this.dateRangeValidator]
      }
    );
  }

  createPassengerFormGroup() {
    return this.fb.nonNullable.group({
      fullName: this.fb.nonNullable.control('', [
        Validators.required,
        Validators.minLength(2)
      ]),
      age: this.fb.control<number | null>(null, [
        Validators.required,
        Validators.min(0),
        Validators.max(120)
      ]),
      gender: this.fb.nonNullable.control('', [Validators.required])
    });
  }

  setPassengerCount(passengers: FormArray, count: number): void {
    const normalizedCount = normalizePassengerCount(count);

    while (passengers.length < normalizedCount) {
      passengers.push(this.createPassengerFormGroup());
    }

    while (passengers.length > normalizedCount) {
      passengers.removeAt(passengers.length - 1);
    }
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

  private notPastDate(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(control.value);
    selectedDate.setHours(0, 0, 0, 0);

    return selectedDate >= today ? null : { pastDate: true };
  }

  private arrayRequired(control: AbstractControl): ValidationErrors | null {
    return Array.isArray(control.value) && control.value.length > 0
      ? null
      : { required: true };
  }
}
