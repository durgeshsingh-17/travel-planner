import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

import { AdminApiService } from './admin-api.service';
import { AuditEntry } from './admin.models';

@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [JsonPipe, MatButtonModule],
  template: `
    <main class="admin-page">
      <h1>Audit log</h1>
      <table class="admin-table">
        <tr><th>When</th><th>Who</th><th>Action</th><th>What</th><th>Changes</th></tr>
        @for (entry of entries(); track entry.id) {
          <tr>
            <td class="muted">{{ entry.createdAt.slice(0, 16).replace('T', ' ') }}</td>
            <td>{{ entry.actor?.name ?? 'System' }}</td>
            <td>{{ entry.action }}</td>
            <td>{{ entry.entityType }} · {{ entry.summary }}</td>
            <td class="muted small">{{ entry.changes ? (entry.changes | json) : '' }}</td>
          </tr>
        }
      </table>
      @if (hasMore()) {
        <button mat-stroked-button type="button" (click)="more()">Load more</button>
      }
    </main>
  `,
  styles: `.small { font-size: .78rem; max-width: 360px; overflow-wrap: anywhere; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminAuditComponent {
  private readonly admin = inject(AdminApiService);
  protected readonly entries = signal<AuditEntry[]>([]);
  protected readonly hasMore = signal(false);
  private page = 1;

  constructor() {
    this.load();
  }

  protected more(): void {
    this.page += 1;
    this.load();
  }

  private load(): void {
    this.admin.auditLog({ page: this.page }).subscribe((result) => {
      this.entries.update((current) => [...current, ...result.items]);
      this.hasMore.set(result.page * result.pageSize < result.total);
    });
  }
}
