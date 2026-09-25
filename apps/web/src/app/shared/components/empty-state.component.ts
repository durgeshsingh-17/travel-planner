import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  imports: [MatCardModule],
  template: `
    <mat-card class="empty-state">
      <h2>{{ title() }}</h2>
      <p>{{ message() }}</p>
    </mat-card>
  `,
  styles: [
    `
      .empty-state {
        display: grid;
        gap: 8px;
        padding: 32px;
        background: #ffffff;
        border: 1px solid rgba(23, 33, 27, 0.1);
        border-radius: 8px;
      }

      h2,
      p {
        margin: 0;
      }

      p {
        color: #66706a;
        line-height: 1.6;
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
  readonly message = input.required<string>();
}
