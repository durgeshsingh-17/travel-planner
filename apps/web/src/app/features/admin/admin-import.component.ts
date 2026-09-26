import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { AdminApiService } from './admin-api.service';
import { ImportReport } from './admin.models';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-admin-import',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, ReactiveFormsModule],
  template: `
    <main class="admin-page">
      <h1>Import content</h1>
      <p class="muted">
        Paste a JSON bundle (tags, destinations, places, collections) or CSV for locations or places.
        Always preview first: nothing is written until you apply, and if any row fails, nothing is written at all.
        Rows update existing content by slug; fields you leave out keep their current value.
      </p>

      <form class="admin-card form-grid" [formGroup]="form">
        <mat-form-field appearance="outline">
          <mat-label>Format</mat-label>
          <mat-select formControlName="format" (selectionChange)="report.set(null)">
            <mat-option value="json">JSON bundle</mat-option>
            <mat-option value="locations">CSV: locations</mat-option>
            <mat-option value="places">CSV: places</mat-option>
          </mat-select>
        </mat-form-field>
        <div>
          <input type="file" accept=".json,.csv,application/json,text/csv" (change)="loadFile($event)" aria-label="Import file" />
        </div>
        <mat-form-field appearance="outline" class="wide">
          <mat-label>{{ form.controls.format.value === 'json' ? 'JSON' : 'CSV' }}</mat-label>
          <textarea matInput formControlName="text" rows="14" spellcheck="false" (input)="report.set(null)"></textarea>
          <mat-hint>{{ hint() }}</mat-hint>
        </mat-form-field>
        <div class="wide actions">
          <button mat-stroked-button type="button" [disabled]="busy()" (click)="run(true)">Preview changes</button>
          <button mat-flat-button color="primary" type="button" [disabled]="busy() || !canApply()" (click)="run(false)">Apply import</button>
        </div>
      </form>

      @if (report(); as result) {
        <section class="admin-card">
          <h2>{{ result.applied ? 'Imported' : result.dryRun ? 'Preview' : 'Not applied: fix the errors below' }}</h2>
          <p>
            @for (entry of summary(); track entry.entity) {
              <span class="summary">{{ entry.entity }}: +{{ entry.create }} new · {{ entry.update }} updated · {{ entry.unchanged }} unchanged @if (entry.error) { · <strong class="error">{{ entry.error }} errors</strong> }</span>
            }
          </p>
          <table class="admin-table">
            <tr><th>Type</th><th>Key</th><th>Result</th><th>Details</th></tr>
            @for (row of result.rows; track $index) {
              <tr>
                <td>{{ row.entity }}</td>
                <td>{{ row.key }}</td>
                <td [class.error]="row.action === 'error'">{{ row.action }}{{ row.published ? ' + published' : '' }}</td>
                <td class="muted">{{ row.errors?.join('; ') || row.changes?.join(', ') }}</td>
              </tr>
            }
          </table>
        </section>
      }
    </main>
  `,
  styles: `
    textarea { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .85rem; }
    .actions { display: flex; gap: 10px; }
    .summary { display: inline-block; margin-right: 16px; }
    .error { color: var(--danger); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminImportComponent {
  private readonly admin = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    format: ['json' as 'json' | 'locations' | 'places'],
    text: ['']
  });
  protected readonly busy = signal(false);
  protected readonly report = signal<ImportReport | null>(null);
  private readonly format = signal<'json' | 'locations' | 'places'>('json');

  protected readonly canApply = computed(() => {
    const report = this.report();
    return Boolean(report?.dryRun && !report.rows.some((row) => row.action === 'error'));
  });
  protected readonly summary = computed(() =>
    Object.entries(this.report()?.summary ?? {})
      .map(([entity, counts]) => ({ entity, ...counts }))
      .filter((entry) => entry.create + entry.update + entry.unchanged + entry.error > 0)
  );
  protected readonly hint = computed(() =>
    this.format() === 'locations'
      ? 'Columns: slug,name,state,latitude,longitude[,aliases (a|b),popularity,isActive]'
      : this.format() === 'places'
        ? 'Columns: destinationSlug,slug,name,category,description,latitude,longitude[,rankInDestination,tags (a|b),tips (a|b),status,…]'
        : 'See apps/api/prisma/content/starter-content.json for the shape.'
  );

  constructor() {
    this.form.controls.format.valueChanges.subscribe((format) => this.format.set(format));
  }

  protected loadFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];

    if (!file) return;

    file.text().then((text) => {
      this.form.patchValue({ text, format: file.name.endsWith('.json') ? 'json' : this.form.controls.format.value });
      this.report.set(null);
    });
  }

  protected run(dryRun: boolean): void {
    const { format, text } = this.form.getRawValue();
    let request;

    if (format === 'json') {
      try {
        request = this.admin.importBundle(JSON.parse(text), dryRun);
      } catch {
        this.toast.error('That is not valid JSON.');
        return;
      }
    } else {
      request = this.admin.importCsv(format, text, dryRun);
    }

    this.busy.set(true);
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (report) => {
        this.report.set(report);
        if (report.applied) this.toast.success('Import applied');
      },
      error: (error: Error) => this.toast.error(error.message)
    });
  }
}
