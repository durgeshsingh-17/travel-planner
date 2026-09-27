import { ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal, output, signal } from '@angular/core';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, CdkDropListGroup, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';

import { ContentApiService } from '../../content/content-api.service';
import { PlaceCard } from '../../content/content.models';
import { ToastService } from '../../../shared/services/toast.service';
import { Trip, TripActivity, TripDay } from '../models/trip.model';
import { TripsApiService } from '../services/trips-api.service';

/** Day-by-day plan. Owners can drag stops, move them between days, add, remove and re-plan. */
@Component({
  selector: 'app-trip-itinerary',
  standalone: true,
  imports: [
    CdkDrag,
    CdkDragHandle,
    CdkDropList,
    CdkDropListGroup,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatMenuModule,
    MatSelectModule,
    RouterLink
  ],
  templateUrl: './trip-itinerary.component.html',
  styleUrl: './trip-itinerary.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TripItineraryComponent {
  private readonly content = inject(ContentApiService);
  private readonly toast = inject(ToastService);
  private readonly tripsApi = inject(TripsApiService);

  readonly trip = input.required<Trip>();
  readonly editable = input(false);
  readonly tripChange = output<Trip>();

  /** Local copy so drags show instantly; reset whenever the server sends a new trip. */
  protected readonly days = linkedSignal(() => this.trip().days.map((day) => ({ ...day, activities: [...day.activities] })));
  protected readonly busy = signal(false);
  protected readonly addingTo = signal<number | null>(null);
  protected readonly places = signal<PlaceCard[] | null>(null);
  protected readonly choice = signal<string>('');
  protected readonly customTitle = signal('');
  protected readonly customMinutes = signal(60);

  protected readonly usedPlaceIds = computed(() => new Set(this.days().flatMap((day) => day.activities.map((activity) => activity.placeId).filter(Boolean))));
  protected readonly sparePlaces = computed(() => (this.places() ?? []).filter((place) => !this.usedPlaceIds().has(place.id)));
  protected readonly coverageMessage = computed(() => {
    const trip = this.trip();

    switch (trip.coverage) {
      case 'NONE':
        return `We don't have a guide for ${trip.destinationName} yet, so this plan covers the journey and leaves the days free. Add your own stops below.`;
      case 'PARTIAL':
        return `We only have a few curated places for ${trip.destinationName}, so some time is left free.`;
      default:
        return null;
    }
  });

  protected dayDropped(event: CdkDragDrop<TripDay>): void {
    const trip = this.trip();
    const target = event.container.data;
    const source = event.previousContainer.data;

    if (source === target) {
      if (event.previousIndex === event.currentIndex) return;
      this.days.update((days) => days.map((day) => (day.dayNumber === target.dayNumber ? this.reordered(day, event.previousIndex, event.currentIndex) : day)));
      const ids = this.days().find((day) => day.dayNumber === target.dayNumber)!.activities.map((activity) => activity.id);
      this.save(this.tripsApi.reorderDay(trip.id, target.dayNumber, ids), 'Order updated');
      return;
    }

    const activity = source.activities[event.previousIndex];
    this.days.update((days) => {
      const next = days.map((day) => ({ ...day, activities: [...day.activities] }));
      transferArrayItem(
        next.find((day) => day.dayNumber === source.dayNumber)!.activities,
        next.find((day) => day.dayNumber === target.dayNumber)!.activities,
        event.previousIndex,
        event.currentIndex
      );
      return next;
    });
    this.save(this.tripsApi.updateActivity(trip.id, activity.id, { dayNumber: target.dayNumber, position: event.currentIndex + 1 }), `Moved to day ${target.dayNumber}`);
  }

  /** Keyboard- and touch-friendly alternative to dragging. */
  protected move(day: TripDay, index: number, offset: -1 | 1): void {
    const next = index + offset;
    if (next < 0 || next >= day.activities.length) return;
    this.days.update((days) => days.map((entry) => (entry.dayNumber === day.dayNumber ? this.reordered(entry, index, next) : entry)));
    const ids = this.days().find((entry) => entry.dayNumber === day.dayNumber)!.activities.map((activity) => activity.id);
    this.save(this.tripsApi.reorderDay(this.trip().id, day.dayNumber, ids), 'Order updated');
  }

  protected moveToDay(activity: TripActivity, dayNumber: number): void {
    this.save(this.tripsApi.updateActivity(this.trip().id, activity.id, { dayNumber }), `Moved to day ${dayNumber}`);
  }

  protected remove(activity: TripActivity): void {
    this.save(this.tripsApi.removeActivity(this.trip().id, activity.id), `Removed ${activity.title}`);
  }

  protected regenerate(day: TripDay): void {
    this.save(this.tripsApi.regenerateDay(this.trip().id, day.dayNumber), `Day ${day.dayNumber} re-planned`);
  }

  protected openAdd(day: TripDay): void {
    this.addingTo.set(day.dayNumber);
    this.choice.set('');
    this.customTitle.set('');
    this.customMinutes.set(60);
    const guide = this.trip().destinationGuide;

    if (guide && this.places() === null) {
      this.content.destinationPlaces(guide.slug, { pageSize: 48 }).subscribe({
        next: (page) => this.places.set(page.items),
        error: () => this.places.set([])
      });
    }
  }

  protected add(day: TripDay): void {
    const placeId = this.choice();
    const title = this.customTitle().trim();

    if (!placeId && title.length < 2) {
      this.toast.error('Choose a place or type a name for your stop.');
      return;
    }

    const body = placeId ? { placeId } : { title, durationMinutes: Number(this.customMinutes()) || 60 };
    this.save(this.tripsApi.addActivity(this.trip().id, day.dayNumber, body), 'Stop added', () => this.addingTo.set(null));
  }

  protected directionsUrl(activity: TripActivity, previous: TripActivity | undefined): string | null {
    if (activity.latitude == null || activity.longitude == null) return null;
    const from = previous?.latitude != null && previous.longitude != null ? `${previous.latitude},${previous.longitude}` : '';
    return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${from};${activity.latitude},${activity.longitude}`;
  }

  protected previousWithLocation(day: TripDay, index: number): TripActivity | undefined {
    return day.activities.slice(0, index).reverse().find((activity) => activity.latitude != null);
  }

  protected duration(activity: TripActivity): string | null {
    const minutes = activity.durationMinutes;
    if (!minutes || activity.activityType === 'TRAVEL') return null;
    return minutes >= 60 ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}` : `${minutes} min`;
  }

  protected labelize(value: string): string {
    return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ');
  }

  private reordered(day: TripDay, from: number, to: number): TripDay {
    const activities = [...day.activities];
    moveItemInArray(activities, from, to);
    return { ...day, activities };
  }

  private save(request: Observable<Trip>, success: string, done?: () => void): void {
    this.busy.set(true);
    request.pipe(finalize(() => this.busy.set(false))).subscribe({
      next: (trip) => {
        this.tripChange.emit(trip);
        this.toast.success(success);
        done?.();
      },
      error: (error: Error) => {
        // Put the local copy back to what the server has.
        this.days.set(this.trip().days.map((day) => ({ ...day, activities: [...day.activities] })));
        this.toast.error(error.message);
      }
    });
  }
}
