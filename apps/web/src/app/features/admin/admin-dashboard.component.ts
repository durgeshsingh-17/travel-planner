import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { AdminApiService } from './admin-api.service';
import { HealthOverview } from './admin.models';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { StatusBadgeComponent, scoreClass } from './shared/status-badge.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [LoadingStateComponent, RouterLink, StatusBadgeComponent],
  template: `
    <main class="admin-page">
      <h1>Content health</h1>
      @if (overview(); as data) {
        <div class="summary">
          <article class="admin-card">
            <h2>Destinations</h2>
            <p>{{ data.destinations.published }} published · {{ data.destinations.draft }} drafts</p>
            <p>Average health <span [class]="scoreClass(data.destinations.averageScore ?? 0)">{{ data.destinations.averageScore ?? '—' }}%</span></p>
          </article>
          <article class="admin-card">
            <h2>Places</h2>
            <p>{{ data.places.published }} published · {{ data.places.draft }} drafts</p>
            <p>Average health <span [class]="scoreClass(data.places.averageScore ?? 0)">{{ data.places.averageScore ?? '—' }}%</span></p>
          </article>
          <article class="admin-card">
            <h2>Collections</h2>
            <p>{{ data.collections.published }} of {{ data.collections.total }} published</p>
          </article>
        </div>

        <section class="admin-card">
          <h2>Destinations that need the most work</h2>
          <table class="admin-table">
            <tr><th>Destination</th><th>Status</th><th>Health</th><th>Next step</th></tr>
            @for (row of data.weakestDestinations; track row.id) {
              <tr>
                <td><a [routerLink]="['/admin/destinations', row.id]">{{ row.name }}</a></td>
                <td><app-status-badge [status]="row.status" /></td>
                <td><span [class]="scoreClass(row.health.score)">{{ row.health.score }}%</span></td>
                <td class="muted">{{ row.health.errors[0] ?? row.health.warnings[0] ?? 'Complete' }}</td>
              </tr>
            }
          </table>
        </section>

        <section class="admin-card">
          <h2>Places that need the most work</h2>
          <table class="admin-table">
            <tr><th>Place</th><th>Destination</th><th>Health</th><th>Next step</th></tr>
            @for (row of data.weakestPlaces; track row.id) {
              <tr>
                <td><a [routerLink]="['/admin/places', row.id]">{{ row.name }}</a></td>
                <td>{{ row.destination }}</td>
                <td><span [class]="scoreClass(row.health.score)">{{ row.health.score }}%</span></td>
                <td class="muted">{{ row.health.errors[0] ?? row.health.warnings[0] ?? 'Complete' }}</td>
              </tr>
            }
          </table>
        </section>
      } @else if (error()) {
        <p>{{ error() }}</p>
      } @else {
        <app-loading-state label="Checking content" />
      }
    </main>
  `,
  styles: `.summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDashboardComponent {
  protected readonly overview = signal<HealthOverview | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly scoreClass = scoreClass;

  constructor() {
    inject(AdminApiService)
      .contentHealth()
      .pipe(takeUntilDestroyed())
      .subscribe({ next: (data) => this.overview.set(data), error: (error: Error) => this.error.set(error.message) });
  }
}
