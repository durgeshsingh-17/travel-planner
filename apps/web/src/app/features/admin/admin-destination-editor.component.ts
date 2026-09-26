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
import { DestinationDocument, TagRow } from './admin.models';
import { EditorActionsComponent } from './shared/editor-actions.component';
import { FaqFieldsComponent, faqGroup } from './shared/faq-fields.component';
import { HealthPanelComponent } from './shared/health-panel.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { MONTH_NAMES } from '../../shared/utils/content-format.util';
import { MediaFieldsComponent, mediaGroup, mediaRefs } from './shared/media-fields.component';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

@Component({
  selector: 'app-admin-destination-editor',
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
  templateUrl: './admin-destination-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminDestinationEditorComponent extends ContentEditorBase<DestinationDocument> {
  protected readonly entity = 'destinations' as const;
  protected readonly monthNames = MONTH_NAMES;
  protected readonly tagOptions = signal<TagRow[]>([]);

  protected readonly form = this.fb.group({
    basics: this.fb.nonNullable.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(80)]],
      slug: ['', [Validators.required, Validators.pattern(SLUG), Validators.maxLength(80)]],
      state: ['', [Validators.required, Validators.minLength(2)]],
      country: ['India'],
      latitude: this.fb.control<number | null>(null, [Validators.required, Validators.min(-90), Validators.max(90)]),
      longitude: this.fb.control<number | null>(null, [Validators.required, Validators.min(-180), Validators.max(180)]),
      tagline: ['', Validators.maxLength(120)],
      shortDescription: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(300)]],
      overview: ['', Validators.maxLength(20000)],
      isFeatured: [false],
      popularityScore: [0, [Validators.min(0)]],
      heroImageUrl: ['', Validators.pattern(/^(https:\/\/.+)?$/)],
      bestTimeToVisit: ['', Validators.maxLength(120)]
    }),
    facts: this.fb.group({
      rating: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(5)]),
      idealDaysMin: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(60)]),
      idealDaysMax: this.fb.control<number | null>(null, [Validators.min(1), Validators.max(60)]),
      budgetPerDayMin: this.fb.control<number | null>(null, [Validators.min(0)]),
      budgetPerDayMax: this.fb.control<number | null>(null, [Validators.min(0)]),
      altitudeM: this.fb.control<number | null>(null),
      nearestAirport: this.fb.control<string>(''),
      nearestAirportKm: this.fb.control<number | null>(null, [Validators.min(0)]),
      nearestRailway: this.fb.control<string>(''),
      nearestRailwayKm: this.fb.control<number | null>(null, [Validators.min(0)])
    }),
    seo: this.fb.nonNullable.group({
      seoTitle: ['', Validators.maxLength(70)],
      seoDescription: ['', Validators.maxLength(170)]
    }),
    tags: this.fb.nonNullable.control<string[]>([]),
    months: this.fb.array(MONTH_NAMES.map((_, index) => this.monthGroup(index + 1))),
    howToReach: this.fb.array<FormGroup>([]),
    faqs: this.fb.array<FormGroup>([]),
    media: this.fb.array<FormGroup>([])
  });

  private slugTouched = false;

  constructor() {
    super();
    this.admin.tags().pipe(takeUntilDestroyed()).subscribe((tags) => this.tagOptions.set(tags));
    const basics = this.form.controls.basics.controls;
    basics.slug.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => (this.slugTouched = basics.slug.dirty));
    basics.name.valueChanges.pipe(takeUntilDestroyed()).subscribe((name) => {
      if (!this.id() && !this.slugTouched) basics.slug.setValue(slugify(name), { emitEvent: false });
    });
    this.init();
  }

  protected get monthsArray(): FormArray<FormGroup> {
    return this.form.controls.months as FormArray<FormGroup>;
  }

  protected get reachArray(): FormArray<FormGroup> {
    return this.form.controls.howToReach;
  }

  protected addReach(): void {
    this.reachArray.push(this.reachGroup());
  }

  protected removeReach(index: number): void {
    this.reachArray.removeAt(index);
    this.reachArray.markAsDirty();
  }

  protected publicPath(): string | null {
    return `/destinations/${this.form.controls.basics.controls.slug.value}`;
  }

  protected toDocument(): DestinationDocument {
    const value = this.form.getRawValue();
    const facts = value.facts;

    return {
      ...value.basics,
      latitude: Number(value.basics.latitude),
      longitude: Number(value.basics.longitude),
      country: value.basics.country || 'India',
      tagline: textOrNull(value.basics.tagline),
      overview: textOrNull(value.basics.overview),
      heroImageUrl: textOrNull(value.basics.heroImageUrl),
      bestTimeToVisit: textOrNull(value.basics.bestTimeToVisit),
      popularityScore: numberOrNull(value.basics.popularityScore) ?? 0,
      rating: numberOrNull(facts.rating),
      idealDaysMin: numberOrNull(facts.idealDaysMin),
      idealDaysMax: numberOrNull(facts.idealDaysMax),
      budgetPerDayMin: numberOrNull(facts.budgetPerDayMin),
      budgetPerDayMax: numberOrNull(facts.budgetPerDayMax),
      altitudeM: numberOrNull(facts.altitudeM),
      nearestAirport: textOrNull(facts.nearestAirport),
      nearestAirportKm: numberOrNull(facts.nearestAirportKm),
      nearestRailway: textOrNull(facts.nearestRailway),
      nearestRailwayKm: numberOrNull(facts.nearestRailwayKm),
      seoTitle: textOrNull(value.seo.seoTitle),
      seoDescription: textOrNull(value.seo.seoDescription),
      tags: value.tags,
      months: value.months
        .filter((month) => month['rating'])
        .map((month) => ({
          month: month['month'],
          rating: month['rating'],
          avgMinC: numberOrNull(month['avgMinC']),
          avgMaxC: numberOrNull(month['avgMaxC']),
          rainfallMm: numberOrNull(month['rainfallMm']),
          notes: textOrNull(month['notes']),
          events: String(month['events'] ?? '')
            .split(',')
            .map((event) => event.trim())
            .filter(Boolean)
        })),
      howToReach: value.howToReach.map((route) => ({
        mode: route['mode'],
        hubName: route['hubName'],
        distanceKm: numberOrNull(route['distanceKm']),
        durationMinutes: numberOrNull(route['durationMinutes']),
        costMin: numberOrNull(route['costMin']),
        costMax: numberOrNull(route['costMax']),
        summary: route['summary']
      })),
      faqs: value.faqs.map((faq) => ({ question: faq['question'], answer: faq['answer'] })),
      media: mediaRefs(value.media as Array<{ mediaId: string; isCover: boolean }>)
    };
  }

  protected applyDocument(doc: DestinationDocument): void {
    this.slugTouched = true;
    this.form.patchValue({
      basics: {
        name: doc.name,
        slug: doc.slug,
        state: doc.state,
        country: doc.country ?? 'India',
        latitude: doc.latitude,
        longitude: doc.longitude,
        tagline: doc.tagline ?? '',
        shortDescription: doc.shortDescription,
        overview: doc.overview ?? '',
        isFeatured: doc.isFeatured ?? false,
        popularityScore: doc.popularityScore ?? 0,
        heroImageUrl: doc.heroImageUrl ?? '',
        bestTimeToVisit: doc.bestTimeToVisit ?? ''
      },
      facts: {
        rating: doc.rating ?? null,
        idealDaysMin: doc.idealDaysMin ?? null,
        idealDaysMax: doc.idealDaysMax ?? null,
        budgetPerDayMin: doc.budgetPerDayMin ?? null,
        budgetPerDayMax: doc.budgetPerDayMax ?? null,
        altitudeM: doc.altitudeM ?? null,
        nearestAirport: doc.nearestAirport ?? '',
        nearestAirportKm: doc.nearestAirportKm ?? null,
        nearestRailway: doc.nearestRailway ?? '',
        nearestRailwayKm: doc.nearestRailwayKm ?? null
      },
      seo: { seoTitle: doc.seoTitle ?? '', seoDescription: doc.seoDescription ?? '' },
      tags: doc.tags ?? []
    });
    const months = new Map((doc.months ?? []).map((month) => [month.month, month]));
    this.monthsArray.controls.forEach((group, index) => {
      const month = months.get(index + 1);
      group.reset({
        month: index + 1,
        rating: month?.rating ?? '',
        avgMinC: month?.avgMinC ?? null,
        avgMaxC: month?.avgMaxC ?? null,
        rainfallMm: month?.rainfallMm ?? null,
        notes: month?.notes ?? '',
        events: (month?.events ?? []).join(', ')
      });
    });
    this.replace(this.reachArray, (doc.howToReach ?? []).map((route) => this.reachGroup(route)));
    this.replace(this.form.controls.faqs, (doc.faqs ?? []).map((faq) => faqGroup(this.fb, faq)));
    this.replace(this.form.controls.media, (doc.media ?? []).map((ref) => mediaGroup(this.fb, ref)));
  }

  private replace(array: FormArray<FormGroup>, groups: FormGroup[]): void {
    array.clear();
    groups.forEach((group) => array.push(group));
  }

  private monthGroup(month: number): FormGroup {
    return this.fb.group({
      month: [month],
      rating: [''],
      avgMinC: [null as number | null],
      avgMaxC: [null as number | null],
      rainfallMm: [null as number | null, Validators.min(0)],
      notes: ['', Validators.maxLength(300)],
      events: ['']
    });
  }

  private reachGroup(route: Partial<NonNullable<DestinationDocument['howToReach']>[number]> = {}): FormGroup {
    return this.fb.group({
      mode: [route.mode ?? 'ROAD', Validators.required],
      hubName: [route.hubName ?? '', [Validators.required, Validators.minLength(2)]],
      distanceKm: [route.distanceKm ?? null],
      durationMinutes: [route.durationMinutes ?? null],
      costMin: [route.costMin ?? null],
      costMax: [route.costMax ?? null],
      summary: [route.summary ?? '', [Validators.required, Validators.minLength(10), Validators.maxLength(500)]]
    });
  }
}
