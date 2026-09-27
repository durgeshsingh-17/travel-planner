import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { ContentApiService } from '../../content/content-api.service';
import { ToastService } from '../../../shared/services/toast.service';
import { Trip } from '../models/trip.model';
import { TripItineraryComponent } from './trip-itinerary.component';
import { TripsApiService } from '../services/trips-api.service';

function trip(overrides: Partial<Trip> = {}): Trip {
  return {
    id: 'trip-1',
    title: 'Delhi to Rishikesh',
    sourceName: 'Delhi',
    sourceLatitude: 28.6,
    sourceLongitude: 77.2,
    destinationName: 'Rishikesh',
    destinationLatitude: 30.08,
    destinationLongitude: 78.26,
    startDate: '2027-02-10',
    endDate: '2027-02-11',
    travellerCount: 1,
    travelMode: 'CAR',
    interests: [],
    preferences: [],
    status: 'GENERATED',
    coverage: 'PARTIAL',
    destinationGuide: { slug: 'rishikesh', name: 'Rishikesh' },
    days: [
      {
        id: 'day-1',
        dayNumber: 1,
        date: '2027-02-10',
        title: 'Rishikesh',
        overnightLocation: 'Rishikesh',
        activities: [
          { id: 'a-1', title: 'Breakfast', activityType: 'MEAL', startTime: '08:30', sortOrder: 1 },
          {
            id: 'a-2',
            title: 'Museum',
            activityType: 'SIGHTSEEING',
            startTime: '10:00',
            sortOrder: 2,
            warning: 'Closed on Mondays',
            latitude: 30.1,
            longitude: 78.3,
            place: { id: 'p-1', slug: 'museum', name: 'Museum', category: 'ATTRACTION', destinationSlug: 'rishikesh', hasPage: true }
          }
        ]
      },
      { id: 'day-2', dayNumber: 2, date: '2027-02-11', title: 'Drive home', activities: [] }
    ],
    ...overrides
  };
}

describe('TripItineraryComponent', () => {
  const tripsApi = {
    reorderDay: vi.fn(() => of(trip())),
    updateActivity: vi.fn(() => of(trip())),
    removeActivity: vi.fn(() => of(trip())),
    regenerateDay: vi.fn(() => of(trip())),
    addActivity: vi.fn(() => of(trip()))
  };

  function render(value: Trip, editable: boolean) {
    TestBed.configureTestingModule({
      imports: [TripItineraryComponent],
      providers: [
        provideRouter([]),
        { provide: TripsApiService, useValue: tripsApi },
        { provide: ContentApiService, useValue: { destinationPlaces: () => of({ items: [] }) } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } }
      ]
    });
    const fixture = TestBed.createComponent(TripItineraryComponent);
    fixture.componentRef.setInput('trip', value);
    fixture.componentRef.setInput('editable', editable);
    fixture.detectChanges();
    return { fixture, element: fixture.nativeElement as HTMLElement, component: fixture.componentInstance as any };
  }

  beforeEach(() => Object.values(tripsApi).forEach((mock) => mock.mockClear()));

  it('shows the night stop, opening-hours warnings, a coverage note and a link to the place', () => {
    const { element } = render(trip(), false);

    expect(element.textContent).toContain('Night in Rishikesh');
    expect(element.querySelector('.stop__warning')?.textContent).toContain('Closed on Mondays');
    expect(element.querySelector('.coverage')?.textContent).toContain('only have a few curated places');
    expect(element.querySelector('a[href="/destinations/rishikesh/places/museum"]')).toBeTruthy();
  });

  it('hides every editing control on a shared (read-only) view', () => {
    const { element } = render(trip(), false);

    expect(element.querySelector('.stop__handle')).toBeNull();
    expect(element.textContent).not.toContain('Add a stop');
  });

  it('saves a new order and hands the updated trip to the page', () => {
    const { component } = render(trip(), true);
    const emitted: Trip[] = [];
    component.tripChange.subscribe((value: Trip) => emitted.push(value));

    component.move(component.days()[0], 1, -1);

    expect(tripsApi.reorderDay).toHaveBeenCalledWith('trip-1', 1, ['a-2', 'a-1']);
    expect(emitted).toHaveLength(1);
  });

  it('moves a stop to another day by number', () => {
    const { component } = render(trip(), true);

    component.moveToDay(component.days()[0].activities[1], 2);

    expect(tripsApi.updateActivity).toHaveBeenCalledWith('trip-1', 'a-2', { dayNumber: 2 });
  });
});
