const INDIA_TIME_ZONE = 'Asia/Kolkata';

export interface IndiaClock {
  /** 0 = Sunday … 6 = Saturday */
  dayOfWeek: number;
  /** Minutes since midnight. */
  minutes: number;
  /** 1 = January … 12 = December */
  month: number;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Wall-clock time in India, independent of the server's time zone. */
export function indiaClock(at: Date = new Date()): IndiaClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: INDIA_TIME_ZONE,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    month: 'numeric',
    hourCycle: 'h23'
  }).formatToParts(at);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? '0';

  return {
    dayOfWeek: WEEKDAYS.indexOf(part('weekday')),
    minutes: Number(part('hour')) * 60 + Number(part('minute')),
    month: Number(part('month'))
  };
}

export function parseClockTime(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export interface DailyTiming {
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  isClosed: boolean;
}

export type OpenState =
  | { status: 'UNKNOWN' }
  | { status: 'CLOSED_TODAY' }
  | { status: 'OPEN'; closesAt: string }
  | { status: 'OPENS_LATER'; opensAt: string }
  | { status: 'CLOSED_NOW' };

/**
 * Open/closed state for "right now" in India. A closing time earlier than the
 * opening time means the place closes after midnight.
 */
export function openState(timings: DailyTiming[], at: Date = new Date()): OpenState {
  if (timings.length === 0) {
    return { status: 'UNKNOWN' };
  }

  const clock = indiaClock(at);
  const today = timings.find((timing) => timing.dayOfWeek === clock.dayOfWeek);
  const yesterday = timings.find((timing) => timing.dayOfWeek === (clock.dayOfWeek + 6) % 7);

  // Still inside yesterday's past-midnight window?
  if (yesterday && !yesterday.isClosed && yesterday.opensAt && yesterday.closesAt) {
    const opens = parseClockTime(yesterday.opensAt);
    const closes = parseClockTime(yesterday.closesAt);

    if (closes < opens && clock.minutes < closes) {
      return { status: 'OPEN', closesAt: yesterday.closesAt };
    }
  }

  if (!today) {
    return { status: 'UNKNOWN' };
  }

  if (today.isClosed || !today.opensAt || !today.closesAt) {
    return { status: 'CLOSED_TODAY' };
  }

  const opens = parseClockTime(today.opensAt);
  const closes = parseClockTime(today.closesAt);
  const overnight = closes < opens;

  if (clock.minutes < opens) {
    return { status: 'OPENS_LATER', opensAt: today.opensAt };
  }

  if (overnight || clock.minutes < closes) {
    return { status: 'OPEN', closesAt: today.closesAt };
  }

  return { status: 'CLOSED_NOW' };
}
