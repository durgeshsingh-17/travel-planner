import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { ContentStatus } from '../admin.models';
import { StatusBadgeComponent } from './status-badge.component';

@Component({
  selector: 'app-editor-actions',
  standalone: true,
  imports: [MatButtonModule, RouterLink, StatusBadgeComponent],
  template: `
    @if (problems().length) {
      <div class="problems" role="alert">
        <ul>
          @for (problem of problems(); track problem) { <li>{{ problem }}</li> }
        </ul>
        @if (conflict()) {
          <button mat-stroked-button type="button" (click)="reload.emit()">Reload latest version</button>
        }
      </div>
    }
    <div class="sticky-actions">
      <app-status-badge [status]="status()" />
      <button mat-flat-button color="primary" type="button" [disabled]="busy()" (click)="save.emit()">
        {{ isNew() ? 'Create draft' : 'Save' }}
      </button>
      @if (!isNew()) {
        @if (status() !== 'PUBLISHED') {
          <button mat-stroked-button type="button" [disabled]="busy() || !canPublish()" (click)="statusChange.emit('publish')">Publish</button>
        } @else {
          <button mat-stroked-button type="button" [disabled]="busy()" (click)="statusChange.emit('unpublish')">Unpublish</button>
        }
        @if (status() !== 'ARCHIVED') {
          <button mat-button type="button" [disabled]="busy()" (click)="statusChange.emit('archive')">Archive</button>
        }
        @if (publicPath() && status() === 'PUBLISHED') {
          <a mat-button [routerLink]="publicPath()" target="_blank" rel="noopener">View live</a>
        }
        @if (canDelete() && status() !== 'PUBLISHED') {
          <button mat-button class="danger" type="button" [disabled]="busy()" (click)="remove.emit()">Delete</button>
        }
      }
      @if (dirty()) {
        <span class="muted">Unsaved changes</span>
      }
    </div>
  `,
  styles: `
    .problems { padding: 12px 16px; border: 1px solid var(--danger); border-radius: 10px; color: var(--danger); }
    .problems ul { margin: 0 0 8px; padding-left: 18px; }
    .sticky-actions { align-items: center; }
    .danger { color: var(--danger); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class EditorActionsComponent {
  readonly status = input.required<ContentStatus>();
  readonly isNew = input(false);
  readonly busy = input(false);
  readonly dirty = input(false);
  readonly canPublish = input(true);
  readonly canDelete = input(false);
  readonly publicPath = input<string | null>(null);
  readonly problems = input<string[]>([]);
  readonly conflict = input(false);

  readonly save = output<void>();
  readonly statusChange = output<'publish' | 'unpublish' | 'archive'>();
  readonly remove = output<void>();
  readonly reload = output<void>();
}
