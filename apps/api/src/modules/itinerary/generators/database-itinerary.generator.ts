import { Injectable } from '@nestjs/common';
import { PlaceCategory, PlanCoverage, Prisma, TravelMode, TravelPace, TripActivityType } from '@prisma/client';

import {
  GeneratedTripActivity,
  GeneratedTripDay,
  GeneratedTripPlan,
  ItineraryGenerator,
  ItineraryGeneratorInput
} from '../contracts/itinerary-generator.contract';
import { LatLng, decodePolyline, pointAlong } from '../../../common/utils/polyline.util';
import { PrismaService } from '../../../database/prisma.service';
import { RouteLeg, RoutingService } from '../../routing/routing.service';
import { decimalToNumber } from '../../../common/utils/number.util';
import { haversineKm } from '../../../common/utils/geo.util';
import { parseClockTime } from '../../../common/utils/india-time.util';
import { toDateOnly, toIsoDate } from '../../../common/utils/date.util';

const STOPS_PER_DAY: Record<TravelPace, number> = { RELAXED: 2, BALANCED: 3, PACKED: 4 };
const MAX_DRIVE_HOURS: Record<TravelMode, number> = { CAR: 9, BIKE: 6, BUS: 12, FLIGHT: 24 };
const SIGHT_CATEGORIES: PlaceCategory[] = [PlaceCategory.ATTRACTION, PlaceCategory.VIEWPOINT, PlaceCategory.ACTIVITY];
const FOOD_CATEGORIES: PlaceCategory[] = [PlaceCategory.FOOD, PlaceCategory.CAFE];
const DAY_START = 9 * 60 + 30;
const DAY_END = 18 * 60 + 30;
const DEPART_TIME = 7 * 60;
const LOCAL_SPEED_KMH = 25;
/** How far we will go for a meal stop before suggesting "somewhere nearby" instead. */
const MEAL_RADIUS_KM = 6;

const placeInclude = {
  timings: true,
  tags: { include: { tag: { select: { slug: true } } } }
} satisfies Prisma.PlaceInclude;

type PlaceForPlan = Prisma.PlaceGetPayload<{ include: typeof placeInclude }>;

interface Slot {
  start: number;
  end: number;
  dayOfWeek: number;
}

interface DayContext {
  input: ItineraryGeneratorInput;
  sights: PlaceForPlan[];
  food: PlaceForPlan[];
  used: Set<string>;
  hotel: LatLng;
}

