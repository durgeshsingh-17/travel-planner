import { TripActivityType } from '@prisma/client';

import { haversineKm } from '../../../common/utils/geo.util';
import { parseClockTime } from '../../../common/utils/india-time.util';

export interface TimedActivity {
  activityType: TripActivityType;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  latitude: number | null;
  longitude: number | null;
  distanceFromPreviousKm: number | null;
  travelTimeFromPreviousMinutes: number | null;
}

const DAY_START = 9 * 60 + 30;
const LOCAL_SPEED_KMH = 25;
/** Gap assumed before a stop we cannot place on the map. */
const UNKNOWN_GAP_MINUTES = 15;
/** Meals, check-out and long drives keep their slot unless the day runs over into it. */
const KEEPS_SLOT: TripActivityType[] = [TripActivityType.MEAL, TripActivityType.CHECK_OUT, TripActivityType.TRAVEL];

export function clock(minutes: number): string {
  const safe = Math.max(0, Math.min(Math.round(minutes), 23 * 60 + 59));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

export function localTravel(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): { km: number; minutes: number } {
  const km = Math.round(haversineKm(from.latitude, from.longitude, to.latitude, to.longitude) * 1.3 * 10) / 10;
  return { km, minutes: Math.max(10, Math.round((km / LOCAL_SPEED_KMH) * 60)) };
}

function span(activity: TimedActivity): number | null {
  if (!activity.startTime || !activity.endTime) return null;
  const minutes = parseClockTime(activity.endTime) - parseClockTime(activity.startTime);
  return minutes > 0 ? minutes : null;
}

/**
 * Re-times a day after the traveller changed it: each stop starts after the
 * previous one ends plus the local travel between them. The day starts at
 * `dayStart` (else the first stop's own time); `anchor` pins one stop to a
 * chosen time.
 */
export function retimeDay<T extends TimedActivity>(
  activities: T[],
  options: { anchor?: { index: number; startTime: string }; dayStart?: string | null } = {}
): T[] {
  const { anchor, dayStart } = options;
  let previousEnd: number | null = null;
  let previousPoint: { latitude: number; longitude: number } | null = null;

  return activities.map((activity, index) => {
    const duration = activity.durationMinutes ?? span(activity) ?? 60;
    const here = activity.latitude != null && activity.longitude != null ? { latitude: activity.latitude, longitude: activity.longitude } : null;
    let distance = activity.distanceFromPreviousKm;
    let travel = activity.travelTimeFromPreviousMinutes;

    if (activity.activityType !== TripActivityType.TRAVEL && previousEnd !== null) {
      if (here && previousPoint) {
        ({ km: distance, minutes: travel } = localTravel(previousPoint, here));
      } else {
        distance = null;
        travel = UNKNOWN_GAP_MINUTES;
      }
    }

    let start: number;

    if (anchor?.index === index) {
      start = parseClockTime(anchor.startTime);
    } else if (previousEnd === null) {
      const first = dayStart ?? activity.startTime;
      start = first ? parseClockTime(first) : DAY_START;
    } else {
      start = previousEnd + (activity.activityType === TripActivityType.TRAVEL ? 0 : (travel ?? 0));

      if (KEEPS_SLOT.includes(activity.activityType) && activity.startTime) {
        start = Math.max(start, parseClockTime(activity.startTime));
      }
    }

    previousEnd = start + duration;
    previousPoint = here ?? previousPoint;

    return {
      ...activity,
      startTime: clock(start),
      endTime: clock(start + duration),
      durationMinutes: duration,
      distanceFromPreviousKm: distance,
      travelTimeFromPreviousMinutes: travel
    };
  });
}
