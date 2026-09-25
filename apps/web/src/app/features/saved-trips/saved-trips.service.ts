import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'travel-platform.saved-trip-ids';

@Injectable({
  providedIn: 'root'
})
export class SavedTripsService {
  private readonly savedIds = signal<Set<string>>(this.readSavedIds());
  readonly ids = this.savedIds.asReadonly();

  isSaved(tripId: string): boolean {
    return this.savedIds().has(tripId);
  }

  save(tripId: string): void {
    this.update((ids) => ids.add(tripId));
  }

  remove(tripId: string): void {
    this.update((ids) => {
      ids.delete(tripId);
      return ids;
    });
  }

  toggle(tripId: string): boolean {
    if (this.isSaved(tripId)) {
      this.remove(tripId);
      return false;
    }

    this.save(tripId);
    return true;
  }

  private update(mutator: (ids: Set<string>) => Set<string>): void {
    const next = mutator(new Set(this.savedIds()));
    this.savedIds.set(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  }

  private readSavedIds(): Set<string> {
    const rawValue = localStorage.getItem(STORAGE_KEY);

    if (!rawValue) {
      return new Set();
    }

    try {
      const parsed = JSON.parse(rawValue) as unknown;
      return Array.isArray(parsed)
        ? new Set(parsed.filter((value): value is string => typeof value === 'string'))
        : new Set();
    } catch {
      return new Set();
    }
  }
}
