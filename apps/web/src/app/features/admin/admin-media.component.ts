import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, finalize, startWith } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { AdminApiService } from './admin-api.service';
import { MEDIA_LICENSES, MediaItem } from './admin.models';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-admin-media',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, ReactiveFormsModule],
  template: `
    <main class="admin-page">
      <h1>Media library</h1>
      <p class="muted">Every image needs alt text and a licence. Only use photos you own or are licensed to publish.</p>

      <form class="admin-card form-grid" [formGroup]="form" (ngSubmit)="add()">
        <h2 class="wide">Add an image</h2>
        <div class="wide source">
          <label><input type="radio" formControlName="source" value="upload" /> Upload a file</label>
          <label><input type="radio" formControlName="source" value="url" /> Register an external https URL</label>
        </div>
        @if (form.controls.source.value === 'upload') {
          <div class="wide">
            <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" (change)="pickFile($event)" aria-label="Image file" />
            <p class="muted small">JPEG, PNG, WebP or AVIF, up to 10 MB.</p>
          </div>
        } @else {
          <mat-form-field appearance="outline" class="wide"><mat-label>Image URL</mat-label><input matInput formControlName="url" placeholder="https://…" /></mat-form-field>
        }
        <mat-form-field appearance="outline" class="wide"><mat-label>Alt text</mat-label><input matInput formControlName="altText" /><mat-hint>Describe the image for people who cannot see it</mat-hint></mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Licence</mat-label>
          <mat-select formControlName="license">
            @for (license of licenses; track license) { <mat-option [value]="license">{{ license }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline"><mat-label>Credit</mat-label><input matInput formControlName="credit" /><mat-hint>Required for CC-BY licences</mat-hint></mat-form-field>
        <div class="wide"><button mat-flat-button color="primary" type="submit" [disabled]="busy()">Add image</button></div>
      </form>

      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>Search</mat-label>
        <input matInput [formControl]="search" />
      </mat-form-field>

      <div class="grid">
        @for (item of items(); track item.id) {
          <article class="admin-card tile">
            <img [src]="item.url" [alt]="item.altText" loading="lazy" />
            @if (editing() === item.id) {
              <input [value]="item.altText" #alt aria-label="Alt text" />
              <input [value]="item.credit ?? ''" #credit aria-label="Credit" placeholder="Credit" />
              <select #license aria-label="Licence">
                @for (license of licenses; track license) { <option [value]="license" [selected]="license === item.license">{{ license }}</option> }
              </select>
              <span>
                <button mat-button type="button" (click)="saveMeta(item, alt.value, credit.value, license.value)">Save</button>
                <button mat-button type="button" (click)="editing.set(null)">Cancel</button>
              </span>
            } @else {
              <strong>{{ item.altText }}</strong>
              <span class="muted small">
                {{ item.license }}{{ item.credit ? ' · ' + item.credit : '' }}
                @if (item.width) { · {{ item.width }}×{{ item.height }} }
                · used {{ item.usageCount ?? 0 }}×
              </span>
              <span>
                <button mat-button type="button" (click)="editing.set(item.id)">Edit</button>
                <button mat-button type="button" [disabled]="(item.usageCount ?? 0) > 0" (click)="remove(item)">Delete</button>
              </span>
            }
          </article>
        } @empty {
          <p class="muted">No images yet.</p>
        }
      </div>
    </main>
  `,
  styles: `
    .source { display: flex; gap: 18px; }
    .small { font-size: .8rem; margin: 0; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
    .tile { gap: 6px; padding: 10px; }
    .tile img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 8px; }
    .tile input, .tile select { padding: 6px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminMediaComponent {
  private readonly admin = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  protected readonly licenses = MEDIA_LICENSES;
  protected readonly items = signal<MediaItem[]>([]);
  protected readonly busy = signal(false);
  protected readonly editing = signal<string | null>(null);
  protected readonly search = new FormControl('', { nonNullable: true });
  private file: File | null = null;

  protected readonly form = this.fb.nonNullable.group({
    source: ['upload' as 'upload' | 'url'],
    url: ['', Validators.pattern(/^(https:\/\/.+)?$/)],
    altText: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(250)]],
    license: ['OWNED', Validators.required],
    credit: ['']
  });

  constructor() {
    this.search.valueChanges
      .pipe(startWith(''), debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => this.load(q));
  }

  protected pickFile(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0] ?? null;
  }

  protected add(): void {
    this.form.markAllAsTouched();
    const value = this.form.getRawValue();

    if (this.form.invalid || (value.source === 'upload' ? !this.file : !value.url)) {
      this.toast.error(value.source === 'upload' ? 'Choose a file and add alt text.' : 'Add an https URL and alt text.');
      return;
    }

    const metadata = { altText: value.altText, license: value.license, credit: value.credit || undefined };
    const request =
      value.source === 'upload' && this.file
        ? this.admin.uploadMedia(this.file, metadata)
        : this.admin.registerMedia({ ...metadata, url: value.url });

    this.busy.set(true);
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        this.toast.success('Image added');
        this.form.reset({ source: value.source, url: '', altText: '', license: 'OWNED', credit: '' });
        this.file = null;
        this.load(this.search.value);
      },
      error: (error: Error) => this.toast.error(error.message)
    });
  }

  protected saveMeta(item: MediaItem, altText: string, credit: string, license: string): void {
    this.admin.updateMedia(item.id, { altText, license, credit: credit || null }).subscribe({
      next: () => {
        this.editing.set(null);
        this.load(this.search.value);
      },
      error: (error: Error) => this.toast.error(error.message)
    });
  }

  protected remove(item: MediaItem): void {
    if (!confirm('Delete this image permanently?')) return;
    this.admin.remove('media', item.id).subscribe({
      next: () => this.load(this.search.value),
      error: (error: Error) => this.toast.error(error.message)
    });
  }

  private load(q: string): void {
    this.admin.media({ q }).subscribe((page) => this.items.set(page.items));
  }
}
