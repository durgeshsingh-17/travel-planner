import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
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
import { DestinationRow, PackageDocument, PlaceRow, TagRow } from './admin.models';
import { EditorActionsComponent } from './shared/editor-actions.component';
import { FaqFieldsComponent, faqGroup } from './shared/faq-fields.component';
import { HealthPanelComponent } from './shared/health-panel.component';
import { LoadingStateComponent } from '../../shared/components/loading-state.component';
import { MONTH_NAMES } from '../../shared/utils/content-format.util';
import { MediaFieldsComponent, mediaGroup, mediaRefs } from './shared/media-fields.component';
import { TIER_LABELS } from '../quotes/quotes.models';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const POLICY_KINDS = [
  { kind: 'CANCELLATION', label: 'Cancellation policy' },
  { kind: 'PAYMENT', label: 'Payment terms' },
  { kind: 'CHILD', label: 'Children' },
  { kind: 'GENERAL', label: 'Good to know' }
] as const;
type Tier = NonNullable<PackageDocument['tiers']>[number]['level'];

@Component({
  selector: 'app-admin-package-editor',
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
  templateUrl: './admin-package-editor.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminPackageEditorComponent extends ContentEditorBase<PackageDocument> {
  protected readonly entity = 'packages' as const;
  protected readonly months = MONTH_NAMES.map((label, index) => ({ label: label.slice(0, 3), value: index + 1 }));
  protected readonly tierLevels = (Object.keys(TIER_LABELS) as Tier[]).map((value) => ({ value, label: TIER_LABELS[value] }));
  protected readonly policyKinds = POLICY_KINDS;
  protected readonly destinations = signal<DestinationRow[]>([]);
  protected readonly tagOptions = signal<TagRow[]>([]);
  private readonly placesByDestination = signal<Record<string, PlaceRow[]>>({});
  private readonly routeSlugs = signal<string[]>([]);

  protected readonly form = this.fb.group({
    basics: this.fb.nonNullable.group({
      title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(120)]],
      slug: ['', [Validators.required, Validators.pattern(SLUG)]],
      summary: ['', [Validators.required, Validators.minLength(20), Validators.maxLength(400)]],
      overview: ['', Validators.maxLength(20000)],
      durationNights: [2, [Validators.required, Validators.min(0), Validators.max(59)]],
      durationDays: [3, [Validators.required, Validators.min(1), Validators.max(60)]],
      startLocationSlug: [''],
      availableMonths: this.fb.nonNullable.control<number[]>([]),
      minPax: [1, [Validators.min(1)]],
      maxPax: this.fb.control<number | null>(null),
      isCustomizable: [true],
      isFeatured: [false],
      popularityScore: [0]
    }),
    route: this.fb.array<FormGroup>([]),
    tiers: this.fb.array<FormGroup>([]),
    days: this.fb.array<FormGroup>([]),
    stays: this.fb.array<FormGroup>([]),
    inclusions: this.fb.nonNullable.control(''),
    exclusions: this.fb.nonNullable.control(''),
    policies: this.fb.nonNullable.group({ CANCELLATION: [''], PAYMENT: [''], CHILD: [''], GENERAL: [''] }),
    seo: this.fb.nonNullable.group({ seoTitle: ['', Validators.maxLength(70)], seoDescription: ['', Validators.maxLength(170)] }),
    tags: this.fb.nonNullable.control<string[]>([]),
    faqs: this.fb.array<FormGroup>([]),
    media: this.fb.array<FormGroup>([])
  });

  /** Destinations on the route, for day overnights, places and hotel rows. */
  protected readonly routeDestinations = computed(() =>
    this.routeSlugs()
      .map((slug) => this.destinations().find((destination) => destination.slug === slug))
      .filter((destination): destination is DestinationRow => Boolean(destination))
  );
  protected readonly routePlaces = computed(() =>
    this.routeSlugs().flatMap((slug) =>
      (this.placesByDestination()[slug] ?? []).map((place) => ({ value: `${slug}/${place.slug}`, label: `${place.name} (${place.destination.name})` }))
    )
  );

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
    basics.title.valueChanges.pipe(takeUntilDestroyed()).subscribe((title) => {
      if (!this.id() && !this.slugTouched) basics.slug.setValue(slugify(title), { emitEvent: false });
    });
    this.form.controls.route.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.syncRoute());
    this.init();
  }

  protected get routeArray(): FormArray<FormGroup> { return this.form.controls.route; }
  protected get tiersArray(): FormArray<FormGroup> { return this.form.controls.tiers; }
  protected get daysArray(): FormArray<FormGroup> { return this.form.controls.days; }
  protected get staysArray(): FormArray<FormGroup> { return this.form.controls.stays; }

  protected routeNights(): number {
    return this.routeArray.value.reduce((sum, stop) => sum + Number(stop['nights'] || 0), 0);
  }

  protected addStop(): void { this.routeArray.push(this.stopGroup()); }
  protected addTier(): void { this.tiersArray.push(this.tierGroup()); }
  protected addStay(): void { this.staysArray.push(this.stayGroup()); }

  /** Creates or trims day rows so there is exactly one per day. */
  protected matchDays(): void {
    const target = Number(this.form.controls.basics.controls.durationDays.value) || 0;

    while (this.daysArray.length < target) this.daysArray.push(this.dayGroup());
    while (this.daysArray.length > target) this.daysArray.removeAt(this.daysArray.length - 1);

    this.daysArray.markAsDirty();
  }

  protected removeRow(array: FormArray, index: number): void {
    array.removeAt(index);
    array.markAsDirty();
  }

  protected tierLabel(level: Tier): string {
    return TIER_LABELS[level];
  }

  protected publicPath(): string | null {
    return `/packages/${this.form.controls.basics.controls.slug.value}`;
  }

  protected toDocument(): PackageDocument {
    const value = this.form.getRawValue();
    const lines = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean);

    return {
      ...value.basics,
      overview: textOrNull(value.basics.overview),
      startLocationSlug: textOrNull(value.basics.startLocationSlug),
      durationDays: Number(value.basics.durationDays),
      durationNights: Number(value.basics.durationNights),
      minPax: Number(value.basics.minPax) || 1,
      maxPax: numberOrNull(value.basics.maxPax),
      popularityScore: numberOrNull(value.basics.popularityScore) ?? 0,
      seoTitle: textOrNull(value.seo.seoTitle),
      seoDescription: textOrNull(value.seo.seoDescription),
      tags: value.tags,
      route: value.route.map((stop) => ({ destinationSlug: stop['destinationSlug'], nights: Number(stop['nights']) })),
      tiers: value.tiers.map((tier) => ({
        level: tier['level'],
        pricePerPerson: Number(tier['pricePerPerson']),
        compareAtPrice: numberOrNull(tier['compareAtPrice']),
        childPrice: numberOrNull(tier['childPrice']),
        singleSupplement: numberOrNull(tier['singleSupplement']),
        taxesIncluded: Boolean(tier['taxesIncluded']),
        hotelCategory: numberOrNull(tier['hotelCategory']),
        transportNote: textOrNull(tier['transportNote'])
      })),
      days: value.days.map((day, index) => ({
        dayNumber: index + 1,
        title: day['title'],
        description: day['description'],
        overnightDestinationSlug: textOrNull(day['overnightDestinationSlug']),
        mealsIncluded: ['B', 'L', 'D'].filter((meal) => day[`meal${meal}`]),
        places: (day['places'] as string[]).map((key) => {
          const [destinationSlug, placeSlug] = key.split('/');
          return { destinationSlug, placeSlug };
        })
      })),
      stays: value.stays.map((stay) => ({
        tierLevel: stay['tierLevel'],
        destinationSlug: stay['destinationSlug'],
        nights: Number(stay['nights']),
        hotelName: stay['hotelName'],
        orSimilar: Boolean(stay['orSimilar']),
        hotelCategory: numberOrNull(stay['hotelCategory']),
        roomType: textOrNull(stay['roomType']),
        mealPlan: stay['mealPlan']
      })),
      inclusions: lines(value.inclusions),
      exclusions: lines(value.exclusions),
      policies: POLICY_KINDS.filter(({ kind }) => value.policies[kind].trim()).map(({ kind }) => ({ kind, body: value.policies[kind].trim() })),
      faqs: value.faqs.map((faq) => ({ question: faq['question'], answer: faq['answer'] })),
      media: mediaRefs(value.media as Array<{ mediaId: string; isCover: boolean }>)
    };
  }

  protected applyDocument(doc: PackageDocument): void {
    this.slugTouched = true;
    this.form.patchValue({
      basics: {
        title: doc.title,
        slug: doc.slug,
        summary: doc.summary,
        overview: doc.overview ?? '',
        durationNights: doc.durationNights,
        durationDays: doc.durationDays,
        startLocationSlug: doc.startLocationSlug ?? '',
        availableMonths: doc.availableMonths ?? [],
        minPax: doc.minPax ?? 1,
        maxPax: doc.maxPax ?? null,
        isCustomizable: doc.isCustomizable ?? true,
        isFeatured: doc.isFeatured ?? false,
        popularityScore: doc.popularityScore ?? 0
      },
      inclusions: (doc.inclusions ?? []).join('\n'),
      exclusions: (doc.exclusions ?? []).join('\n'),
      policies: Object.fromEntries(POLICY_KINDS.map(({ kind }) => [kind, doc.policies?.find((policy) => policy.kind === kind)?.body ?? ''])),
      seo: { seoTitle: doc.seoTitle ?? '', seoDescription: doc.seoDescription ?? '' },
      tags: doc.tags ?? []
    });
    this.replace(this.routeArray, (doc.route ?? []).map((stop) => this.stopGroup(stop)));
    this.replace(this.tiersArray, (doc.tiers ?? []).map((tier) => this.tierGroup(tier)));
    this.replace(this.daysArray, (doc.days ?? []).map((day) => this.dayGroup(day)));
    this.replace(this.staysArray, (doc.stays ?? []).map((stay) => this.stayGroup(stay)));
    this.replace(this.form.controls.faqs, (doc.faqs ?? []).map((faq) => faqGroup(this.fb, faq)));
    this.replace(this.form.controls.media, (doc.media ?? []).map((ref) => mediaGroup(this.fb, ref)));
    this.syncRoute();
  }

  private syncRoute(): void {
    const slugs = [...new Set(this.routeArray.value.map((stop) => stop['destinationSlug'] as string).filter(Boolean))];
    this.routeSlugs.set(slugs);

    for (const slug of slugs) {
      const destination = this.destinations().find((entry) => entry.slug === slug);

      if (destination && !this.placesByDestination()[slug]) {
        this.admin.listPlaces({ destinationId: destination.id, pageSize: 100 }).subscribe((page) =>
          this.placesByDestination.update((current) => ({ ...current, [slug]: page.items }))
        );
      }
    }
  }

  private replace(array: FormArray<FormGroup>, groups: FormGroup[]): void {
    array.clear();
    groups.forEach((group) => array.push(group));
  }

  private stopGroup(stop: { destinationSlug?: string; nights?: number } = {}): FormGroup {
    return this.fb.nonNullable.group({
      destinationSlug: [stop.destinationSlug ?? '', Validators.required],
      nights: [stop.nights ?? 1, [Validators.required, Validators.min(0)]]
    });
  }

  private tierGroup(tier: Partial<NonNullable<PackageDocument['tiers']>[number]> = {}): FormGroup {
    return this.fb.group({
      level: [tier.level ?? 'BUDGET', Validators.required],
      pricePerPerson: [tier.pricePerPerson ?? null, [Validators.required, Validators.min(1)]],
      compareAtPrice: [tier.compareAtPrice ?? null],
      childPrice: [tier.childPrice ?? null],
      singleSupplement: [tier.singleSupplement ?? null],
      taxesIncluded: [tier.taxesIncluded ?? false],
      hotelCategory: [tier.hotelCategory ?? null],
      transportNote: [tier.transportNote ?? '']
    });
  }

  private dayGroup(day: Partial<NonNullable<PackageDocument['days']>[number]> = {}): FormGroup {
    const meals = day.mealsIncluded ?? [];
    return this.fb.nonNullable.group({
      title: [day.title ?? '', [Validators.required, Validators.minLength(3)]],
      description: [day.description ?? '', [Validators.required, Validators.minLength(10)]],
      overnightDestinationSlug: [day.overnightDestinationSlug ?? ''],
      mealB: [meals.includes('B')],
      mealL: [meals.includes('L')],
      mealD: [meals.includes('D')],
      places: this.fb.nonNullable.control<string[]>((day.places ?? []).map((place) => `${place.destinationSlug}/${place.placeSlug}`))
    });
  }

  private stayGroup(stay: Partial<NonNullable<PackageDocument['stays']>[number]> = {}): FormGroup {
    return this.fb.group({
      tierLevel: [stay.tierLevel ?? this.tiersArray.at(0)?.value['level'] ?? 'BUDGET', Validators.required],
      destinationSlug: [stay.destinationSlug ?? this.routeSlugs()[0] ?? '', Validators.required],
      nights: [stay.nights ?? 1, [Validators.required, Validators.min(1)]],
      hotelName: [stay.hotelName ?? '', [Validators.required, Validators.minLength(2)]],
      orSimilar: [stay.orSimilar ?? true],
      hotelCategory: [stay.hotelCategory ?? null],
      roomType: [stay.roomType ?? ''],
      mealPlan: [stay.mealPlan ?? 'CP', Validators.required]
    });
  }
}
