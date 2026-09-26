import { PlaceCategory, TravelMode } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { DatabaseItineraryGenerator } from './database-itinerary.generator';
import { TripDistanceService } from '../services/trip-distance.service';

function place(index: number) {
  return {
    id: `place-${index}`,
    destinationId: 'destination-1',
    name: `Place ${index}`,
    slug: `place-${index}`,
    category: PlaceCategory.ATTRACTION,
    description: `Description ${index}`,
    latitude: 30.1 + index / 1000,
    longitude: 78.3,
    averageVisitMinutes: 60,
    estimatedCost: 100,
    openingTime: null,
    closingTime: null,
    rating: 4 + index / 10,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

function generatorWithPlaces(count: number) {
  const prisma = {
    destination: {
      findFirst: vi.fn().mockResolvedValue({
        places: Array.from({ length: count }, (_, index) => place(index + 1))
      })
    }
  };

  return new DatabaseItineraryGenerator(new TripDistanceService(), prisma as never);
}

const input = {
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
  notes: 'Private note'
};

function placeIds(plan: Awaited<ReturnType<DatabaseItineraryGenerator['generateTripPlan']>>) {
  return plan.days.flatMap((day) =>
    day.activities.flatMap((activity) => (activity.placeId ? [activity.placeId] : []))
  );
}

describe('DatabaseItineraryGenerator', () => {
  it('never repeats a stop when there are more days than places', async () => {
    const plan = await generatorWithPlaces(4).generateTripPlan(input);
    const ids = placeIds(plan);

    expect(plan.days).toHaveLength(7);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(4);
  });

  it('turns days without places into free days', async () => {
    const plan = await generatorWithPlaces(2).generateTripPlan(input);
    const freeDays = plan.days.filter((day) => day.title.endsWith('free day'));

    expect(freeDays.length).toBeGreaterThan(0);
    freeDays.forEach((day) => expect(day.estimatedDistanceKm).toBe(0));
  });

  it('spreads places across middle days instead of front-loading them', async () => {
    const plan = await generatorWithPlaces(6).generateTripPlan(input);
    const middleDays = plan.days.slice(1, -1);
    const stopsPerDay = middleDays.map(
      (day) => day.activities.filter((activity) => activity.placeId).length
    );

    // 5 remaining places over 5 middle days = one each.
    expect(stopsPerDay).toEqual([1, 1, 1, 1, 1]);
  });

  it('caps a day at three stops', async () => {
    const plan = await generatorWithPlaces(30).generateTripPlan(input);

    plan.days.forEach((day) =>
      expect(day.activities.filter((activity) => activity.placeId).length).toBeLessThanOrEqual(3)
    );
  });

  it('does not copy private notes into generated text', async () => {
    const plan = await generatorWithPlaces(3).generateTripPlan(input);

    expect(JSON.stringify(plan)).not.toContain('Private note');
  });
});
