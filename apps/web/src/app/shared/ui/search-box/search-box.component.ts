import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, map, of, switchMap } from 'rxjs';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { ContentApiService } from '../../../features/content/content-api.service';
import { SearchSuggestions } from '../../../features/content/content.models';
import { labelize } from '../../utils/content-format.util';

type Suggestion =
  | { kind: 'destination'; label: string; hint: string; slug: string }
  | { kind: 'place'; label: string; hint: string; slug: string; destinationSlug: string }
  | { kind: 'collection'; label: string; hint: string; slug: string }
  | { kind: 'location'; label: string; hint: string; name: string };

const EMPTY: SearchSuggestions = { destinations: [], places: [], collections: [], locations: [] };

@Component({
  selector: 'app-search-box',
  standalone: true,
  imports: [MatAutocompleteModule, MatButtonModule, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  template: `
    <form class="search" role="search" (submit)="$event.preventDefault(); searchAll()">
      <mat-form-field appearance="outline" subscriptSizing="dynamic">
        <mat-label>{{ label() }}</mat-label>
        <input
          matInput
          type="search"
          [formControl]="query"
          [matAutocomplete]="auto"
          autocomplete="off"
          enterkeyhint="search"
        />
        <mat-autocomplete #auto="matAutocomplete" (optionSelected)="open($event)" [displayWith]="display">
          @for (group of groups(); track group.title) {
            <mat-optgroup [label]="group.title">
              @for (item of group.items; track item.label + item.hint) {
                <mat-option [value]="item">
                  <span class="label">{{ item.label }}</span>
                  <span class="hint">{{ item.hint }}</span>
                </mat-option>
              }
            </mat-optgroup>
          }
        </mat-autocomplete>
      </mat-form-field>
      <button mat-flat-button color="primary" type="submit">Search</button>
    </form>
  `,
  styles: `
    .search { display: flex; gap: 10px; align-items: center; width: 100%; }
    mat-form-field { flex: 1; }
    .label { font-weight: 700; }
    .hint { margin-left: 8px; color: var(--muted); font-size: .85rem; }
    button { min-height: 52px; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchBoxComponent {
  private readonly content = inject(ContentApiService);
  private readonly router = inject(Router);

  readonly label = input('Search destinations, places or cities');
  protected readonly query = new FormControl<string | Suggestion>('', { nonNullable: true });
  protected readonly groups = signal<Array<{ title: string; items: Suggestion[] }>>([]);

  constructor() {
    this.query.valueChanges
      .pipe(
        map((value) => (typeof value === 'string' ? value.trim() : '')),
        debounceTime(200),
        distinctUntilChanged(),
        switchMap((q) => (q.length < 2 ? of(EMPTY) : this.content.suggest(q).pipe(catchError(() => of(EMPTY))))),
        takeUntilDestroyed()
      )
      .subscribe((suggestions) => this.groups.set(this.toGroups(suggestions)));
  }

  protected display = (value: Suggestion | string | null): string =>
    typeof value === 'string' ? value : (value?.label ?? '');

  protected open(event: MatAutocompleteSelectedEvent): void {
    const item = event.option.value as Suggestion;

    switch (item.kind) {
      case 'destination':
        void this.router.navigate(['/destinations', item.slug]);
        break;
      case 'place':
        void this.router.navigate(['/destinations', item.destinationSlug, 'places', item.slug]);
        break;
      case 'collection':
        void this.router.navigate(['/collections', item.slug]);
        break;
      case 'location':
        void this.router.navigate(['/plan'], { queryParams: { destination: item.name } });
        break;
    }
  }

  protected searchAll(): void {
    const value = this.query.value;
    const q = typeof value === 'string' ? value.trim() : value.label;
    void this.router.navigate(['/destinations'], { queryParams: q ? { q } : {} });
  }

  private toGroups(suggestions: SearchSuggestions) {
    return [
      {
        title: 'Destinations',
        items: suggestions.destinations.map<Suggestion>((entry) => ({
          kind: 'destination',
          label: entry.name,
          hint: entry.state,
          slug: entry.slug
        }))
      },
      {
        title: 'Places',
        items: suggestions.places.map<Suggestion>((entry) => ({
          kind: 'place',
          label: entry.name,
          hint: `${labelize(entry.category)} · ${entry.destination.name}`,
          slug: entry.slug,
          destinationSlug: entry.destination.slug
        }))
      },
      {
        title: 'Collections',
        items: suggestions.collections.map<Suggestion>((entry) => ({
          kind: 'collection',
          label: entry.title,
          hint: 'Collection',
          slug: entry.slug
        }))
      },
      {
        title: 'Plan a trip to',
        items: suggestions.locations.map<Suggestion>((entry) => ({
          kind: 'location',
          label: entry.name,
          hint: entry.state,
          name: entry.name
        }))
      }
    ].filter((group) => group.items.length);
  }
}
