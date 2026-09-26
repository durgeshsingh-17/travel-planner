import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';

import { ContentEditorBase, numberOrNull, slugify, textOrNull } from './shared/content-editor.base';
import { DestinationRow, PLACE_CATEGORIES, PlaceDocument, TagRow } from './admin.models';
import { EditorActionsComponent } from './shared/editor-actions.component';
import { FaqFieldsComponent, faqGroup } from './shared/faq-fields.component';
import { HealthPanelComponent } from './shared/health-panel.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { MediaFieldsComponent, mediaGroup, mediaRefs } from './shared/media-fields.component';
import { WEEKDAY_NAMES, labelize } from '../../shared/utils/content-format.util';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
type DayState = '' | 'OPEN' | 'CLOSED';

@Component({
  selector: 'app-admin-place-editor',
  standalone: true,
  imports: [
    EditorActionsComponent,
    FaqFieldsComponent,
    HealthPanelComponent,
    LoadingStateComponent,
    MatButtonModule,
    MatCheckboxModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTabsModule,
    MediaFieldsComponent,
    ReactiveFormsModule
  ],
  template: `
    <main class="admin-page">
      <h1>{{ id() ? form.controls.basics.controls.name.value || 'Place' : 'New place' }}</h1>
      @if (isLoading()) {
        <app-loading-state label="Loading place" />
      } @else {
        <div class="editor-layout">
          <form [formGroup]="form" (ngSubmit)="save()">
            <mat-tab-group mat-stretch-tabs="false" animationDuration="0ms">
              <mat-tab label="Basics">
                <div class="form-grid tab" formGroupName="basics">
                  <mat-form-field appearance="outline">
                    <mat-label>Destination</mat-label>
                    <mat-select formControlName="destinationId">
                      @for (destination of destinations(); track destination.id) {
                        <mat-option [value]="destination.id">{{ destination.name }} ({{ destination.status.toLowerCase() }})</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline"><mat-label>Name</mat-label><input matInput formControlName="name" /></mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Slug</mat-label><input matInput formControlName="slug" />
                    <mat-error>Lowercase letters, numbers and single hyphens</mat-error>
                  </mat-form-field>
                  <mat-form-field appearance="outline">
                    <mat-label>Category</mat-label>
                    <mat-select formControlName="category">
                      @for (category of categories; track category) {
                        <mat-option [value]="category">{{ labelize(category) }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>
                  <mat-form-field appearance="outline"><mat-label>Latitude</mat-label><input matInput type="number" step="0.0001" formControlName="latitude" /></mat-form-field>
                  <mat-form-field appearance="outline"><mat-label>Longitude</mat-label><input matInput type="number" step="0.0001" formControlName="longitude" /></mat-form-field>
                  <mat-form-field appearance="outline"><mat-label>Rank in destination</mat-label><input matInput type="number" formControlName="rankInDestination" /><mat-hint>1 = top pick</mat-hint></mat-form-field>
                  <mat-form-field appearance="outline"><mat-label>Rating (0–5)</mat-label><input matInput type="number" step="0.1" formControlName="rating" /></mat-form-field>
                  <mat-form-field appearance="outline" class="wide">
                    <mat-label>Description</mat-label><textarea matInput formControlName="description" rows="2"></textarea>
                    <mat-hint align="end">{{ form.controls.basics.controls.description.value.length }}/1000 · shown on cards</mat-hint>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="wide">
                    <mat-label>Overview</mat-label><textarea matInput formControlName="overview" rows="8"></textarea>
                    <mat-hint>Plain text, blank line between paragraphs. Aim for 80+ words.</mat-hint>
                  </mat-form-field>
                  <mat-form-field appearance="outline" class="wide"><mat-label>Address</mat-label><input matInput formControlName="address" /></mat-form-field>
                  <mat-form-field appearance="outline" class="wide">
                    <mat-label>Tips (one per line)</mat-label><textarea matInput formControlName="tips" rows="4"></textarea>
                  </mat-form-field>
                </div>
              </mat-tab>

              <mat-tab label="Visiting">
                <div class="form-grid tab" formGroupName="visiting">
                  <mat-form-field appearance="outline"><mat-label>Time needed from (min)</mat-label><input matInput type="number" formControlName="timeRequiredMinMinutes" /></mat-form-field>
                  <mat-form-field appearance="outline"><mat-label>Time needed to (min)</mat-label><input matInput type="number" formControlName="timeRequiredMaxMinutes" /></mat-form-field>
                  <mat-form-field appearance="outline"><mat-label>Best time of day</mat-label><input matInput formControlName="bestTimeOfDay" /></mat-form-field>
                  <mat-form-field appearance="outline"><mat-label>Planner cost per person (₹)</mat-label><input matInput type="number" formControlName="estimatedCost" /><mat-hint>Used in trip cost estimates</mat-hint></mat-form-field>
                  <mat-checkbox class="wide" formControlName="isFree">Free entry</mat-checkbox>
                  @if (!form.controls.visiting.controls.isFree.value) {
                    <mat-form-field appearance="outline"><mat-label>Entry: Indian adult (₹)</mat-label><input matInput type="number" formControlName="entryFeeIndian" /></mat-form-field>
                    <mat-form-field appearance="outline"><mat-label>Entry: child (₹)</mat-label><input matInput type="number" formControlName="entryFeeChild" /></mat-form-field>
                    <mat-form-field appearance="outline"><mat-label>Entry: foreign visitor (₹)</mat-label><input matInput type="number" formControlName="entryFeeForeigner" /></mat-form-field>
                  }
                  <mat-form-field appearance="outline" class="wide"><mat-label>Fee notes</mat-label><input matInput formControlName="feeNotes" /><mat-hint>Camera fees, seasonal changes, parking…</mat-hint></mat-form-field>
                </div>
                <h3>Opening hours</h3>
                <p class="muted">Leave a day unset if you do not know its hours.</p>
                <table class="admin-table months">
                  <tr><th>Day</th><th>Status</th><th>Opens</th><th>Closes</th></tr>
                  @for (group of timingsArray.controls; track $index; let index = $index) {
                    <tr [formGroup]="group">
                      <td>{{ weekdays[index] }}</td>
                      <td>
                        <select formControlName="state" [attr.aria-label]="weekdays[index] + ' status'">
                          <option value="">Unknown</option>
                          <option value="OPEN">Open</option>
                          <option value="CLOSED">Closed</option>
                        </select>
                      </td>
                      <td><input type="time" formControlName="opensAt" [attr.aria-label]="weekdays[index] + ' opens'" /></td>
                      <td><input type="time" formControlName="closesAt" [attr.aria-label]="weekdays[index] + ' closes'" /></td>
                    </tr>
                  }
                </table>
                <button mat-button type="button" (click)="copyMondayToAll()">Copy Monday to every day</button>
              </mat-tab>

              <mat-tab label="FAQs"><div class="tab"><app-faq-fields [faqs]="form.controls.faqs" /></div></mat-tab>

              <mat-tab label="Tags">
                <div class="tab">
                  <mat-chip-listbox multiple formControlName="tags" aria-label="Tags">
                    @for (tag of tagOptions(); track tag.id) {
                      <mat-chip-option [value]="tag.slug">{{ tag.name }}</mat-chip-option>
                    }
                  </mat-chip-listbox>
                </div>
              </mat-tab>

              <mat-tab label="Images"><div class="tab"><app-media-fields [media]="form.controls.media" /></div></mat-tab>

              <mat-tab label="SEO">
                <div class="form-grid tab" formGroupName="seo">
                  <mat-form-field appearance="outline" class="wide"><mat-label>SEO title</mat-label><input matInput formControlName="seoTitle" /><mat-hint align="end">{{ form.controls.seo.controls.seoTitle.value.length }}/70</mat-hint></mat-form-field>
                  <mat-form-field appearance="outline" class="wide"><mat-label>SEO description</mat-label><textarea matInput formControlName="seoDescription" rows="3"></textarea><mat-hint align="end">{{ form.controls.seo.controls.seoDescription.value.length }}/170</mat-hint></mat-form-field>
                </div>
              </mat-tab>
            </mat-tab-group>

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
export class AdminPlaceEditorComponent extends ContentEditorBase<PlaceDocument> {
  protected readonly entity = 'places' as const;
  protected readonly categories = PLACE_CATEGORIES;
  protected readonly weekdays = WEEKDAY_NAMES;
  protected readonly labelize = labelize;
  protected readonly destinations = signal<DestinationRow[]>([]);
  protected readonly tagOptions = signal<TagRow[]>([]);

  protected readonly form = this.fb.group({
    basics: this.fb.nonNullable.group({
      destinationId: ['', Validators.required],
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
      slug: ['', [Validators.required, Validators.pattern(SLUG)]],
      category: ['ATTRACTION', Validators.required],
      latitude: this.fb.control<number | null>(null, [Validators.required, Validators.min(-90), Validators.max(90)]),
      longitude: this.fb.control<number | null>(null, [Validators.required, Validators.min(-180), Validators.max(180)]),
      rankInDestination: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(999)]),
      rating: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(5)]),
      description: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(1000)]],
      overview: ['', Validators.maxLength(20000)],
      address: ['', Validators.maxLength(300)],
      tips: ['']
    }),
    visiting: this.fb.nonNullable.group({
      timeRequiredMinMinutes: this.fb.control<number | null>(null, [Validators.min(5), Validators.max(1440)]),
      timeRequiredMaxMinutes: this.fb.control<number | null>(null, [Validators.min(5), Validators.max(1440)]),
      bestTimeOfDay: ['', Validators.maxLength(100)],
      estimatedCost: this.fb.control<number | null>(null, Validators.min(0)),
      isFree: [false],
      entryFeeIndian: this.fb.control<number | null>(null, Validators.min(0)),
      entryFeeChild: this.fb.control<number | null>(null, Validators.min(0)),
      entryFeeForeigner: this.fb.control<number | null>(null, Validators.min(0)),
      feeNotes: ['', Validators.maxLength(300)]
    }),
    seo: this.fb.nonNullable.group({
      seoTitle: ['', Validators.maxLength(70)],
      seoDescription: ['', Validators.maxLength(170)]
    }),
    tags: this.fb.nonNullable.control<string[]>([]),
    timings: this.fb.array(WEEKDAY_NAMES.map((_, day) => this.timingGroup(day))),
    faqs: this.fb.array<FormGroup>([]),
    media: this.fb.array<FormGroup>([])
  });

  private destinationSlug = '';
  private slugTouched = false;

  constructor() {
    super();
    this.admin.tags().pipe(takeUntilDestroyed()).subscribe((tags) => this.tagOptions.set(tags));
    this.admin
      .listDestinations({ pageSize: 100 })
      .pipe(takeUntilDestroyed())
      .subscribe((page) => this.destinations.set([...page.items].sort((a, b) => a.name.localeCompare(b.name))));
    const basics = this.form.controls.basics.controls;
    basics.slug.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => (this.slugTouched = basics.slug.dirty));
    basics.name.valueChanges.pipe(takeUntilDestroyed()).subscribe((name) => {
      if (!this.id() && !this.slugTouched) basics.slug.setValue(slugify(name), { emitEvent: false });
    });
    const presetDestination = this.route.snapshot.queryParamMap.get('destinationId');
    if (presetDestination) basics.destinationId.setValue(presetDestination);
    this.init();
  }

  protected get timingsArray(): FormArray<FormGroup> {
    return this.form.controls.timings as FormArray<FormGroup>;
  }

  protected copyMondayToAll(): void {
    const monday = this.timingsArray.at(1).value;
    this.timingsArray.controls.forEach((group) => group.patchValue({ state: monday.state, opensAt: monday.opensAt, closesAt: monday.closesAt }));
    this.timingsArray.markAsDirty();
  }

  protected publicPath(): string | null {
    const slug = this.destinationSlug || this.destinations().find((d) => d.id === this.form.controls.basics.controls.destinationId.value)?.slug;
    return slug ? `/destinations/${slug}/places/${this.form.controls.basics.controls.slug.value}` : null;
  }

  protected toDocument(): PlaceDocument {
    const { basics, visiting, seo, tags, timings, faqs, media } = this.form.getRawValue();

    return {
      destinationId: basics.destinationId,
      slug: basics.slug,
      name: basics.name,
      category: basics.category,
      latitude: Number(basics.latitude),
      longitude: Number(basics.longitude),
      rankInDestination: numberOrNull(basics.rankInDestination),
      rating: numberOrNull(basics.rating),
      description: basics.description,
      overview: textOrNull(basics.overview),
      address: textOrNull(basics.address),
      tips: basics.tips.split('\n').map((tip) => tip.trim()).filter(Boolean),
      timeRequiredMinMinutes: numberOrNull(visiting.timeRequiredMinMinutes),
      timeRequiredMaxMinutes: numberOrNull(visiting.timeRequiredMaxMinutes),
      bestTimeOfDay: textOrNull(visiting.bestTimeOfDay),
      estimatedCost: numberOrNull(visiting.estimatedCost),
      isFree: visiting.isFree,
      entryFeeIndian: visiting.isFree ? null : numberOrNull(visiting.entryFeeIndian),
      entryFeeChild: visiting.isFree ? null : numberOrNull(visiting.entryFeeChild),
      entryFeeForeigner: visiting.isFree ? null : numberOrNull(visiting.entryFeeForeigner),
      feeNotes: textOrNull(visiting.feeNotes),
      seoTitle: textOrNull(seo.seoTitle),
      seoDescription: textOrNull(seo.seoDescription),
      tags,
      timings: (timings as Array<{ state: DayState; opensAt: string; closesAt: string }>)
        .map((timing, dayOfWeek) => ({ ...timing, dayOfWeek }))
        .filter((timing) => (timing.state === 'OPEN' ? timing.opensAt && timing.closesAt : timing.state === 'CLOSED'))
        .map((timing) =>
          timing.state === 'CLOSED'
            ? { dayOfWeek: timing.dayOfWeek, isClosed: true }
            : { dayOfWeek: timing.dayOfWeek, isClosed: false, opensAt: timing.opensAt, closesAt: timing.closesAt }
        ),
      faqs: faqs.map((faq) => ({ question: faq['question'], answer: faq['answer'] })),
      media: mediaRefs(media as Array<{ mediaId: string; isCover: boolean }>)
    };
  }

  protected applyDocument(doc: PlaceDocument): void {
    this.slugTouched = true;
    this.destinationSlug = doc.destinationSlug ?? '';
    this.form.patchValue({
      basics: {
        destinationId: doc.destinationId ?? '',
        name: doc.name,
        slug: doc.slug,
        category: doc.category,
        latitude: doc.latitude,
        longitude: doc.longitude,
        rankInDestination: doc.rankInDestination ?? null,
        rating: doc.rating ?? null,
        description: doc.description,
        overview: doc.overview ?? '',
        address: doc.address ?? '',
        tips: (doc.tips ?? []).join('\n')
      },
      visiting: {
        timeRequiredMinMinutes: doc.timeRequiredMinMinutes ?? doc.averageVisitMinutes ?? null,
        timeRequiredMaxMinutes: doc.timeRequiredMaxMinutes ?? null,
        bestTimeOfDay: doc.bestTimeOfDay ?? '',
        estimatedCost: doc.estimatedCost ?? null,
        isFree: doc.isFree ?? false,
        entryFeeIndian: doc.entryFeeIndian ?? null,
        entryFeeChild: doc.entryFeeChild ?? null,
        entryFeeForeigner: doc.entryFeeForeigner ?? null,
        feeNotes: doc.feeNotes ?? ''
      },
      seo: { seoTitle: doc.seoTitle ?? '', seoDescription: doc.seoDescription ?? '' },
      tags: doc.tags ?? []
    });
    const timings = new Map((doc.timings ?? []).map((timing) => [timing.dayOfWeek, timing]));
    this.timingsArray.controls.forEach((group, day) => {
      const timing = timings.get(day);
      group.reset({
        state: (timing ? (timing.isClosed ? 'CLOSED' : 'OPEN') : '') as DayState,
        opensAt: timing?.opensAt ?? '',
        closesAt: timing?.closesAt ?? ''
      });
    });
    this.form.controls.faqs.clear();
    (doc.faqs ?? []).forEach((faq) => this.form.controls.faqs.push(faqGroup(this.fb, faq)));
    this.form.controls.media.clear();
    (doc.media ?? []).forEach((ref) => this.form.controls.media.push(mediaGroup(this.fb, ref)));
  }

  private timingGroup(_day: number): FormGroup {
    return this.fb.nonNullable.group({ state: ['' as DayState], opensAt: [''], closesAt: [''] });
  }
}
