import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ContentStatus } from '../admin.models';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  template: `<span class="status-badge" [class]="'status-badge ' + status().toLowerCase()">{{ status() }}</span>`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatusBadgeComponent {
  readonly status = input.required<ContentStatus>();
}

/** CSS class for a 0–100 content-health score. */
export function scoreClass(score: number): string {
  return score >= 80 ? 'score high' : score >= 50 ? 'score mid' : 'score low';
}
