import { DailyTiming, parseClockTime } from './india-time.util';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Explains why a planned visit clashes with a place's opening hours, or null
 * when it fits (or the hours are unknown). `date` is YYYY-MM-DD.
 */
export function openingHoursWarning(
  timings: DailyTiming[],
  date: string,
  startTime: string | null,
  durationMinutes: number | null
): string | null {
  if (!timings.length || !startTime) {
    return null;
  }

  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  const timing = timings.find((entry) => entry.dayOfWeek === dayOfWeek);

  if (!timing) {
    return null;
  }

  if (timing.isClosed || !timing.opensAt || !timing.closesAt) {
    return `Closed on ${WEEKDAYS[dayOfWeek]}s`;
  }

  const start = parseClockTime(startTime);
  const opens = parseClockTime(timing.opensAt);
  let closes = parseClockTime(timing.closesAt);
  closes = closes <= opens ? closes + 24 * 60 : closes;

  if (start < opens) {
    return `Opens at ${timing.opensAt}`;
  }

  if (start + (durationMinutes ?? 60) > closes) {
    return `Closes at ${timing.closesAt}, before this visit ends`;
  }

  return null;
}
