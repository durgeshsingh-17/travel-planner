import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

import { AdminApiService } from './admin-api.service';
import { ModerationReview } from './admin.models';
import { ToastService } from '../../shared/services/toast.service';

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [MatButtonModule, RouterLink],
  template: `
    <main class="admin-page">
      <div class="admin-toolbar">
        <h1>Reviews</h1>
        <div class="filters">
          @for (option of statuses; track option) {
            <button mat-button type="button" [class.active]="status() === option" (click)="load(option)">{{ option.toLowerCase() }}</button>
          }
        </div>
      </div>
      <p class="muted">Approve reviews that describe a real experience. Reject spam, abuse, personal data, or reviews about something else, and say why: the author sees your note.</p>
      @for (review of reviews(); track review.id) {
        <article class="admin-card">
          <p><strong>{{ '★'.repeat(review.rating) }}{{ '☆'.repeat(5 - review.rating) }}</strong>
            · <a [routerLink]="review.target.path" target="_blank">{{ review.target.name }}</a>
            · {{ review.author.name }} <span class="muted">({{ review.author.email }})</span>
            @if (review.isVerified) { · <span class="verified">verified booking</span> }</p>
          @if (review.title) { <h3>{{ review.title }}</h3> }
          <p>{{ review.body }}</p>
          @if (review.moderationNote) { <p class="muted">Note: {{ review.moderationNote }}</p> }
          @if (review.status === 'PENDING') {
            <div class="actions">
              <button mat-flat-button color="primary" type="button" (click)="moderate(review, 'APPROVED')">Approve</button>
              <input #note placeholder="Reason for rejecting" aria-label="Reason for rejecting" />
              <button mat-stroked-button type="button" (click)="moderate(review, 'REJECTED', note.value)">Reject</button>
            </div>
          }
        </article>
      } @empty {
        <p class="muted">Nothing here.</p>
      }
    </main>
  `,
  styles: `
    .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .actions input { min-width: 240px; padding: 8px; border: 1px solid var(--border); border-radius: 6px; background: var(--surface); color: var(--text); }
    .verified { color: var(--primary); font-weight: 700; }
    .active { background: var(--surface); font-weight: 800; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminReviewsComponent {
  private readonly admin = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  protected readonly statuses = ['PENDING', 'APPROVED', 'REJECTED'];
  protected readonly status = signal('PENDING');
  protected readonly reviews = signal<ModerationReview[]>([]);

  constructor() {
    this.load('PENDING');
  }

  protected load(status: string): void {
    this.status.set(status);
    this.admin.reviewQueue(status).subscribe((reviews) => this.reviews.set(reviews));
  }

  protected moderate(review: ModerationReview, decision: 'APPROVED' | 'REJECTED', note?: string): void {
    if (decision === 'REJECTED' && (!note || note.trim().length < 5)) {
      this.toast.error('Add a short reason (at least 5 characters) so the author knows what to fix.');
      return;
    }

    this.admin.moderateReview(review.id, decision, note?.trim()).subscribe({
      next: () => {
        this.reviews.update((reviews) => reviews.filter((entry) => entry.id !== review.id));
        this.toast.success(decision === 'APPROVED' ? 'Review published' : 'Review rejected');
      },
      error: (error: Error) => this.toast.error(error.message)
    });
  }
}
