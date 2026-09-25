import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';

import { SessionService } from '../../core/auth/session.service';
import {
  INDIA_PHONE_PATTERN,
  PERSON_NAME_PATTERN
} from '../../shared/utils/identity-validation.util';

@Component({
  selector: 'app-auth-page',
  standalone: true,
  imports: [
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './auth-page.component.html',
  styleUrl: './auth-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AuthPageComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(SessionService);

  protected readonly mode = signal<'signin' | 'signup'>(
    this.router.url.includes('sign-up') ? 'signup' : 'signin'
  );
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly title = computed(() =>
    this.mode() === 'signup' ? 'Create your travel account' : 'Welcome back'
  );
  protected readonly authReason = computed(() =>
    this.route.snapshot.queryParamMap.get('reason') === 'generate-trip'
      ? 'Sign in or create an account to generate and save your trip.'
      : null
  );
  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.pattern(PERSON_NAME_PATTERN)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.pattern(INDIA_PHONE_PATTERN)]],
    password: ['', [Validators.required, Validators.minLength(8)]]
  });

  protected setMode(mode: 'signin' | 'signup'): void {
    this.mode.set(mode);
    this.errorMessage.set(null);
  }

  protected submit(): void {
    this.form.markAllAsTouched();
    this.errorMessage.set(null);

    if (this.form.invalid || (this.mode() === 'signup' && !this.form.controls.name.value.trim())) {
      this.errorMessage.set('Please complete the highlighted fields.');
      return;
    }

    const value = this.form.getRawValue();
    const request =
      this.mode() === 'signup'
        ? this.session.register({
            name: value.name,
            email: value.email,
            password: value.password,
            phone: value.phone || undefined
          })
        : this.session.login(value.email, value.password);

    this.isSubmitting.set(true);
    request.pipe(finalize(() => this.isSubmitting.set(false))).subscribe({
      next: () => {
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        void this.router.navigateByUrl(
          returnUrl?.startsWith('/') ? returnUrl : '/profile'
        );
      },
      error: (error: Error) => this.errorMessage.set(error.message)
    });
  }
}
