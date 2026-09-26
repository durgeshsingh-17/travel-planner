import { DestroyRef, Directive, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, finalize } from 'rxjs';

import { AdminApiService, EditableEntity } from '../admin-api.service';
import { ContentHealth, ContentStatus, Editable } from '../admin.models';
import { SessionService } from '../../../core/auth/session.service';
import { ToastService } from '../../../shared/services/toast.service';

export function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

/** Empty string or undefined from a number input becomes null. */
export function numberOrNull(value: unknown): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function textOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export interface HasUnsavedChanges {
  hasUnsavedChanges(): boolean;
}

/**
 * Shared behaviour for the destination, place and collection editors:
 * load by id (or start blank for "new"), save with optimistic concurrency,
 * publish/unpublish/delete, and surface validation errors from the API.
 */
@Directive()
export abstract class ContentEditorBase<TDocument> implements HasUnsavedChanges {
  protected readonly admin = inject(AdminApiService);
  protected readonly fb = inject(FormBuilder);
  protected readonly route = inject(ActivatedRoute);
  protected readonly router = inject(Router);
  protected readonly toast = inject(ToastService);
  protected readonly destroyRef = inject(DestroyRef);
  protected readonly isAdmin = inject(SessionService).session().user?.role === 'ADMIN';

  protected abstract readonly entity: EditableEntity;
  protected abstract readonly form: AbstractControl;

  protected readonly id = signal<string | null>(null);
  protected readonly status = signal<ContentStatus>('DRAFT');
  protected readonly health = signal<ContentHealth | null>(null);
  protected readonly updatedAt = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly isLoading = signal(true);
  protected readonly problems = signal<string[]>([]);
  protected readonly conflict = signal(false);

  protected abstract toDocument(): TDocument;
  protected abstract applyDocument(document: TDocument): void;
  protected abstract publicPath(): string | null;

  /** Call from the subclass constructor once its form exists. */
  protected init(): void {
    const id = this.route.snapshot.paramMap.get('id');

    if (!id || id === 'new') {
      this.isLoading.set(false);
      return;
    }

    this.load(id);
  }

  hasUnsavedChanges(): boolean {
    return this.form.dirty && !this.busy();
  }

  protected load(id: string): void {
    this.isLoading.set(true);
    this.admin
      .get<TDocument>(this.entity, id)
      .pipe(
        finalize(() => this.isLoading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (editable) => this.accept(editable),
        error: (error: Error) => this.problems.set([error.message])
      });
  }

  protected save(): void {
    this.form.markAllAsTouched();

    if (this.form.invalid) {
      this.problems.set(['Some fields need attention: they are highlighted below.']);
      return;
    }

    const id = this.id();
    const request = id
      ? this.admin.update<TDocument>(this.entity, id, this.toDocument(), this.updatedAt() ?? '')
      : this.admin.create<TDocument>(this.entity, this.toDocument());

    this.run(request, id ? 'Saved' : 'Created', (editable) => {
      if (!id) {
        void this.router.navigate(['/admin', this.entity, editable.id], { replaceUrl: true });
      }
    });
  }

  protected setStatus(action: 'publish' | 'unpublish' | 'archive'): void {
    const id = this.id();

    if (!id) return;

    if (this.form.dirty) {
      this.problems.set(['Save your changes before changing the status.']);
      return;
    }

    this.run(this.admin.setStatus<TDocument>(this.entity, id, action), action === 'publish' ? 'Published' : 'Status updated');
  }

  protected remove(): void {
    const id = this.id();

    if (!id || !confirm('Delete this permanently? This cannot be undone.')) return;

    this.busy.set(true);
    this.admin
      .remove(this.entity, id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.form.markAsPristine();
          this.toast.success('Deleted');
          void this.router.navigate(['/admin', this.entity]);
        },
        error: (error: Error) => this.problems.set([error.message])
      });
  }

  protected reload(): void {
    const id = this.id();
    this.conflict.set(false);
    this.problems.set([]);

    if (id) this.load(id);
  }

  private run(request: Observable<Editable<TDocument>>, success: string, after?: (editable: Editable<TDocument>) => void): void {
    this.busy.set(true);
    this.problems.set([]);
    this.conflict.set(false);
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (editable) => {
        this.accept(editable);
        this.toast.success(success);
        after?.(editable);
      },
      error: (error: Error & { status?: number }) => {
        this.conflict.set(error.status === 409 && /Someone else saved/.test(error.message));
        this.problems.set(error.message.split('; '));
      }
    });
  }

  private accept(editable: Editable<TDocument>): void {
    this.id.set(editable.id);
    this.status.set(editable.status);
    this.health.set(editable.health);
    this.updatedAt.set(editable.updatedAt);
    this.applyDocument(editable.document);
    this.form.markAsPristine();
  }
}
