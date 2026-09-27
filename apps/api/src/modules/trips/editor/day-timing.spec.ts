import { TripActivityType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { TimedActivity, retimeDay } from './day-timing';

function stop(overrides: Partial<TimedActivity> & { title?: string } = {}): TimedActivity & { title?: string } {
  return {
    activityType: TripActivityType.SIGHTSEEING,
    startTime: null,
    endTime: null,
    durationMinutes: 60,
    latitude: 30.1,
    longitude: 78.3,
    distanceFromPreviousKm: null,
    travelTimeFromPreviousMinutes: null,
    ...overrides
  };
}

describe('retimeDay', () => {
  it('chains stops with local travel time between them', () => {
    const [first, second] = retimeDay([
      stop({ startTime: '09:30' }),
      stop({ latitude: 30.15 })
    ]);

    expect(first.startTime).toBe('09:30');
    expect(first.endTime).toBe('10:30');
    expect(second.distanceFromPreviousKm).toBeGreaterThan(5);
    // ~7 km at 25 km/h: about 17 minutes after the first stop ends.
    expect(second.startTime).toBe('10:47');
  });

  it('keeps meals at their slot unless the day runs into them', () => {
    const dinner = stop({ activityType: TripActivityType.MEAL, startTime: '19:30', durationMinutes: 75 });
    const early = retimeDay([stop({ startTime: '09:30' }), dinner]);
    const late = retimeDay([stop({ startTime: '09:30', durationMinutes: 11 * 60 }), dinner]);

    expect(early[1].startTime).toBe('19:30');
    // The 10-minute minimum hop pushes it to 20:40.
    expect(late[1].startTime).toBe('20:40');
  });

  it('does not add local travel before a long drive', () => {
    const drive = stop({ activityType: TripActivityType.TRAVEL, durationMinutes: 300, distanceFromPreviousKm: 240, travelTimeFromPreviousMinutes: 270, latitude: 28.6, longitude: 77.2 });
    const [, travel] = retimeDay([stop({ startTime: '09:00' }), drive]);

    expect(travel.startTime).toBe('10:00');
    expect(travel.distanceFromPreviousKm).toBe(240);
  });

  it('pins a stop to a chosen time and flows the rest after it', () => {
    const timed = retimeDay([stop({ startTime: '09:30' }), stop(), stop()], { anchor: { index: 1, startTime: '14:00' } });

    expect(timed[1].startTime).toBe('14:00');
    expect(timed[2].startTime).toBe('15:10');
  });

  it('assumes a short gap before a custom stop with no location', () => {
    const [, custom] = retimeDay([stop({ startTime: '09:30' }), stop({ latitude: null, longitude: null })]);

    expect(custom.startTime).toBe('10:45');
    expect(custom.distanceFromPreviousKm).toBeNull();
  });

  it('starts the day at the original start time when the order changes', () => {
    const dinner = stop({ activityType: TripActivityType.MEAL, startTime: '19:30' });
    const [first] = retimeDay([stop({ startTime: '10:00' }), dinner].reverse(), { dayStart: '10:00' });

    expect(first.startTime).toBe('10:00');
  });
});
