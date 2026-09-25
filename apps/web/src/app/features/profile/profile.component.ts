import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

import { SessionService } from '../../core/auth/session.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, RouterLink],
  template: `
    <main class="profile-page app-page">
      <mat-card class="profile-card" appearance="outlined">
        @if (session.session().user; as user) {
          <p class="page-kicker">Profile</p>
          <h1 class="page-title">{{ user.name }}</h1>
          <dl>
            <div>
              <dt>Email</dt>
              <dd>{{ user.email }}</dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>{{ user.phone ?? 'Not added' }}</dd>
            </div>
          </dl>
          <button mat-stroked-button type="button" (click)="session.clear()">Sign out</button>
        } @else {
          <p class="page-kicker">Profile</p>
          <h1 class="page-title">Sign in to personalize your trips.</h1>
          <a mat-flat-button color="primary" routerLink="/sign-in">Sign in</a>
        }
      </mat-card>
    </main>
  `,
  styles: [
    `
      .profile-page {
        min-height: 80vh;
      }

      .profile-card {
        display: grid;
        gap: 18px;
        width: min(780px, 100%);
        padding: 28px;
      }

      dl {
        display: grid;
        gap: 12px;
        margin: 0;
      }

      dl div {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        padding-bottom: 10px;
        border-bottom: 1px solid rgba(23, 33, 27, 0.08);
      }

      dt {
        color: #66706a;
      }

      dd {
        margin: 0;
        font-weight: 900;
      }

      a,
      button {
        width: fit-content;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProfileComponent {
  protected readonly session = inject(SessionService);
}
