import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';

import { MediaItem, MediaRef } from '../admin.models';
import { MediaPickerDialogComponent } from './media-picker.dialog';

export function mediaGroup(fb: FormBuilder, ref: MediaRef): FormGroup {
  return fb.nonNullable.group({
    mediaId: [ref.mediaId ?? ''],
    url: [ref.url ?? ''],
    altText: [ref.altText ?? ''],
    isCover: [Boolean(ref.isCover)]
  });
}

/** Ordered image list with a single cover. The document keeps only mediaId + isCover. */
@Component({
  selector: 'app-media-fields',
  standalone: true,
  imports: [MatButtonModule, ReactiveFormsModule],
  template: `
    <div class="images">
      @for (group of media().controls; track group; let index = $index; let first = $first; let last = $last) {
        <figure>
          <img [src]="group.value.url" [alt]="group.value.altText" loading="lazy" />
          <figcaption>
            <label><input type="radio" name="cover" [checked]="group.value.isCover" (change)="setCover(index)" /> Cover</label>
            <span class="actions">
              <button mat-button type="button" [disabled]="first" (click)="move(index, -1)" aria-label="Move earlier">←</button>
              <button mat-button type="button" [disabled]="last" (click)="move(index, 1)" aria-label="Move later">→</button>
              <button mat-button type="button" (click)="remove(index)">Remove</button>
            </span>
          </figcaption>
        </figure>
      }
    </div>
    <button mat-stroked-button type="button" (click)="pick()">Add image from library</button>
  `,
  styles: `
    .images { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin-bottom: 10px; }
    figure { margin: 0; border: 1px solid var(--border); border-radius: 10px; overflow: hidden; background: var(--surface); }
    img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block; }
    figcaption { display: grid; gap: 4px; padding: 6px 8px; font-size: .85rem; }
    .actions { display: flex; flex-wrap: wrap; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MediaFieldsComponent {
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  readonly media = input.required<FormArray>();

  protected pick(): void {
    this.dialog
      .open<MediaPickerDialogComponent, void, MediaItem>(MediaPickerDialogComponent, { width: '860px' })
      .afterClosed()
      .subscribe((item) => {
        if (!item || this.media().value.some((ref: MediaRef) => ref.mediaId === item.id)) {
          return;
        }

        this.media().push(
          mediaGroup(this.fb, { mediaId: item.id, url: item.url, altText: item.altText, isCover: this.media().length === 0 })
        );
        this.media().markAsDirty();
      });
  }

  protected setCover(index: number): void {
    this.media().controls.forEach((control, position) => control.patchValue({ isCover: position === index }));
    this.media().markAsDirty();
  }

  protected move(index: number, delta: number): void {
    const control = this.media().at(index);
    this.media().removeAt(index);
    this.media().insert(index + delta, control);
    this.media().markAsDirty();
  }

  protected remove(index: number): void {
    const wasCover = this.media().at(index).value.isCover;
    this.media().removeAt(index);

    if (wasCover && this.media().length) {
      this.media().at(0).patchValue({ isCover: true });
    }

    this.media().markAsDirty();
  }
}

/** Converts the media FormArray value back to document refs. */
export function mediaRefs(value: Array<{ mediaId: string; isCover: boolean }>): MediaRef[] {
  return value.filter((ref) => ref.mediaId).map((ref) => ({ mediaId: ref.mediaId, isCover: ref.isCover }));
}
