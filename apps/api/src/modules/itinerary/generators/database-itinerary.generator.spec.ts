import { PlaceCategory, TravelMode } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { DatabaseItineraryGenerator } from './database-itinerary.generator';
import { ItineraryGeneratorInput } from '../contracts/itinerary-generator.contract';
import { RouteLeg } from '../../routing/routing.service';

type Timing = { dayOfWeek: number; opensAt: string | null; closesAt: string | null; isClosed: boolean };

function place(index: number, overrides: Record<string, unknown> = {}) {
  return {
    id: `place-${index}`,
    name: `Place ${index}`,
    category: PlaceCategory.ATTRACTION,
    description: `Description ${index}`,
    latitude: 30.0869 + index / 1000,
    longitude: 78.2676,
    averageVisitMinutes: 60,
    timeRequiredMinMinutes: null,
    estimatedCost: 100,
    entryFeeIndian: null,
    isFree: false,
    rating: 4 + index / 100,
    rankInDestination: null,
    timings: [] as Timing[],
    tags: [] as { tag: { slug: string } }[],
    ...overrides
  };
}

const shortDrive: RouteLeg = { distanceKm: 240, durationMinutes: 300, polyline: null, provider: 'osrm', estimated: false };

function generator(options: { places?: ReturnType<typeof place>[]; leg?: RouteLeg; matched?: boolean; locations?: unknown[] } = {}) {
  const prisma = {
    destination: {
      findMany: vi.fn().mockResolvedValue(
        options.matched === false ? [] : [{ id: 'destination-1', name: 'Rishikesh', latitude: 30.0869, longitude: 78.2676 }]
      )
    },
    place: { findMany: vi.fn().mockResolvedValue(options.places ?? []) },
    location: { findMany: vi.fn().mockResolvedValue(options.locations ?? []) }
  };
  const routing = { route: vi.fn().mockResolvedValue(options.leg ?? shortDrive) };

  return new DatabaseItineraryGenerator(prisma as never, routing as never);
}

const input: ItineraryGeneratorInput = {
  tripId: 'trip-1',
  sourceName: 'Delhi',
  sourceLatitude: 28.6139,
  sourceLongitude: 77.209,
  destinationName: 'Rishikesh',
  destinationLatitude: 30.0869,
  destinationLongitude: 78.2676,
  startDate: '2026-10-10',
  endDate: '2026-10-16',
  travellerCount: 2,
  travelMode: TravelMode.CAR,
  interests: ['Nature'],
  preferences: [],
  pace: 'BALANCED'
};

const places = (count: number) => Array.from({ length: count }, (_, index) => place(index + 1));

type Plan = Awaited<ReturnType<DatabaseItineraryGenerator['generateTripPlan']>>;

function sightIds(plan: Plan) {
  return plan.days.flatMap((day) =>
    day.activities.filter((activity) => activity.placeId && activity.activityType !== 'MEAL').map((activity) => activity.placeId!)
  );
}

