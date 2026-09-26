import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, filter, finalize, switchMap } from 'rxjs';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { ApiService } from '../../core/services/api.service';
import { INDIA_PHONE_PATTERN, PERSON_NAME_PATTERN } from '../../shared/utils/identity-validation.util';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { Location } from '../locations/location.model';
import { LocationsApiService } from '../locations/locations-api.service';
import { Me, MeApiService, TravelPace } from './me-api.service';
import { SessionService } from '../../core/auth/session.service';
import { ToastService } from '../../shared/services/toast.service';
import { interestOptions, travelModes } from '../trip-planner/models/trip-planner-options.model';

interface GarageEntry {
  id: string;
  nickname?: string | null;
  vehicle: { brand: string; model: string };
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    LoadingStateComponent,
    MatAutocompleteModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    ReactiveFormsModule
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly locationsApi = inject(LocationsApiService);
  private readonly meApi = inject(MeApiService);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);
  private readonly toast = inject(ToastService);

  protected readonly interestOptions = interestOptions;
  protected readonly travelModes = travelModes;
  protected readonly paceOptions: { value: TravelPace; label: string; hint: string }[] = [
    { value: 'RELAXED', label: 'Relaxed', hint: '2 stops a day' },
    { value: 'BALANCED', label: 'Balanced', hint: '3 stops a day' },
    { value: 'PACKED', label: 'Packed', hint: '4 stops a day' }
  ];
  protected readonly dietOptions = [
    { value: 'VEG', label: 'Vegetarian' },
    { value: 'NON_VEG', label: 'Non-vegetarian' },
    { value: 'EGGETARIAN', label: 'Eggetarian' },
    { value: 'JAIN', label: 'Jain' },
    { value: 'VEGAN', label: 'Vegan' }
  ];
  protected readonly budgetOptions = [
    { value: 'BUDGET', label: 'Budget' },
    { value: 'MID_RANGE', label: 'Mid-range' },
    { value: 'PREMIUM', label: 'Premium' }
  ];

  protected readonly me = signal<Me | null>(null);
  protected readonly garage = signal<GarageEntry[]>([]);
  protected readonly cityOptions = signal<Location[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly saving = signal<'account' | 'preferences' | 'password' | 'delete' | null>(null);

  protected readonly accountForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(PERSON_NAME_PATTERN)]],
    phone: ['', [Validators.pattern(INDIA_PHONE_PATTERN)]]
  });

  protected readonly preferencesForm = this.fb.group({
    homeCity: this.fb.nonNullable.control(''),
    homeLocationId: this.fb.control<string | null>(null),
    interests: this.fb.nonNullable.control<string[]>([]),
    pace: this.fb.nonNullable.control<TravelPace>('BALANCED'),
    dietaryPreference: this.fb.control<string | null>(null),
    budgetBand: this.fb.control<string | null>(null),
    preferredTravelMode: this.fb.control<string | null>(null),
    defaultUserVehicleId: this.fb.control<string | null>(null),
    marketingOptIn: this.fb.nonNullable.control(false)
  });

  protected readonly passwordForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]]
  });

  protected readonly deleteForm = this.fb.nonNullable.group({
    password: ['', Validators.required]
  });

  constructor() {
    this.meApi
      .get()
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed()
      )
      .subscribe({
        next: (me) => this.apply(me),
        error: (error: Error) => this.errorMessage.set(error.message)
      });

    this.api
      .get<GarageEntry[]>('/vehicles/my')
      .pipe(takeUntilDestroyed())
      .subscribe({ next: (entries) => this.garage.set(entries), error: () => this.garage.set([]) });

    this.preferencesForm.controls.homeCity.valueChanges
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        filter((query) => query.trim().length >= 2),
        switchMap((query) => this.locationsApi.list({ q: query, limit: 8 })),
        takeUntilDestroyed()
      )
      .subscribe({ next: (cities) => this.cityOptions.set(cities), error: () => this.cityOptions.set([]) });
  }

  protected garageLabel(entry: GarageEntry): string {
    return entry.nickname || `${entry.vehicle.brand} ${entry.vehicle.model}`;
  }

  protected selectCity(city: Location): void {
    this.preferencesForm.patchValue({ homeCity: `${city.name}, ${city.state}`, homeLocationId: city.id });
  }

  protected clearCity(): void {
    this.preferencesForm.patchValue({ homeCity: '', homeLocationId: null });
  }

  protected saveAccount(): void {
    this.accountForm.markAllAsTouched();

    if (this.accountForm.invalid) {
      return;
    }

    const { name, phone } = this.accountForm.getRawValue();
    this.saving.set('account');
    this.meApi
      .update({ name, phone: phone.trim() || null })
      .pipe(finalize(() => this.saving.set(null)))
      .subscribe({
        next: (me) => {
          this.apply(me);
          this.toast.success('Account details saved');
        },
        error: (error: Error) => this.toast.error(error.message)
      });
  }

  protected savePreferences(): void {
    const value = this.preferencesForm.getRawValue();

    if (value.homeCity.trim() && !value.homeLocationId) {
      this.toast.error('Pick your home city from the suggestions.');
      return;
    }

    this.saving.set('preferences');
    this.meApi
      .updateProfile({
        homeLocationId: value.homeCity.trim() ? value.homeLocationId : null,
        interests: value.interests,
        pace: value.pace,
        dietaryPreference: value.dietaryPreference,
        budgetBand: value.budgetBand,
        preferredTravelMode: value.preferredTravelMode,
        defaultUserVehicleId: value.defaultUserVehicleId,
        marketingOptIn: value.marketingOptIn
      })
      .pipe(finalize(() => this.saving.set(null)))
      .subscribe({
        next: (me) => {
          this.apply(me);
          this.toast.success('Travel preferences saved');
        },
        error: (error: Error) => this.toast.error(error.message)
      });
  }

  protected changePassword(): void {
    this.passwordForm.markAllAsTouched();

    if (this.passwordForm.invalid) {
      return;
    }

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.saving.set('password');
    this.meApi
      .changePassword(currentPassword, newPassword)
      .pipe(finalize(() => this.saving.set(null)))
      .subscribe({
        next: (session) => {
          this.session.adopt(session);
          this.passwordForm.reset();
          this.toast.success('Password changed. Other devices have been signed out.');
        },
        error: (error: Error) => this.toast.error(error.message)
      });
  }

  protected signOut(): void {
    this.session.logout().subscribe({ complete: () => void this.router.navigate(['/']) });
  }

  protected signOutEverywhere(): void {
    this.session.logoutEverywhere().subscribe({
      complete: () => {
        this.toast.success('Signed out on every device');
        void this.router.navigate(['/sign-in']);
      },
      error: () => void this.router.navigate(['/sign-in'])
    });
  }

  protected deleteAccount(): void {
    this.deleteForm.markAllAsTouched();

    if (this.deleteForm.invalid) {
      return;
    }

    this.saving.set('delete');
    this.meApi
      .deleteAccount(this.deleteForm.getRawValue().password)
      .pipe(finalize(() => this.saving.set(null)))
      .subscribe({
        next: () => {
          this.session.clear();
          this.toast.success('Your account and trips have been deleted.');
          void this.router.navigate(['/']);
        },
        error: (error: Error) => this.toast.error(error.message)
      });
  }

  private apply(me: Me): void {
    this.me.set(me);
    this.session.setUser({
      id: me.id,
      name: me.name,
      email: me.email,
      phone: me.phone,
      avatarUrl: me.avatarUrl,
      role: me.role
    });
    this.accountForm.reset({ name: me.name, phone: me.phone ?? '' });
    const home = me.profile.homeLocation;
    this.preferencesForm.reset({
      homeCity: home ? `${home.name}, ${home.state}` : '',
      homeLocationId: home?.id ?? null,
      interests: me.profile.interests,
      pace: me.profile.pace,
      dietaryPreference: me.profile.dietaryPreference,
      budgetBand: me.profile.budgetBand,
      preferredTravelMode: me.profile.preferredTravelMode,
      defaultUserVehicleId: me.profile.defaultUserVehicle?.id ?? null,
      marketingOptIn: me.profile.marketingOptIn
    });
  }
}
