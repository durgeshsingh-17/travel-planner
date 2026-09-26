import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { AdminApiService } from './admin-api.service';
import { SessionService } from '../../core/auth/session.service';
import { TagRow } from './admin.models';
import { ToastService } from '../../shared/services/toast.service';
import { labelize } from '../../shared/utils/content-format.util';
import { slugify } from './shared/content-editor.base';

@Component({
  selector: 'app-admin-tags',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, ReactiveFormsModule],
  template: `
    <main class="admin-page">
      <h1>Tags</h1>
      <form class="admin-card form-grid" [formGroup]="form" (ngSubmit)="save()">
        <mat-form-field appearance="outline"><mat-label>Name</mat-label><input matInput formControlName="name" (input)="suggestSlug()" /></mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Slug</mat-label><input matInput formControlName="slug" /></mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Kind</mat-label>
          <mat-select formControlName="kind">
            @for (kind of kinds; track kind) { <mat-option [value]="kind">{{ labelize(kind) }}</mat-option> }
          </mat-select>
          <mat-hint>Themes appear as filters on Explore</mat-hint>
        </mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Description</mat-label><input matInput formControlName="description" /></mat-form-field>
        <div class="wide">
          <button mat-flat-button color="primary" type="submit">{{ editingId() ? 'Save tag' : 'Add tag' }}</button>
          @if (editingId()) { <button mat-button type="button" (click)="reset()">Cancel</button> }
        </div>
      </form>
      <table class="admin-table">
        <tr><th>Name</th><th>Slug</th><th>Kind</th><th>Used by</th><th></th></tr>
        @for (tag of tags(); track tag.id) {
          <tr>
            <td>{{ tag.name }}</td>
            <td class="muted">{{ tag.slug }}</td>
            <td>{{ labelize(tag.kind) }}</td>
            <td>{{ tag.destinationCount }} destinations · {{ tag.placeCount }} places</td>
            <td>
              <button mat-button type="button" (click)="edit(tag)">Edit</button>
              @if (isAdmin) { <button mat-button type="button" (click)="remove(tag)">Delete</button> }
            </td>
          </tr>
        }
      </table>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminTagsComponent {
  private readonly admin = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  protected readonly isAdmin = inject(SessionService).session().user?.role === 'ADMIN';
  protected readonly kinds = ['THEME', 'ACTIVITY', 'AUDIENCE', 'SEASON'] as const;
  protected readonly labelize = labelize;
  protected readonly tags = signal<TagRow[]>([]);
  protected readonly editingId = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(40)]],
    slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
    kind: ['THEME' as TagRow['kind']],
    description: ['']
  });

  constructor() {
    this.load();
  }

  protected suggestSlug(): void {
    if (!this.editingId() && !this.form.controls.slug.dirty) {
      this.form.controls.slug.setValue(slugify(this.form.controls.name.value));
    }
  }

  protected edit(tag: TagRow): void {
    this.editingId.set(tag.id);
    this.form.reset({ name: tag.name, slug: tag.slug, kind: tag.kind, description: tag.description ?? '' });
  }

  protected reset(): void {
    this.editingId.set(null);
    this.form.reset({ name: '', slug: '', kind: 'THEME', description: '' });
  }

  protected save(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.admin.saveTag({ ...value, description: value.description || null }, this.editingId() ?? undefined).subscribe({
      next: () => {
        this.toast.success('Tag saved');
        this.reset();
        this.load();
      },
      error: (error: Error) => this.toast.error(error.message)
    });
  }

  protected remove(tag: TagRow): void {
    if (!confirm(`Delete "${tag.name}"? It will be removed from ${tag.destinationCount + tag.placeCount} items.`)) return;
    this.admin.remove('tags', tag.id).subscribe({ next: () => this.load(), error: (error: Error) => this.toast.error(error.message) });
  }

  private load(): void {
    this.admin.tags().subscribe((tags) => this.tags.set(tags));
  }
}
