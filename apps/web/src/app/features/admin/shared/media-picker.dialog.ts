import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { debounceTime, distinctUntilChanged, startWith, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AdminApiService } from '../admin-api.service';
import { MediaItem } from '../admin.models';

/** Pick an image from the media library. Upload new images on the Media screen. */
@Component({
  selector: 'app-media-picker',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  template: `
    <h2 mat-dialog-title>Choose an image</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" class="search">
        <mat-label>Search by alt text or credit</mat-label>
        <input matInput [formControl]="query" />
      </mat-form-field>
      <div class="grid">
        @for (item of items(); track item.id) {
          <button type="button" class="tile" (click)="dialog.close(item)">
            <img [src]="item.url" [alt]="item.altText" loading="lazy" />
            <span>{{ item.altText }}</span>
          </button>
        } @empty {
          <p class="muted">No images yet. Add some on the Media screen.</p>
        }
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" mat-dialog-close>Cancel</button>
    </mat-dialog-actions>
  `,
  styles: `
    .search { width: 100%; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 10px; }
    .tile { display: grid; gap: 4px; padding: 0; border: 1px solid var(--border); border-radius: 10px; background: var(--surface); color: var(--text); cursor: pointer; overflow: hidden; text-align: left; }
    .tile:hover, .tile:focus-visible { border-color: var(--primary); }
    img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; }
    span { padding: 0 8px 8px; font-size: .8rem; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MediaPickerDialogComponent {
  private readonly admin = inject(AdminApiService);
  protected readonly dialog = inject(MatDialogRef<MediaPickerDialogComponent, MediaItem>);
  protected readonly query = new FormControl('', { nonNullable: true });
  protected readonly items = signal<MediaItem[]>([]);

  constructor() {
    this.query.valueChanges
      .pipe(
        startWith(''),
        debounceTime(200),
        distinctUntilChanged(),
        switchMap((q) => this.admin.media({ q })),
        takeUntilDestroyed()
      )
      .subscribe((page) => this.items.set(page.items));
  }
}
