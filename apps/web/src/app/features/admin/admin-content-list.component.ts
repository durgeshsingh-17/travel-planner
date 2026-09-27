import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable, combineLatest, debounceTime, map, startWith, switchMap } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { AdminApiService, EditableEntity } from './admin-api.service';
import { ContentHealth, ContentStatus } from './admin.models';
import { StatusBadgeComponent, scoreClass } from './shared/status-badge.component';
import { labelize } from '../../shared/utils/content-format.util';

interface Row {
  id: string;
  title: string;
  subtitle: string;
  status: ContentStatus;
  updatedAt: string;
  health: ContentHealth;
}

const LABELS: Record<EditableEntity, { title: string; singular: string }> = {
  destinations: { title: 'Destinations', singular: 'destination' },
  places: { title: 'Places', singular: 'place' },
  collections: { title: 'Collections', singular: 'collection' },
  packages: { title: 'Packages', singular: 'package' }
};

/** One list screen for destinations, places and collections (route data picks which). */
@Component({
  selector: 'app-admin-content-list',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, ReactiveFormsModule, RouterLink, StatusBadgeComponent],
  template: `
    <main class="admin-page">
      <div class="admin-toolbar">
        <h1>{{ labels().title }}</h1>
        <a mat-flat-button color="primary" [routerLink]="['/admin', entity, 'new']">New {{ labels().singular }}</a>
      </div>
      <div class="admin-toolbar">
        <div class="filters">
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Search</mat-label>
            <input matInput [formControl]="search" />
          </mat-form-field>
          <mat-form-field appearance="outline" subscriptSizing="dynamic">
            <mat-label>Status</mat-label>
            <mat-select [formControl]="status">
              <mat-option value="">All</mat-option>
              <mat-option value="DRAFT">Draft</mat-option>
              <mat-option value="PUBLISHED">Published</mat-option>
              <mat-option value="ARCHIVED">Archived</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
        <span class="muted">{{ total() }} total</span>
      </div>
      <table class="admin-table">
        <tr><th>Name</th><th>Status</th><th>Health</th><th>Updated</th></tr>
        @for (row of rows(); track row.id) {
          <tr>
            <td>
              <a [routerLink]="['/admin', entity, row.id]">{{ row.title }}</a>
              <div class="muted small">{{ row.subtitle }}</div>
            </td>
            <td><app-status-badge [status]="row.status" /></td>
            <td><span [class]="scoreClass(row.health.score)">{{ row.health.score }}%</span></td>
            <td class="muted">{{ row.updatedAt.slice(0, 10) }}</td>
          </tr>
        } @empty {
          <tr><td colspan="4" class="muted">Nothing here yet.</td></tr>
        }
      </table>
    </main>
  `,
  styles: `.small { font-size: .8rem; }`,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminContentListComponent {
  private readonly admin = inject(AdminApiService);
  protected readonly entity = inject(ActivatedRoute).snapshot.data['entity'] as EditableEntity;
  protected readonly labels = computed(() => LABELS[this.entity]);
  protected readonly scoreClass = scoreClass;

  protected readonly search = new FormControl('', { nonNullable: true });
  protected readonly status = new FormControl<ContentStatus | ''>('', { nonNullable: true });
  protected readonly rows = signal<Row[]>([]);
  protected readonly total = signal(0);

  constructor() {
    combineLatest([
      this.search.valueChanges.pipe(startWith(''), debounceTime(250)),
      this.status.valueChanges.pipe(startWith('' as ContentStatus | ''))
    ])
      .pipe(
        switchMap(([q, status]) => this.load(q, status)),
        takeUntilDestroyed()
      )
      .subscribe(({ rows, total }) => {
        this.rows.set(rows);
        this.total.set(total);
      });
  }

  private load(q: string, status: ContentStatus | ''): Observable<{ rows: Row[]; total: number }> {
    if (this.entity === 'destinations') {
      return this.admin.listDestinations({ q, status }).pipe(
        map((page) => ({
          total: page.total,
          rows: page.items.map((item) => ({
            ...item,
            title: item.name,
            subtitle: `${item.state} · ${item.publishedPlaceCount} published places`
          }))
        }))
      );
    }

    if (this.entity === 'places') {
      return this.admin.listPlaces({ q, status }).pipe(
        map((page) => ({
          total: page.total,
          rows: page.items.map((item) => ({
            ...item,
            title: item.name,
            subtitle: `${item.destination.name} · ${labelize(item.category)}${item.rankInDestination ? ` · #${item.rankInDestination}` : ''}`
          }))
        }))
      );
    }

    if (this.entity === 'packages') {
      return this.admin.listPackages({ q, status }).pipe(
        map((page) => ({
          total: page.total,
          rows: page.items.map((item) => ({
            ...item,
            subtitle: `${item.durationNights}N/${item.durationDays}D · ${item.route || 'no route yet'}${item.fromPrice ? ` · from ₹${item.fromPrice.toLocaleString('en-IN')}` : ''}`
          }))
        }))
      );
    }

    return this.admin.listCollections({ q, status }).pipe(
      map((items) => ({
        total: items.length,
        rows: items.map((item) => ({ ...item, subtitle: `${item.itemCount} items${item.isFeatured ? ' · featured' : ''}` }))
      }))
    );
  }
}
