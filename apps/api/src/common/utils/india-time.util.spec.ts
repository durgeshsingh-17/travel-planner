import { describe, expect, it } from 'vitest';

import { indiaClock, openState } from './india-time.util';

// 2026-09-28 is a Monday. 04:30 UTC = 10:00 IST.
const mondayTenAmIst = new Date('2026-09-28T04:30:00Z');

const weekdays = (opensAt: string, closesAt: string) =>
  Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    opensAt,
    closesAt,
    isClosed: false
  }));

describe('indiaClock', () => {
  it('uses India time regardless of the server time zone', () => {
    expect(indiaClock(mondayTenAmIst)).toEqual({ dayOfWeek: 1, minutes: 600, month: 9 });
    // 20:00 UTC Sunday is 01:30 IST Monday.
    expect(indiaClock(new Date('2026-09-27T20:00:00Z'))).toMatchObject({ dayOfWeek: 1, minutes: 90 });
  });
});

describe('openState', () => {
  it('reports open with the closing time', () => {
    expect(openState(weekdays('09:00', '17:00'), mondayTenAmIst)).toEqual({
      status: 'OPEN',
      closesAt: '17:00'
    });
  });

  it('reports opens-later and closed-now around the window', () => {
    expect(openState(weekdays('11:00', '17:00'), mondayTenAmIst)).toEqual({
      status: 'OPENS_LATER',
      opensAt: '11:00'
    });
    expect(openState(weekdays('06:00', '09:30'), mondayTenAmIst)).toEqual({ status: 'CLOSED_NOW' });
  });

  it('handles weekly closures and missing data', () => {
    const closedMondays = weekdays('09:00', '17:00').map((timing) =>
      timing.dayOfWeek === 1 ? { ...timing, isClosed: true } : timing
    );
    expect(openState(closedMondays, mondayTenAmIst)).toEqual({ status: 'CLOSED_TODAY' });
    expect(openState([], mondayTenAmIst)).toEqual({ status: 'UNKNOWN' });
  });

  it('handles places that close after midnight', () => {
    // Monday 01:30 IST, Sunday hours 18:00–02:00.
    const lateNight = [{ dayOfWeek: 0, opensAt: '18:00', closesAt: '02:00', isClosed: false }];
    expect(openState(lateNight, new Date('2026-09-27T20:00:00Z'))).toEqual({
      status: 'OPEN',
      closesAt: '02:00'
    });
  });
});
