import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [MatCardModule, MatProgressSpinnerModule],
  template: `
    <mat-card class="loading-state" aria-live="polite">
      <mat-progress-spinner mode="indeterminate" diameter="40" />
      <p>{{ label() }}</p>
      <div class="skeleton" aria-hidden="true">
        <span></span>
        <span></span>
        <span></span>
      </div>
    </mat-card>
  `,
  styles: [
    `
      .loading-state {
        display: grid;
        gap: 12px;
        place-items: center;
        min-height: 180px;
        padding: 28px;
        color: #66706a;
      }

      p {
        margin: 0;
        font-weight: 800;
      }

      .skeleton {
        display: grid;
        width: min(420px, 100%);
        gap: 8px;
      }

      .skeleton span {
        height: 12px;
        background: linear-gradient(90deg, #eef2f1, #dfe8e5, #eef2f1);
        border-radius: 999px;
        animation: pulse 1.2s ease-in-out infinite;
      }

      .skeleton span:nth-child(2) {
        width: 78%;
      }

      .skeleton span:nth-child(3) {
        width: 58%;
      }

      @keyframes pulse {
        50% {
          opacity: 0.45;
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingStateComponent {
  readonly label = input('Loading');
}
