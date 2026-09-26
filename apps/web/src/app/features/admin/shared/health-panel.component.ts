import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ContentHealth } from '../admin.models';
import { scoreClass } from './status-badge.component';

@Component({
  selector: 'app-health-panel',
  standalone: true,
  template: `
    @let value = health();
    <section class="admin-card" aria-label="Content health">
      <p>Content health <span [class]="scoreClass(value.score)">{{ value.score }}%</span></p>
      @if (value.errors.length) {
        <div>
          <strong>Must fix before publishing</strong>
          <ul class="errors">
            @for (error of value.errors; track error) { <li>{{ error }}</li> }
          </ul>
        </div>
      }
      @if (value.warnings.length) {
        <div>
          <strong>Recommended</strong>
          <ul>
            @for (warning of value.warnings; track warning) { <li>{{ warning }}</li> }
          </ul>
        </div>
      } @else if (!value.errors.length) {
        <p class="muted">Everything recommended is in place.</p>
      }
      <p class="muted small">Health reflects the last saved version.</p>
    </section>
  `,
  styles: `
    ul { margin: 6px 0 0; padding-left: 18px; }
    .errors { color: var(--danger); }
    .small { font-size: .8rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HealthPanelComponent {
  readonly health = input.required<ContentHealth>();
  protected readonly scoreClass = scoreClass;
}
