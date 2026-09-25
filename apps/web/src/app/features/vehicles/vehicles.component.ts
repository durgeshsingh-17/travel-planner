import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin, of } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ApiService } from '../../core/services/api.service';
import { SessionService } from '../../core/auth/session.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';

interface Vehicle {
  id: string;
  brand: string;
  model: string;
  type: string;
  fuelType: string;
  averageMileage?: number | null;
}

interface UserVehicle {
  id: string;
  nickname?: string | null;
  customMileage?: number | null;
  registrationNumber?: string | null;
  vehicle: Vehicle;
}

interface CreateUserVehicleInput {
  vehicleId: string;
  nickname: string;
  customMileage: number;
  registrationNumber: string;
}

@Component({
  selector: 'app-vehicles',
  standalone: true,
  imports: [
    EmptyStateComponent,
    LoadingStateComponent,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatSnackBarModule,
    ReactiveFormsModule,
    RouterLink
  ],
  template: `
    <main class="vehicles-page app-page">
      <section class="page-heading">
        <p class="page-kicker">Vehicle Garage</p>
        <h1 class="page-title">Manage the vehicles that power your trips.</h1>
        <p class="page-copy">
          Save your own bike or car profile so fuel estimates and trip planning
          can use the mileage you actually ride with.
        </p>
      </section>

      @if (isLoading()) {
        <app-loading-state label="Loading vehicles" />
      } @else {
        <section class="garage-layout">
          <mat-card appearance="outlined">
            <mat-card-header>
              <mat-card-title>Add my vehicle</mat-card-title>
              <mat-card-subtitle>
                Choose a catalog vehicle and add your nickname, mileage and registration.
              </mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              @if (!session().isAuthenticated) {
                <app-empty-state
                  title="Sign in to save vehicles"
                  message="The public vehicle catalog is available below. Sign in to keep your own garage."
                />
                <a mat-flat-button color="primary" routerLink="/sign-in">Sign in</a>
              } @else {
                <form [formGroup]="vehicleForm" (ngSubmit)="saveUserVehicle()">
                  <mat-form-field appearance="outline">
                    <mat-label>Catalog vehicle</mat-label>
                    <mat-select formControlName="vehicleId">
                      @for (vehicle of vehicles(); track vehicle.id) {
                        <mat-option [value]="vehicle.id">
                          {{ vehicle.brand }} {{ vehicle.model }} • {{ vehicle.type }}
                        </mat-option>
                      }
                    </mat-select>
                    <mat-error>Select a vehicle.</mat-error>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Nickname</mat-label>
                    <input matInput formControlName="nickname" placeholder="Weekend bike" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Custom mileage</mat-label>
                    <input matInput formControlName="customMileage" type="number" min="1" />
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Registration number</mat-label>
                    <input matInput formControlName="registrationNumber" placeholder="DL 01 AB 1234" />
                  </mat-form-field>
                  <button mat-flat-button color="primary" type="submit" [disabled]="isSaving()">
                    {{ isSaving() ? 'Saving...' : 'Save Vehicle' }}
                  </button>
                </form>
              }
            </mat-card-content>
          </mat-card>

          <mat-card appearance="outlined">
            <mat-card-header>
              <mat-card-title>My garage</mat-card-title>
              <mat-card-subtitle>Personal vehicles linked to your account.</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              @if (!session().isAuthenticated) {
                <p class="muted">Sign in to see your saved vehicles.</p>
              } @else if (userVehicles().length === 0) {
                <app-empty-state
                  title="No saved vehicles"
                  message="Add one from the catalog to make future trips faster."
                />
              } @else {
                <div class="my-list">
                  @for (entry of userVehicles(); track entry.id) {
                    <article>
                      <div>
                        <mat-chip-set aria-label="Vehicle type">
                          <mat-chip>{{ entry.vehicle.type }}</mat-chip>
                          <mat-chip>{{ entry.vehicle.fuelType }}</mat-chip>
                        </mat-chip-set>
                        <h2>{{ entry.nickname || entry.vehicle.brand + ' ' + entry.vehicle.model }}</h2>
                        <p>
                          {{ entry.vehicle.brand }} {{ entry.vehicle.model }} •
                          {{ entry.customMileage ?? entry.vehicle.averageMileage ?? 18 }} km/l
                        </p>
                        @if (entry.registrationNumber) {
                          <small>{{ entry.registrationNumber }}</small>
                        }
                      </div>
                      <button mat-button color="warn" type="button" (click)="removeUserVehicle(entry.id)">
                        Remove
                      </button>
                    </article>
                  }
                </div>
              }
            </mat-card-content>
          </mat-card>
        </section>

        <section class="catalog-section">
          <div>
            <p class="page-kicker">Catalog</p>
            <h2>Available vehicles</h2>
          </div>
          @if (vehicles().length === 0) {
            <app-empty-state
              title="No vehicles in catalog"
              message="Run the Prisma seed to load starter vehicles."
            />
          } @else {
            <section class="vehicle-grid">
              @for (vehicle of vehicles(); track vehicle.id) {
                <mat-card appearance="outlined">
                  <mat-chip-set aria-label="Vehicle facts">
                    <mat-chip>{{ vehicle.type }}</mat-chip>
                    <mat-chip>{{ vehicle.fuelType }}</mat-chip>
                  </mat-chip-set>
                  <h3>{{ vehicle.brand }} {{ vehicle.model }}</h3>
                  <p>{{ vehicle.averageMileage ?? 18 }} km/l estimated mileage</p>
                </mat-card>
              }
            </section>
          }
        </section>
      }
    </main>
  `,
  styles: [
    `
      .page-heading {
        margin-bottom: 26px;
      }

      .garage-layout {
        display: grid;
        grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
        gap: 16px;
        margin-bottom: 30px;
      }

      form,
      .my-list {
        display: grid;
        gap: 12px;
      }

      mat-card-content {
        padding-top: 16px;
      }

      .catalog-section {
        display: grid;
        gap: 16px;
      }

      .vehicle-grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 16px;
      }

      .vehicle-grid mat-card,
      .my-list article {
        padding: 18px;
      }

      .my-list article {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        border: 1px solid rgba(23, 33, 27, 0.1);
        border-radius: 8px;
      }

      h2,
      h3 {
        margin: 12px 0 8px;
      }

      p,
      small,
      .muted {
        margin: 0;
        color: #66706a;
      }

      small {
        display: block;
        margin-top: 6px;
        font-weight: 800;
      }

      @media (max-width: 760px) {
        .garage-layout,
        .vehicle-grid {
          grid-template-columns: 1fr;
        }

        .my-list article {
          align-items: stretch;
          flex-direction: column;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VehiclesComponent {
  private readonly api = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly formBuilder = inject(FormBuilder);
  private readonly sessionService = inject(SessionService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly vehicles = signal<Vehicle[]>([]);
  protected readonly userVehicles = signal<UserVehicle[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  protected readonly session = this.sessionService.session;
  protected readonly vehicleForm = this.formBuilder.nonNullable.group({
    vehicleId: ['', Validators.required],
    nickname: [''],
    customMileage: [18, [Validators.min(1), Validators.max(200)]],
    registrationNumber: ['']
  });

  constructor() {
    this.loadVehicles();
  }

  protected saveUserVehicle(): void {
    if (this.vehicleForm.invalid) {
      this.vehicleForm.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    this.api
      .post<UserVehicle, CreateUserVehicleInput>('/vehicles/my', this.vehicleForm.getRawValue())
      .pipe(finalize(() => this.isSaving.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (vehicle) => {
          this.userVehicles.update((vehicles) => [vehicle, ...vehicles]);
          this.snackBar.open('Vehicle saved', 'Close', { duration: 2200 });
        },
        error: (error: Error) => {
          this.snackBar.open(error.message, 'Close', { duration: 3200 });
        }
      });
  }

  protected removeUserVehicle(id: string): void {
    this.api
      .delete<{ deleted: boolean }>(`/vehicles/my/${id}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.userVehicles.update((vehicles) =>
            vehicles.filter((vehicle) => vehicle.id !== id)
          );
          this.snackBar.open('Vehicle removed', 'Close', { duration: 2200 });
        },
        error: (error: Error) => {
          this.snackBar.open(error.message, 'Close', { duration: 3200 });
        }
      });
  }

  private loadVehicles(): void {
    const catalog$ = this.api.get<Vehicle[]>('/vehicles');
    const session = this.session();
    const request$ = session.isAuthenticated
      ? forkJoin({
          vehicles: catalog$,
          userVehicles: this.api.get<UserVehicle[]>('/vehicles/my')
        })
      : forkJoin({
          vehicles: catalog$,
          userVehicles: of([] as UserVehicle[])
        });

    request$
      .pipe(finalize(() => this.isLoading.set(false)), takeUntilDestroyed(this.destroyRef))
      .subscribe(({ vehicles, userVehicles }) => {
        this.vehicles.set(vehicles);
        this.userVehicles.set(userVehicles);
        this.vehicleForm.patchValue({
          vehicleId: vehicles[0]?.id ?? ''
        });
      });
  }
}