describe('DatabaseItineraryGenerator', () => {
  it('never repeats a stop when there are more days than places', async () => {
    const plan = await generator({ places: places(4) }).generateTripPlan(input);
    const ids = sightIds(plan);

    expect(plan.days).toHaveLength(7);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(4);
    expect(plan.destinationId).toBe('destination-1');
  });

  it('turns days without places into free days and reports partial coverage', async () => {
    const plan = await generator({ places: places(2) }).generateTripPlan(input);

    expect(plan.days.some((day) => day.title.endsWith('free day'))).toBe(true);
    expect(plan.coverage).toBe('PARTIAL');
  });

  it('reports no coverage when no destination guide matches', async () => {
    const plan = await generator({ matched: false }).generateTripPlan(input);

    expect(plan.coverage).toBe('NONE');
    expect(plan.destinationId).toBeNull();
    expect(sightIds(plan)).toHaveLength(0);
  });

  it.each([
    ['RELAXED', 2],
    ['BALANCED', 3],
    ['PACKED', 4]
  ] as const)('caps a %s day at %i sights', async (pace, cap) => {
    const plan = await generator({ places: places(40) }).generateTripPlan({ ...input, pace });
    const counts = plan.days.map((day) => day.activities.filter((activity) => activity.placeId && activity.activityType !== 'MEAL').length);

    counts.forEach((count) => expect(count).toBeLessThanOrEqual(cap));
    expect(Math.max(...counts)).toBe(cap);
  });

  it('splits a long drive with overnight halts at towns along the route', async () => {
    const leg: RouteLeg = { distanceKm: 900, durationMinutes: 1200, polyline: null, provider: 'osrm', estimated: false };
    const plan = await generator({
      places: places(6),
      leg,
      locations: [
        { name: 'Far Town', latitude: 25, longitude: 70 },
        { name: 'Town A', latitude: 29.1, longitude: 77.55 },
        { name: 'Town B', latitude: 29.6, longitude: 77.9 }
      ]
    }).generateTripPlan({ ...input, endDate: '2026-10-15' });

    expect(plan.days.slice(0, 3).map((day) => day.overnightLocation)).toEqual(['Town A', 'Town B', 'Rishikesh']);
    expect(plan.days[3].overnightLocation).toBe('Town B');
    expect(plan.days[5].overnightLocation).toBeUndefined();
    // No single day drives longer than the car limit.
    plan.days.forEach((day) =>
      day.activities
        .filter((activity) => activity.activityType === 'TRAVEL')
        .forEach((activity) => expect(activity.travelTimeFromPreviousMinutes).toBeLessThanOrEqual(9 * 60))
    );
  });

  it('respects a shorter personal drive limit', async () => {
    const plan = await generator({ places: places(6) }).generateTripPlan({ ...input, maxDriveHoursPerDay: 3 });

    expect(plan.days[0].overnightLocation).not.toBe('Rishikesh');
    expect(plan.days[1].overnightLocation).toBe('Rishikesh');
  });

  it('skips places on the days they are closed', async () => {
    const closedAllWeek = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, opensAt: null, closesAt: null, isClosed: true }));
    const plan = await generator({ places: [place(1, { rating: 5, timings: closedAllWeek }), ...places(3).slice(1)] }).generateTripPlan(input);

    expect(sightIds(plan)).not.toContain('place-1');
  });

  it('does not schedule a visit that would end after closing time', async () => {
    const closesEarly = Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, opensAt: '06:00', closesAt: '09:45', isClosed: false }));
    const plan = await generator({ places: [place(1, { rating: 5, timings: closesEarly }), ...places(3).slice(1)] }).generateTripPlan(input);

    expect(sightIds(plan)).not.toContain('place-1');
  });

  it('puts meals at real food stops near the day', async () => {
    const cafe = place(90, { name: 'River Cafe', category: PlaceCategory.CAFE, estimatedCost: 300, latitude: 30.09 });
    const plan = await generator({ places: [...places(6), cafe] }).generateTripPlan(input);
    const meals = plan.days.flatMap((day) => day.activities).filter((activity) => activity.activityType === 'MEAL');

    expect(meals.filter((meal) => meal.title === 'Lunch at River Cafe' || meal.title === 'Dinner at River Cafe')).toHaveLength(1);
    expect(meals.some((meal) => meal.title === 'Dinner nearby')).toBe(true);
  });

  it('re-plans one day using only places not already on other days', async () => {
    const day = await generator({ places: places(10) }).generateDay(
      { ...input, excludePlaceIds: ['place-1', 'place-2', 'place-3'] },
      3
    );
    const ids = day!.activities.map((activity) => activity.placeId).filter(Boolean);

    expect(day!.dayNumber).toBe(3);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).not.toContain('place-1');
    // The best remaining places go to this day, not to earlier days.
    expect(ids).toContain('place-10');
  });

  it('counts entry fees but not meals as planned activity cost', async () => {
    const plan = await generator({ places: places(3) }).generateTripPlan({ ...input, endDate: '2026-10-12' });
    const fees = plan.days.flatMap((day) => day.activities).filter((activity) => activity.activityType !== 'MEAL').reduce((sum, activity) => sum + (activity.estimatedCost ?? 0), 0);

    expect(plan.days.flatMap((day) => day.activities).some((activity) => activity.activityType === 'MEAL' && (activity.estimatedCost ?? 0) > 0)).toBe(true);
    expect(plan.activityCost).toBe(fees);
  });
});
