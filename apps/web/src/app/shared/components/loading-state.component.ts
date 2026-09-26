import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <mat-card class="loading-state" aria-live="polite" aria-busy="true">
      <div class="loading-state__head">
        <span class="shimmer dot" aria-hidden="true"></span>
        <p>{{ label() }}</p>
      </div>
      <div class="skeleton-grid" aria-hidden="true">
        @for (item of skeletonItems(); track item) {
          <article>
            <span class="shimmer media"></span>
            <span class="shimmer line strong"></span>
            <span class="shimmer line"></span>
            <span class="shimmer line short"></span>
          </article>
        }
      </div>
    </mat-card>
  `,
  styles: [
    `
      .loading-state {
        display: grid;
        gap: 18px;
        min-height: 220px;
        padding: 28px;
        color: var(--muted);
      }

      .loading-state__head {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      p {
        margin: 0;
        font-weight: 800;
      }

      .dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
      }

      .skeleton-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 14px;
      }

      article {
        display: grid;
        gap: 10px;
        min-height: 170px;
        padding: 14px;
        border: 1px solid var(--border);
        border-radius: 8px;
      }

      .shimmer {
        position: relative;
        overflow: hidden;
        background: color-mix(in srgb, var(--muted) 14%, transparent);
      }

      .shimmer::after {
        position: absolute;
        inset: 0;
        background: linear-gradient(
          90deg,
          transparent,
          color-mix(in srgb, var(--surface) 72%, transparent),
          transparent
        );
        animation: shimmer 1.2s infinite;
        content: '';
        transform: translateX(-100%);
      }

      .media {
        height: 78px;
        border-radius: 8px;
      }

      .line {
        height: 12px;
        border-radius: 999px;
      }

      .strong {
        width: 78%;
        height: 16px;
      }

      .short {
        width: 54%;
      }

      @keyframes shimmer {
        to {
          transform: translateX(100%);
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingStateComponent {
  readonly label = input('Loading');
  readonly count = input(3);
  protected readonly skeletonItems = () =>
    Array.from({ length: Math.max(this.count(), 1) }, (_, index) => index);
}
