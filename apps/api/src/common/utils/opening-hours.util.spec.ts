import { describe, expect, it } from 'vitest';

import { openingHoursWarning } from './opening-hours.util';

// 2026-10-05 is a Monday.
const hours = [
  { dayOfWeek: 1, opensAt: null, closesAt: null, isClosed: true },
  { dayOfWeek: 2, opensAt: '10:00', closesAt: '17:00', isClosed: false }
];

describe('openingHoursWarning', () => {
  it('flags closed days, early arrivals and visits that run past closing', () => {
    expect(openingHoursWarning(hours, '2026-10-05', '11:00', 60)).toBe('Closed on Mondays');
    expect(openingHoursWarning(hours, '2026-10-06', '09:00', 60)).toBe('Opens at 10:00');
    expect(openingHoursWarning(hours, '2026-10-06', '16:30', 60)).toMatch(/Closes at 17:00/);
  });

  it('stays quiet when the visit fits or hours are unknown', () => {
    expect(openingHoursWarning(hours, '2026-10-06', '11:00', 90)).toBeNull();
    expect(openingHoursWarning(hours, '2026-10-07', '11:00', 90)).toBeNull();
    expect(openingHoursWarning([], '2026-10-06', '09:00', 60)).toBeNull();
  });
});