/** Minutes since midnight to "HH:mm", clamped to the day. */
function clock(minutes: number): string {
  const safe = Math.max(0, Math.min(Math.round(minutes), 23 * 60 + 59));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function point(place: PlaceForPlan): LatLng {
  return { latitude: decimalToNumber(place.latitude) ?? 0, longitude: decimalToNumber(place.longitude) ?? 0 };
}

function localTravel(from: LatLng, to: LatLng): { km: number; minutes: number } {
  const km = Math.round(haversineKm(from.latitude, from.longitude, to.latitude, to.longitude) * 1.3 * 10) / 10;
  return { km, minutes: Math.max(10, Math.round((km / LOCAL_SPEED_KMH) * 60)) };
}

function visitMinutes(place: PlaceForPlan): number {
  return Math.max(30, Math.min(place.timeRequiredMinMinutes ?? place.averageVisitMinutes ?? 90, 300));
}

/**
 * Builds day-wise plans from published destination content:
 * real road time for the drive (with overnight halts on long drives),
 * nearby places grouped into the same day, opening hours respected,
 * meals at real food stops when there are any, and no repeated stops.
 */
@Injectable()
export class DatabaseItineraryGenerator implements ItineraryGenerator {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routing: RoutingService
  ) {}

  async generateTripPlan(input: ItineraryGeneratorInput): Promise<GeneratedTripPlan> {
    const { outbound, destinationId, places, days, dayCount } = await this.build(input);
    const sightsUsed = days.flatMap((day) => day.activities).filter((activity) => activity.placeId && activity.activityType !== 'MEAL').length;
    const localKm = days.reduce(
      (sum, day) => sum + day.activities.filter((activity) => activity.activityType !== 'TRAVEL').reduce((km, activity) => km + (activity.distanceFromPreviousKm ?? 0), 0),
      0
    );

    return {
      estimatedDistanceKm: Math.round(outbound.distanceKm * 2 + (input.travelMode === 'FLIGHT' ? 0 : localKm)),
      estimatedDurationMinutes: outbound.durationMinutes * 2,
      outbound,
      coverage: this.coverage(places.length, sightsUsed, dayCount, input.pace),
      destinationId,
      // Meals are covered by the food allowance in the cost estimate.
      activityCost: days.reduce(
        (sum, day) => sum + day.activities.filter((activity) => activity.activityType !== 'MEAL').reduce((cost, activity) => cost + (activity.estimatedCost ?? 0), 0),
        0
      ),
      days
    };
  }

  /**
   * Plans one day again, using only places not in `excludePlaceIds`
   * (the stops already on the other days). Other days are not touched.
   */
  async generateDay(input: ItineraryGeneratorInput, dayNumber: number): Promise<GeneratedTripDay | null> {
    const { days } = await this.build(input, dayNumber);
    return days.find((day) => day.dayNumber === dayNumber) ?? null;
  }

  private async build(input: ItineraryGeneratorInput, only?: number) {
    const source = { latitude: input.sourceLatitude, longitude: input.sourceLongitude };
    const destinationPoint = { latitude: input.destinationLatitude, longitude: input.destinationLongitude };
    const outbound = await this.routing.route(source, destinationPoint, input.travelMode);
    const dayCount = this.dayCount(input.startDate, input.endDate);
    const { destinationId, places } = await this.destinationPlaces(input);
    const exclude = new Set(input.excludePlaceIds ?? []);
    const ranked = [...places]
      .filter((place) => !exclude.has(place.id))
      .sort((a, b) => this.score(b, input) - this.score(a, input));
    const context: DayContext = {
      input,
      sights: ranked.filter((place) => SIGHT_CATEGORIES.includes(place.category)),
      food: ranked.filter((place) => FOOD_CATEGORIES.includes(place.category)),
      used: new Set(),
      hotel: destinationPoint
    };
    // When re-planning a single day, other days must not use up places.
    const exhausted: DayContext = { ...context, used: new Set(ranked.map((place) => place.id)) };
    const contextFor = (dayNumber: number) => (only === undefined || only === dayNumber ? context : exhausted);

    const days = dayCount === 1
      ? [this.dayTrip(context, outbound)]
      : await this.multiDay(contextFor, outbound, dayCount, source, destinationPoint);

    return { outbound, destinationId, places, days, dayCount };
  }

  // ───────────────────────── Trip shapes ─────────────────────────

  private dayTrip(context: DayContext, outbound: RouteLeg): GeneratedTripDay {
    const { input } = context;
    const date = this.dateFor(input.startDate, 1);
    const arrival = DEPART_TIME + outbound.durationMinutes;
    const leaveBack = 24 * 60 - 60 - outbound.durationMinutes;
    const activities: GeneratedTripActivity[] = [
      this.travel(input, `Leave ${input.sourceName}`, DEPART_TIME, outbound, input.destinationName)
    ];

    if (leaveBack - arrival >= 120) {
      activities.push(...this.scheduleSights(context, { start: arrival + 30, end: Math.min(leaveBack - 15, DAY_END), dayOfWeek: this.weekday(date) }, STOPS_PER_DAY[input.pace], true));
    }

    activities.push(this.travel(input, `Head back to ${input.sourceName}`, Math.max(leaveBack, arrival + 60), outbound, input.sourceName, true));

    return this.day(1, date, `${input.sourceName} to ${input.destinationName} day trip`, activities, {
      description: leaveBack - arrival < 120
        ? 'This is a long drive for a single day. Consider adding a night so you have time to explore.'
        : 'A same-day round trip with the top stops that fit between the drives.'
    });
  }

  private async multiDay(
    contextFor: (dayNumber: number) => DayContext,
    outbound: RouteLeg,
    dayCount: number,
    source: LatLng,
    destination: LatLng
  ): Promise<GeneratedTripDay[]> {
    const { input } = contextFor(0);
    const maxDrive = (input.maxDriveHoursPerDay ?? MAX_DRIVE_HOURS[input.travelMode]) * 60;
    const wanted = input.travelMode === 'FLIGHT' ? 1 : Math.max(1, Math.ceil(outbound.durationMinutes / maxDrive));
    // Keep at least one travel day each way; never plan more travel than the trip allows.
    const travelDays = Math.max(1, Math.min(wanted, Math.floor(dayCount / 2)));
    const tooLong = wanted > travelDays;
    const halts = await this.halts(outbound, travelDays, source, destination);
    const segment = Math.round(outbound.durationMinutes / travelDays);
    const segmentKm = Math.round(outbound.distanceKm / travelDays);
    const leg = (minutes: number, km: number): RouteLeg => ({ ...outbound, durationMinutes: minutes, distanceKm: km });
    const days: GeneratedTripDay[] = [];

    // Outbound travel days.
    for (let index = 0; index < travelDays; index += 1) {
      const dayNumber = index + 1;
      const date = this.dateFor(input.startDate, dayNumber);
      const context = contextFor(dayNumber);
      const from = index === 0 ? input.sourceName : halts[index - 1];
      const to = index === travelDays - 1 ? input.destinationName : halts[index];
      const activities = [this.travel(input, index === 0 ? `Leave ${input.sourceName}` : `Continue to ${to}`, DEPART_TIME, leg(segment, segmentKm), to)];
      const arrival = DEPART_TIME + segment + this.breakMinutes(segment);

      if (index === travelDays - 1 && arrival <= 15 * 60) {
        activities.push(...this.scheduleSights(context, { start: arrival + 45, end: DAY_END, dayOfWeek: this.weekday(date) }, 1, false));
      }

      if (index === travelDays - 1) {
        activities.push(this.dinner(context, context.hotel));
      }

      days.push(
        this.day(dayNumber, date, `${from} to ${to}`, activities, {
          overnightLocation: to,
          description: tooLong && index === 0
            ? `The drive is about ${Math.round(outbound.durationMinutes / 60)} hours each way. Add days to break it up.`
            : index < travelDays - 1
              ? `Long drive: overnight halt in ${to} to keep driving under ${Math.round(maxDrive / 60)} hours a day.`
              : `Arrive in ${input.destinationName} and settle in.`
        })
      );
    }

    // Days at the destination.
    const firstReturnDay = dayCount - travelDays + 1;

    for (let dayNumber = travelDays + 1; dayNumber < firstReturnDay; dayNumber += 1) {
      const date = this.dateFor(input.startDate, dayNumber);
      const context = contextFor(dayNumber);
      const sights = this.scheduleSights(context, { start: DAY_START, end: DAY_END, dayOfWeek: this.weekday(date) }, STOPS_PER_DAY[input.pace], true);
      const activities = [this.breakfast(input), ...(sights.length ? sights : [this.freeTime()]), this.dinner(context, context.hotel)];
      const names = sights.filter((activity) => activity.placeId && activity.activityType !== 'MEAL').map((activity) => activity.title);

      days.push(
        this.day(dayNumber, date, names.length ? `${input.destinationName}: ${names.join(' + ')}` : `${input.destinationName}: free day`, activities, {
          overnightLocation: input.destinationName,
          description: names.length
            ? this.describe(input, 'Nearby stops grouped together, timed around opening hours.')
            : 'A free day to explore at your own pace. We have no more curated stops for this destination yet.'
        })
      );
    }

    // Return travel days (halts in reverse).
    const returnHalts = [...halts].reverse();

    for (let index = 0; index < travelDays; index += 1) {
      const dayNumber = firstReturnDay + index;
      const date = this.dateFor(input.startDate, dayNumber);
      const context = contextFor(dayNumber);
      const from = index === 0 ? input.destinationName : returnHalts[index - 1];
      const to = index === travelDays - 1 ? input.sourceName : returnHalts[index];
      const activities: GeneratedTripActivity[] = [];
      let depart = DEPART_TIME + 30;

      if (index === 0) {
        activities.push(this.activity('Check out', TripActivityType.CHECK_OUT, { startTime: clock(8 * 60 + 30), durationMinutes: 30 }));
        depart = 9 * 60;

        // A short final drive leaves time for one last stop in the morning.
        if (segment <= 5 * 60) {
          const morning = this.scheduleSights(context, { start: 9 * 60, end: 11 * 60 + 45, dayOfWeek: this.weekday(date) }, 1, false);
          activities.push(...morning);
          depart = morning.length ? 12 * 60 : depart;
        }
      }

      activities.push(this.travel(input, index === travelDays - 1 ? `Drive back to ${to}` : `Drive to ${to}`, depart, leg(segment, segmentKm), to));
      days.push(
        this.day(dayNumber, date, `${from} to ${to}`, activities, {
          overnightLocation: index === travelDays - 1 ? undefined : to,
          description: index === travelDays - 1 ? 'Return journey with buffer for breaks and traffic.' : `Overnight halt in ${to} on the way back.`
        })
      );
    }

    return days;
  }

  // ───────────────────────── Scheduling ─────────────────────────

  /**
   * Fills a time window with sights, nearest-first after the best-ranked
   * opener, skipping places that are closed or would close before we finish.
   * Adds lunch at a real food stop when the window spans midday.
   */
  private scheduleSights(context: DayContext, slot: Slot, maxStops: number, withLunch: boolean): GeneratedTripActivity[] {
    const activities: GeneratedTripActivity[] = [];
    let now = slot.start;
    let here = context.hotel;
    let stops = 0;
    let hadLunch = !withLunch || slot.end < 13 * 60 || slot.start > 14 * 60;

    while (stops < maxStops) {
      if (!hadLunch && now >= 12 * 60 + 30) {
        activities.push(this.lunch(context, here, now));
        now += 60;
        hadLunch = true;
      }

      const next = this.pickNext(context, here, now, slot);

      if (!next) {
        break;
      }

      const { place, arrive, travel } = next;
      const duration = visitMinutes(place);
      activities.push(
        this.activity(place.name, this.activityType(place.category), {
          placeId: place.id,
          description: place.description,
          startTime: clock(arrive),
          endTime: clock(arrive + duration),
          durationMinutes: duration,
          latitude: point(place).latitude,
          longitude: point(place).longitude,
          estimatedCost: Math.round((decimalToNumber(place.isFree ? 0 : place.estimatedCost ?? place.entryFeeIndian) ?? 0) * context.input.travellerCount),
          distanceFromPreviousKm: travel.km,
          travelTimeFromPreviousMinutes: travel.minutes
        })
      );
      context.used.add(place.id);
      now = arrive + duration;
      here = point(place);
      stops += 1;
    }

    if (!hadLunch && activities.length && now >= 12 * 60) {
      activities.push(this.lunch(context, here, now));
    }

    return activities;
  }

  private pickNext(context: DayContext, here: LatLng, now: number, slot: Slot) {
    let best: { place: PlaceForPlan; arrive: number; travel: { km: number; minutes: number }; value: number } | null = null;

    for (const [rank, place] of context.sights.entries()) {
      if (context.used.has(place.id)) continue;

      const travel = localTravel(here, point(place));
      const window = this.openWindow(place, slot.dayOfWeek);

      if (!window) continue;

      let arrive = now + travel.minutes;

      if (arrive < window.opens) {
        // Worth waiting a little for a good place, not half the morning.
        if (window.opens - arrive > 60) continue;
        arrive = window.opens;
      }

      const finish = arrive + visitMinutes(place);

      if (finish > Math.min(window.closes, slot.end + 30)) continue;

      // Earlier in the ranking is better; distance from where we are costs.
      const value = -rank - travel.km * 0.35;

      if (!best || value > best.value) {
        best = { place, arrive, travel, value };
      }
    }

    return best;
  }

  /** Opening window in minutes for a weekday. Unknown hours count as daytime. */
  private openWindow(place: PlaceForPlan, dayOfWeek: number): { opens: number; closes: number } | null {
    if (!place.timings.length) {
      return { opens: 6 * 60, closes: 20 * 60 };
    }

    const timing = place.timings.find((entry) => entry.dayOfWeek === dayOfWeek);

    if (!timing) return { opens: 6 * 60, closes: 20 * 60 };
    if (timing.isClosed || !timing.opensAt || !timing.closesAt) return null;

    const opens = parseClockTime(timing.opensAt);
    const closes = parseClockTime(timing.closesAt);
    return { opens, closes: closes <= opens ? closes + 24 * 60 : closes };
  }

  private lunch(context: DayContext, near: LatLng, at: number): GeneratedTripActivity {
    return this.meal(context, near, at, 'Lunch', 60, 450);
  }

  private dinner(context: DayContext, near: LatLng): GeneratedTripActivity {
    return this.meal(context, near, 19 * 60 + 30, 'Dinner', 75, 650);
  }

  /** A meal at the nearest unused food or cafe stop within reach, or a generic one. */
  private meal(context: DayContext, near: LatLng, at: number, label: string, duration: number, perPerson: number): GeneratedTripActivity {
    const candidate = context.food
      .filter((place) => !context.used.has(place.id))
      .map((place) => ({ place, travel: localTravel(near, point(place)) }))
      .filter((entry) => entry.travel.km <= MEAL_RADIUS_KM)
      .sort((a, b) => a.travel.km - b.travel.km)[0];

    if (!candidate) {
      return this.activity(`${label} nearby`, TripActivityType.MEAL, {
        startTime: clock(at),
        endTime: clock(at + duration),
        durationMinutes: duration,
        estimatedCost: perPerson * context.input.travellerCount,
        description: 'Choose a local place that suits the group.'
      });
    }

    context.used.add(candidate.place.id);
    return this.activity(`${label} at ${candidate.place.name}`, TripActivityType.MEAL, {
      placeId: candidate.place.id,
      description: candidate.place.description,
      startTime: clock(at),
      endTime: clock(at + duration),
      durationMinutes: duration,
      latitude: point(candidate.place).latitude,
      longitude: point(candidate.place).longitude,
      estimatedCost: Math.round((decimalToNumber(candidate.place.estimatedCost) ?? perPerson) * context.input.travellerCount),
      distanceFromPreviousKm: candidate.travel.km,
      travelTimeFromPreviousMinutes: candidate.travel.minutes
    });
  }

  private breakfast(input: ItineraryGeneratorInput): GeneratedTripActivity {
    return this.activity('Breakfast', TripActivityType.MEAL, {
      startTime: clock(8 * 60 + 30),
      endTime: clock(9 * 60 + 15),
      durationMinutes: 45,
      estimatedCost: 250 * input.travellerCount
    });
  }

  private freeTime(): GeneratedTripActivity {
    return this.activity('Explore at your own pace', TripActivityType.ACTIVITY, {
      startTime: clock(10 * 60),
      durationMinutes: 360,
      description: 'Wander, rest, or revisit a favourite spot.'
    });
  }

  private travel(
    input: ItineraryGeneratorInput,
    title: string,
    start: number,
    leg: RouteLeg,
    to: string,
    back = false
  ): GeneratedTripActivity {
    const how = input.travelMode === 'FLIGHT' ? 'Fly' : input.travelMode === 'BUS' ? 'Take the bus' : input.travelMode === 'BIKE' ? 'Ride' : 'Drive';
    const minutes = leg.durationMinutes + this.breakMinutes(leg.durationMinutes);
    const hours = Math.round((leg.durationMinutes / 60) * 10) / 10;

    return this.activity(title, TripActivityType.TRAVEL, {
      description:
        input.travelMode === 'FLIGHT'
          ? `${how} to ${to}, including airport time (about ${hours} hours door to door).`
          : `${how} about ${Math.round(leg.distanceKm)} km to ${to}, roughly ${hours} hours${leg.estimated ? ' (estimated)' : ''} plus breaks.`,
      startTime: clock(start),
      endTime: clock(start + minutes),
      durationMinutes: minutes,
      latitude: back ? input.sourceLatitude : undefined,
      longitude: back ? input.sourceLongitude : undefined,
      distanceFromPreviousKm: Math.round(leg.distanceKm),
      travelTimeFromPreviousMinutes: leg.durationMinutes
    });
  }

  /** 15 minutes' rest for every two hours on the road. */
  private breakMinutes(driveMinutes: number): number {
    return Math.floor(driveMinutes / 120) * 15;
  }

  // ───────────────────────── Data ─────────────────────────

  private async destinationPlaces(input: ItineraryGeneratorInput): Promise<{ destinationId: string | null; places: PlaceForPlan[] }> {
    const nearby = 0.3;
    const candidates = await this.prisma.destination.findMany({
      where: {
        status: 'PUBLISHED',
        OR: [
          { name: { equals: input.destinationName, mode: 'insensitive' } },
          {
            latitude: { gte: input.destinationLatitude - nearby, lte: input.destinationLatitude + nearby },
            longitude: { gte: input.destinationLongitude - nearby, lte: input.destinationLongitude + nearby }
          }
        ]
      },
      select: { id: true, name: true, latitude: true, longitude: true }
    });
    // Same name wins; otherwise the closest guide within 20 km.
    const match =
      candidates.find((candidate) => candidate.name.toLowerCase() === input.destinationName.toLowerCase()) ??
      candidates
        .map((candidate) => ({
          candidate,
          km: haversineKm(input.destinationLatitude, input.destinationLongitude, decimalToNumber(candidate.latitude) ?? 0, decimalToNumber(candidate.longitude) ?? 0)
        }))
        .filter((entry) => entry.km <= 20)
        .sort((a, b) => a.km - b.km)[0]?.candidate;

    if (!match) {
      return { destinationId: null, places: [] };
    }

    return {
      destinationId: match.id,
      places: await this.prisma.place.findMany({ where: { destinationId: match.id, status: 'PUBLISHED' }, include: placeInclude })
    };
  }

  /** Nearest known town to each halt point along the route. */
  private async halts(outbound: RouteLeg, travelDays: number, source: LatLng, destination: LatLng): Promise<string[]> {
    if (travelDays <= 1) {
      return [];
    }

    const path = outbound.polyline ? decodePolyline(outbound.polyline) : [source, destination];
    const locations = await this.prisma.location.findMany({
      where: { isActive: true },
      select: { name: true, latitude: true, longitude: true }
    });

    return Array.from({ length: travelDays - 1 }, (_, index) => {
      const target = pointAlong(path, (index + 1) / travelDays);
      const nearest = locations
        .map((location) => ({
          name: location.name,
          km: haversineKm(target.latitude, target.longitude, decimalToNumber(location.latitude) ?? 0, decimalToNumber(location.longitude) ?? 0)
        }))
        .sort((a, b) => a.km - b.km)[0];

      return nearest && nearest.km <= 80 ? nearest.name : 'an overnight stop on the way';
    });
  }

  private score(place: PlaceForPlan, input: ItineraryGeneratorInput): number {
    const signals = [...input.interests, ...input.preferences].join(' ').toLowerCase();
    const tags = place.tags.map((entry) => entry.tag.slug);
    let score = decimalToNumber(place.rating) ?? 3.5;

    if (place.rankInDestination) score += Math.max(0, 4 - place.rankInDestination * 0.4);
    if (tags.some((tag) => signals.includes(tag.replace(/-/g, ' ')) || signals.includes(tag))) score += 2;
    if (/nature|mountain|peace|photography|scenic/.test(signals) && ([PlaceCategory.VIEWPOINT, PlaceCategory.ATTRACTION] as PlaceCategory[]).includes(place.category)) score += 1.5;
    if (/adventure|active|hike|rafting|trek/.test(signals) && place.category === PlaceCategory.ACTIVITY) score += 1.5;
    if (/culture|heritage|history|spiritual/.test(signals) && place.category === PlaceCategory.ATTRACTION) score += 1;
    if (/family|budget/.test(signals) && (place.isFree || !place.estimatedCost)) score += 0.5;

    return score;
  }

  private coverage(placeCount: number, sightsUsed: number, dayCount: number, pace: TravelPace): PlanCoverage {
    if (placeCount === 0 || sightsUsed === 0) return 'NONE';
    const capacity = Math.max(1, (dayCount - 2) * STOPS_PER_DAY[pace] + 1);
    return sightsUsed >= capacity * 0.7 ? 'FULL' : 'PARTIAL';
  }

  // ───────────────────────── Small builders ─────────────────────────

  private day(
    dayNumber: number,
    date: string,
    title: string,
    activities: GeneratedTripActivity[],
    extra: { description?: string; overnightLocation?: string }
  ): GeneratedTripDay {
    const ordered = activities.map((activity, index) => ({ ...activity, sortOrder: index + 1 }));

    return {
      dayNumber,
      date,
      title,
      description: extra.description,
      overnightLocation: extra.overnightLocation,
      estimatedDistanceKm: Math.round(ordered.reduce((sum, activity) => sum + (activity.distanceFromPreviousKm ?? 0), 0)),
      estimatedCost: ordered.reduce((sum, activity) => sum + (activity.estimatedCost ?? 0), 0),
      activities: ordered
    };
  }

  private activity(
    title: string,
    activityType: TripActivityType,
    rest: Omit<GeneratedTripActivity, 'title' | 'activityType' | 'sortOrder'> = {}
  ): GeneratedTripActivity {
    return { title, activityType, sortOrder: 0, ...rest };
  }

  private activityType(category: PlaceCategory): TripActivityType {
    if (FOOD_CATEGORIES.includes(category)) return TripActivityType.MEAL;
    if (category === PlaceCategory.ACTIVITY) return TripActivityType.ACTIVITY;
    return TripActivityType.SIGHTSEEING;
  }

  private describe(input: ItineraryGeneratorInput, text: string): string {
    return input.preferences.length ? `${text} Preferences considered: ${input.preferences.join(', ')}.` : text;
  }

  private dayCount(startDate: string, endDate: string): number {
    const ms = toDateOnly(endDate).getTime() - toDateOnly(startDate).getTime();
    return Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)) + 1);
  }

  private dateFor(startDate: string, dayNumber: number): string {
    const date = toDateOnly(startDate);
    date.setUTCDate(date.getUTCDate() + dayNumber - 1);
    return toIsoDate(date);
  }

  private weekday(date: string): number {
    return toDateOnly(date).getUTCDay();
  }
}
