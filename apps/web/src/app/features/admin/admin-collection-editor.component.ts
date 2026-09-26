import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { CollectionDocument, DestinationRow, PlaceRow } from './admin.models';
import { ContentEditorBase, slugify, textOrNull } from './shared/content-editor.base';
import { EditorActionsComponent } from './shared/editor-actions.component';
import { HealthPanelComponent } from './shared/health-panel.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { MediaFieldsComponent, mediaGroup, mediaRefs } from './shared/media-fields.component';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@Component({
  selector: 'app-admin-collection-editor',
  standalone: true,
  imports: [
    EditorActionsComponent,
    HealthPanelComponent,
    LoadingStateComponent,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MediaFieldsComponent,
    ReactiveFormsModule
  ],
  template: `
    <main class="admin-page">
      <h1>{{ id() ? form.controls.title.value || 'Collection' : 'New collection' }}</h1>
      @if (isLoading()) {
        <app-loading-state label="Loading collection" />
      } @else {
        <div class="editor-layout">
          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="form-grid">
              <mat-form-field appearance="outline"><mat-label>Title</mat-label><input matInput formControlName="title" /></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>Slug</mat-label><input matInput formControlName="slug" /><mat-hint>/collections/{{ form.controls.slug.value }}</mat-hint></mat-form-field>
              <mat-form-field appearance="outline" class="wide"><mat-label>Intro</mat-label><textarea matInput formControlName="intro" rows="3"></textarea></mat-form-field>
              <mat-form-field appearance="outline" class="wide"><mat-label>Body</mat-label><textarea matInput formControlName="body" rows="6"></textarea><mat-hint>Optional longer text; blank line between paragraphs</mat-hint></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>SEO title</mat-label><input matInput formControlName="seoTitle" /></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>SEO description</mat-label><input matInput formControlName="seoDescription" /></mat-form-field>
              <mat-checkbox formControlName="isFeatured">Feature on the home page</mat-checkbox>
            </div>

            <h2>Items</h2>
            <div class="row-list">
              @for (group of itemsArray.controls; track group; let index = $index; let first = $first; let last = $last) {
                <div class="row" [formGroup]="group">
                  <mat-form-field appearance="outline">
                    <mat-label>Destination</mat-label>
                    <mat-select formControlName="destinationId" (selectionChange)="loadPlaces($event.value)">
                      @for (destination of destinations(); track destination.id) {
                        <mat-option [value]="destination.id">{{ destination.name }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Place (optional)</mat-label>
                    <mat-select formControlName="placeId">
                      <mat-option value="">The whole destination</mat-option>
                      @for (place of placesFor(group.value.destinationId); track place.id) {
                        <mat-option [value]="place.id">{{ place.name }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline"><mat-label>Why it is here</mat-label><input matInput formControlName="blurb" /></mat-form-field>
                  <span>
                    <button mat-button type="button" [disabled]="first" (click)="move(index, -1)" aria-label="Move up">↑</button>
                    <button mat-button type="button" [disabled]="last" (click)="move(index, 1)" aria-label="Move down">↓</button>
                    <button mat-button type="button" (click)="removeItem(index)">Remove</button>
                  </span>
                </div>
              }
              <button mat-stroked-button type="button" (click)="addItem()">Add item</button>
            </div>

            <h2>Cover image</h2>
            <app-media-fields [media]="form.controls.media" />

            <app-editor-actions
              [status]="status()"
              [isNew]="!id()"
              [busy]="busy()"
              [dirty]="form.dirty"
              [canPublish]="health()?.canPublish ?? false"
              [canDelete]="isAdmin"
              [publicPath]="publicPath()"
              [problems]="problems()"
              [conflict]="conflict()"
              (save)="save()"
              (statusChange)="setStatus($event)"
              (remove)="remove()"
              (reload)="reload()"
            />
          </form>
          @if (health(); as value) {
            <app-health-panel [health]="value" />
          }
        </div>
      }
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminCollectionEditorComponent extends ContentEditorBase<CollectionDocument> {
  protected readonly entity = 'collections' as const;
  protected readonly destinations = signal<DestinationRow[]>([]);
  private readonly places = signal<Record<string, PlaceRow[]>>({});

  protected readonly form = this.fb.group({
    title: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(5), Validators.maxLength(120)]),
    slug: this.fb.nonNullable.control('', [Validators.required, Validators.pattern(SLUG)]),
    intro: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(20), Validators.maxLength(600)]),
    body: this.fb.nonNullable.control('', Validators.maxLength(20000)),
    seoTitle: this.fb.nonNullable.control('', Validators.maxLength(70)),
    seoDescription: this.fb.nonNullable.control('', Validators.maxLength(170)),
    isFeatured: this.fb.nonNullable.control(false),
    items: this.fb.array<FormGroup>([]),
    media: this.fb.array<FormGroup>([])
  });

  private slugTouched = false;

  constructor() {
    super();
    this.admin
      .listDestinations({ pageSize: 100 })
      .pipe(takeUntilDestroyed())
      .subscribe((page) => this.destinations.set([...page.items].sort((a, b) => a.name.localeCompare(b.name))));
    this.form.controls.slug.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => (this.slugTouched = this.form.controls.slug.dirty));
    this.form.controls.title.valueChanges.pipe(takeUntilDestroyed()).subscribe((title) => {
      if (!this.id() && !this.slugTouched) this.form.controls.slug.setValue(slugify(title), { emitEvent: false });
    });
    this.init();
  }

  protected get itemsArray(): FormArray<FormGroup> {
    return this.form.controls.items;
  }

  protected placesFor(destinationId: string): PlaceRow[] {
    return this.places()[destinationId] ?? [];
  }

  protected loadPlaces(destinationId: string): void {
    if (!destinationId || this.places()[destinationId]) return;

    this.admin.listPlaces({ destinationId, pageSize: 100 }).subscribe((page) =>
      this.places.update((current) => ({ ...current, [destinationId]: page.items }))
    );
  }

  protected addItem(): void {
    this.itemsArray.push(this.itemGroup());
  }

  protected removeItem(index: number): void {
    this.itemsArray.removeAt(index);
    this.itemsArray.markAsDirty();
  }

  protected move(index: number, delta: number): void {
    const control = this.itemsArray.at(index);
    this.itemsArray.removeAt(index);
    this.itemsArray.insert(index + delta, control);
    this.itemsArray.markAsDirty();
  }

  protected publicPath(): string | null {
    return `/collections/${this.form.controls.slug.value}`;
  }

  protected toDocument(): CollectionDocument {
    const value = this.form.getRawValue();

    return {
      slug: value.slug,
      title: value.title,
      intro: value.intro,
      body: textOrNull(value.body),
      isFeatured: value.isFeatured,
      seoTitle: textOrNull(value.seoTitle),
      seoDescription: textOrNull(value.seoDescription),
      items: value.items
        .filter((item) => item['destinationId'])
        .map((item) =>
          item['placeId']
            ? { placeId: item['placeId'], blurb: textOrNull(item['blurb']) }
            : { destinationId: item['destinationId'], blurb: textOrNull(item['blurb']) }
        ),
      media: mediaRefs(value.media as Array<{ mediaId: string; isCover: boolean }>)
    };
  }

  protected applyDocument(doc: CollectionDocument): void {
    this.slugTouched = true;
    this.form.patchValue({
      title: doc.title,
      slug: doc.slug,
      intro: doc.intro,
      body: doc.body ?? '',
      seoTitle: doc.seoTitle ?? '',
      seoDescription: doc.seoDescription ?? '',
      isFeatured: doc.isFeatured ?? false
    });
    this.itemsArray.clear();

    for (const item of doc.items ?? []) {
      // Exported items carry slugs; resolve the destination id from the loaded list when needed.
      const destinationId =
        item.destinationId ?? this.destinations().find((destination) => destination.slug === item.destinationSlug)?.id ?? '';
      this.itemsArray.push(this.itemGroup({ destinationId, placeId: item.placeId ?? '', blurb: item.blurb ?? '' }));

      if (destinationId) this.loadPlaces(destinationId);
    }

    this.form.controls.media.clear();
    (doc.media ?? []).forEach((ref) => this.form.controls.media.push(mediaGroup(this.fb, ref)));
  }

  private itemGroup(item: { destinationId?: string; placeId?: string; blurb?: string } = {}): FormGroup {
    return this.fb.nonNullable.group({
      destinationId: [item.destinationId ?? '', Validators.required],
      placeId: [item.placeId ?? ''],
      blurb: [item.blurb ?? '', Validators.maxLength(300)]
    });
  }
}
