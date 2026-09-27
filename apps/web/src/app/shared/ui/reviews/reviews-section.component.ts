import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { ContentApiService } from '../../../features/content/content-api.service';
import { OwnReview, ReviewList, ReviewTarget, TravellerType } from '../../../features/content/content.models';
import { MONTH_NAMES } from '../../utils/content-format.util';
import { SessionService } from '../../../core/auth/session.service';
import { ToastService } from '../../services/toast.service';

const TRAVELLER_TYPES: Array<{ value: TravellerType; label: string }> = [
  { value: 'SOLO', label: 'Solo' },
  { value: 'COUPLE', label: 'Couple' },
  { value: 'FAMILY', label: 'Family' },
  { value: 'FRIENDS', label: 'Friends' },
  { value: 'BUSINESS', label: 'Work trip' }
];

/** Approved reviews for a package, destination or place, plus a form to add or edit your own. */
@Component({
  selector: 'app-reviews-section',
  standalone: true,
  imports: [MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, ReactiveFormsModule, RouterLink],
  template: `
    <section class="content-section" id="reviews" aria-labelledby="reviews-heading">
      <header>
        <h2 id="reviews-heading">Reviews</h2>
        @if (!formOpen()) {
          @if (session.session().isAuthenticated) {
            <button mat-stroked-button type="button" (click)="openForm()">{{ mine() ? 'Edit your review' : 'Write a review' }}</button>
          } @else {
            <a mat-stroked-button routerLink="/sign-in" [queryParams]="{ returnUrl: router.url }">Sign in to write a review</a>
          }
        }
      </header>

      @if (mine(); as own) {
        @if (own.status !== 'APPROVED') {
          <p class="notice" role="status">
            @if (own.status === 'PENDING') {
              Thanks! Your review is waiting for a quick check before it appears.
            } @else {
              Your review was not published{{ own.moderationNote ? ': ' + own.moderationNote : '.' }} You can edit and resubmit it.
            }
          </p>
        }
      }

      @if (formOpen()) {
        <form class="review-form" [formGroup]="form" (ngSubmit)="submit()">
          <fieldset class="stars">
            <legend>Your rating</legend>
            @for (star of [1, 2, 3, 4, 5]; track star) {
              <label>
                <input type="radio" formControlName="rating" [value]="star" />
                <span [class.on]="(form.controls.rating.value ?? 0) >= star" [attr.aria-label]="star + ' star' + (star > 1 ? 's' : '')">★</span>
              </label>
            }
          </fieldset>
          <mat-form-field appearance="outline"><mat-label>Title (optional)</mat-label><input matInput formControlName="title" maxlength="120" /></mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Your review</mat-label>
            <textarea matInput formControlName="body" rows="5" maxlength="3000"></textarea>
            <mat-hint>At least 30 characters. Please don't include phone numbers or emails.</mat-hint>
          </mat-form-field>
          <div class="row">
            <mat-form-field appearance="outline">
              <mat-label>When did you go?</mat-label>
              <mat-select formControlName="travelledMonth">
                <mat-option [value]="''">Prefer not to say</mat-option>
                @for (month of recentMonths; track month.value) {
                  <mat-option [value]="month.value">{{ month.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Travelled as</mat-label>
              <mat-select formControlName="travellerType">
                <mat-option [value]="''">Prefer not to say</mat-option>
                @for (type of travellerTypes; track type.value) {
                  <mat-option [value]="type.value">{{ type.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
          </div>
          <div class="actions">
            <button mat-flat-button color="primary" type="submit" [disabled]="busy()">Submit review</button>
            <button mat-button type="button" (click)="formOpen.set(false)">Cancel</button>
          </div>
        </form>
      }

      @if (list(); as data) {
        @if (data.summary.count) {
          <div class="summary">
            <p class="average"><strong>{{ data.summary.average }}</strong> / 5 · {{ data.summary.count }} review{{ data.summary.count === 1 ? '' : 's' }}</p>
            <ul class="distribution">
              @for (row of data.summary.distribution; track row.stars) {
                <li>
                  <span>{{ row.stars }}★</span>
                  <span class="bar"><span [style.width.%]="(row.count / data.summary.count) * 100"></span></span>
                  <span>{{ row.count }}</span>
                </li>
              }
            </ul>
          </div>
          <ul class="reviews">
            @for (review of data.items; track review.id) {
              <li>
                <p class="meta">
                  <span class="stars-display" [attr.aria-label]="review.rating + ' out of 5'">{{ stars(review.rating) }}</span>
                  <strong>{{ review.author }}</strong>
                  @if (review.isVerified) { <span class="verified">Booked through us</span> }
                  <span class="muted">{{ describe(review) }}</span>
                </p>
                @if (review.title) { <h3>{{ review.title }}</h3> }
                <p>{{ review.body }}</p>
              </li>
            }
          </ul>
          @if (data.total > data.page * data.pageSize) {
            <button mat-button type="button" (click)="loadMore()">Show more reviews</button>
          }
        } @else {
          <p class="muted">No reviews yet. Be the first to share your experience.</p>
        }
      }
    </section>
  `,
  styles: `
    .notice { margin: 0; padding: 10px 14px; border-radius: 10px; background: var(--surface-soft); }
    .review-form { display: grid; gap: 4px; max-width: 640px; padding: 16px; border: 1px solid var(--border); border-radius: 14px; background: var(--surface); }
    .stars { display: flex; gap: 4px; margin: 0 0 8px; padding: 0; border: 0; }
    .stars legend { margin-bottom: 4px; font-weight: 700; }
    .stars input { position: absolute; opacity: 0; }
    .stars span { font-size: 1.8rem; color: var(--border); cursor: pointer; }
    .stars span.on { color: var(--accent); }
    .stars label:focus-within span { outline: 2px solid var(--primary); border-radius: 4px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .actions { display: flex; gap: 8px; }
    .summary { display: flex; flex-wrap: wrap; gap: 24px; align-items: center; }
    .average { margin: 0; font-size: 1.1rem; }
    .average strong { font-size: 2rem; }
    .distribution { display: grid; gap: 2px; margin: 0; padding: 0; list-style: none; font-size: .85rem; min-width: 220px; }
    .distribution li { display: grid; grid-template-columns: 28px 1fr 28px; gap: 8px; align-items: center; }
    .bar { height: 8px; border-radius: 4px; background: var(--surface-soft); overflow: hidden; }
    .bar span { display: block; height: 100%; background: var(--accent); }
    .reviews { display: grid; gap: 14px; margin: 0; padding: 0; list-style: none; }
    .reviews li { padding: 14px 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface); }
    .reviews h3, .reviews p { margin: 4px 0 0; }
    .meta { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 0; }
    .stars-display { color: var(--accent); letter-spacing: 1px; }
    .verified { padding: 1px 8px; border-radius: 999px; background: rgba(11, 98, 93, .14); color: var(--primary); font-size: .75rem; font-weight: 800; }
    @media (max-width: 560px) { .row { grid-template-columns: 1fr; } }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReviewsSectionComponent {
  private readonly content = inject(ContentApiService);
  private readonly toast = inject(ToastService);
  protected readonly router = inject(Router);
  protected readonly session = inject(SessionService);

  readonly target = input.required<ReviewTarget>();

  protected readonly travellerTypes = TRAVELLER_TYPES;
  protected readonly recentMonths = Array.from({ length: 24 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - index);
    return { value: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, label: `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}` };
  });
  protected readonly list = signal<ReviewList | null>(null);
  protected readonly mine = signal<OwnReview | null>(null);
  protected readonly formOpen = signal(false);
  protected readonly busy = signal(false);
  private readonly targetKey = computed(() => JSON.stringify(this.target()));

  private readonly fb = inject(FormBuilder);
  protected readonly form = this.fb.group({
    rating: this.fb.control<number | null>(null, [Validators.required, Validators.min(1), Validators.max(5)]),
    title: this.fb.control(''),
    body: this.fb.control('', [Validators.required, Validators.minLength(30), Validators.maxLength(3000)]),
    travelledMonth: this.fb.control(''),
    travellerType: this.fb.control<TravellerType | ''>('')
  });

  constructor() {
    effect(() => {
      this.targetKey();
      this.load(1);
      this.loadMine();
    });
  }

  protected stars(rating: number): string {
    return '★'.repeat(rating) + '☆'.repeat(5 - rating);
  }

  protected describe(review: { travelledMonth: string | null; travellerType: TravellerType | null }): string {
    const parts = [];
    if (review.travelledMonth) {
      const [year, month] = review.travelledMonth.split('-').map(Number);
      parts.push(`${MONTH_NAMES[month - 1]} ${year}`);
    }
    if (review.travellerType) parts.push(TRAVELLER_TYPES.find((type) => type.value === review.travellerType)?.label ?? '');
    return parts.join(' · ');
  }

  protected openForm(): void {
    const own = this.mine();
    this.form.reset({
      rating: own?.rating ?? null,
      title: own?.title ?? '',
      body: own?.body ?? '',
      travelledMonth: own?.travelledMonth ?? '',
      travellerType: own?.travellerType ?? ''
    });
    this.formOpen.set(true);
  }

  protected submit(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.toast.error('Choose a rating and write at least 30 characters.');
      return;
    }

    const value = this.form.getRawValue();
    const input = {
      rating: Number(value.rating),
      title: value.title || undefined,
      body: value.body ?? '',
      travelledMonth: value.travelledMonth || undefined,
      travellerType: value.travellerType || undefined
    };
    const own = this.mine();
    const request = own ? this.content.updateReview(own.id, input) : this.content.createReview(this.target(), input);

    this.busy.set(true);
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (review) => {
        this.mine.set(review);
        this.formOpen.set(false);
        this.toast.success('Thanks! Your review will appear after a quick check.');
        this.load(1);
      },
      error: (error: Error) => this.toast.error(error.message)
    });
  }

  protected loadMore(): void {
    this.load((this.list()?.page ?? 1) + 1);
  }

  private load(page: number): void {
    this.content.reviews(this.target(), page).subscribe({
      next: (data) =>
        this.list.set(page === 1 ? data : { ...data, items: [...(this.list()?.items ?? []), ...data.items] }),
      error: () => this.list.set(null)
    });
  }

  private loadMine(): void {
    if (!this.session.session().isAuthenticated) {
      this.mine.set(null);
      return;
    }

    const target = this.target();
    this.content.myReviews().subscribe({
      next: (reviews) =>
        this.mine.set(
          reviews.find((review) => review.target.path === this.pathFor(target)) ?? null
        ),
      error: () => this.mine.set(null)
    });
  }

  private pathFor(target: ReviewTarget): string {
    if (target.packageSlug) return `/packages/${target.packageSlug}`;
    if (target.placeSlug) return `/destinations/${target.destinationSlug}/places/${target.placeSlug}`;
    return `/destinations/${target.destinationSlug}`;
  }
}
