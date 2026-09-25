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
        vehicleBrand: this.fb.nonNullable.control(''),
        vehicleModel: this.fb.nonNullable.control(''),
        mileage: this.fb.control<number | null>(null, [Validators.min(1)]),
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
