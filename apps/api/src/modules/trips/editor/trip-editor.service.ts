import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PlaceCategory, Prisma, TripActivityType } from '@prisma/client';

import { AddActivityDto, MAX_ACTIVITIES_PER_DAY, UpdateActivityDto } from '../dto/itinerary-edit.dto';
import { ITINERARY_GENERATOR, ItineraryGenerator } from '../../itinerary/contracts/itinerary-generator.contract';
import { PrismaService } from '../../../database/prisma.service';
import { TimedActivity, retimeDay } from './day-timing';
import { TripsService } from '../trips.service';
import { decimalToNumber } from '../../../common/utils/number.util';

type Tx = Prisma.TransactionClient;

const dayInclude = { activities: { orderBy: { sortOrder: 'asc' } } } satisfies Prisma.TripDayInclude;
type DayWithActivities = Prisma.TripDayGetPayload<{ include: typeof dayInclude }>;
type StoredActivity = DayWithActivities['activities'][number];

/** Trailing items that close a day: new stops go before them. */
const CLOSING_TYPES: TripActivityType[] = [TripActivityType.MEAL, TripActivityType.TRAVEL, TripActivityType.CHECK_IN];

/**
 * Owner-only edits to a generated itinerary. Every change re-times the
 * affected days, marks the touched stops as edited and refreshes the cost.
 */
@Injectable()
export class TripEditorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trips: TripsService,
    @Inject(ITINERARY_GENERATOR) private readonly generator: ItineraryGenerator
  ) {}

  async reorderDay(tripId: string, dayNumber: number, activityIds: string[], userId: string) {
    await this.ownedTrip(tripId, userId);

    await this.prisma.$transaction(async (tx) => {
      const day = await this.day(tx, tripId, dayNumber);
      const current = day.activities.map((activity) => activity.id);

      if (activityIds.length !== current.length || new Set(activityIds).size !== current.length || !activityIds.every((id) => current.includes(id))) {
        throw new BadRequestException('Send every activity of the day exactly once');
      }

      const byId = new Map(day.activities.map((activity) => [activity.id, activity]));
      const moved = new Set(activityIds.filter((id, index) => current[index] !== id));
      await this.saveDay(tx, day.id, activityIds.map((id) => byId.get(id)!), moved, { dayStart: day.activities[0]?.startTime });
      await this.afterEdit(tx, tripId);
    });

    return this.trips.findById(tripId, userId);
  }

  async addActivity(tripId: string, dayNumber: number, dto: AddActivityDto, userId: string) {
    const trip = await this.ownedTrip(tripId, userId);

    await this.prisma.$transaction(async (tx) => {
      const day = await this.day(tx, tripId, dayNumber);

      if (day.activities.length >= MAX_ACTIVITIES_PER_DAY) {
        throw new BadRequestException(`A day can have at most ${MAX_ACTIVITIES_PER_DAY} stops`);
      }

      const created = dto.placeId
        ? await this.placeActivity(tx, tripId, dto.placeId, trip.travellerCount, dto.durationMinutes)
        : {
            title: dto.title!,
            activityType: TripActivityType.ACTIVITY,
            durationMinutes: dto.durationMinutes ?? 60
          };
      const activity = await tx.tripActivity.create({
        data: { ...created, tripDayId: day.id, sortOrder: day.activities.length + 1, isUserEdited: true }
      });
      const ordered = [...day.activities];
      ordered.splice(this.insertAt(day.activities, dto.position), 0, activity);

      await this.saveDay(tx, day.id, ordered, new Set([activity.id]), { dayStart: day.activities[0]?.startTime });
      await this.afterEdit(tx, tripId);
    });

    return this.trips.findById(tripId, userId);
  }

  async updateActivity(tripId: string, activityId: string, dto: UpdateActivityDto, userId: string) {
    await this.ownedTrip(tripId, userId);

    await this.prisma.$transaction(async (tx) => {
      const { activity, day } = await this.activity(tx, tripId, activityId);
      const edited = { ...activity, title: dto.title ?? activity.title, durationMinutes: dto.durationMinutes ?? activity.durationMinutes };
      const target = dto.dayNumber && dto.dayNumber !== day.dayNumber ? await this.day(tx, tripId, dto.dayNumber) : day;

      if (target.id !== day.id) {
        if (target.activities.length >= MAX_ACTIVITIES_PER_DAY) {
          throw new BadRequestException(`A day can have at most ${MAX_ACTIVITIES_PER_DAY} stops`);
        }

        // Leaving one day and joining another: both days need new times.
        const remaining = day.activities.filter((entry) => entry.id !== activityId);
        const joined = [...target.activities];
        const index = this.insertAt(target.activities, dto.position);
        joined.splice(index, 0, { ...edited, startTime: null });
        await tx.tripActivity.update({ where: { id: activityId }, data: { tripDayId: target.id } });
        await this.saveDay(tx, day.id, remaining, new Set());
        await this.saveDay(tx, target.id, joined, new Set([activityId]), {
          dayStart: target.activities[0]?.startTime,
          anchor: dto.startTime ? { index, startTime: dto.startTime } : undefined
        });
      } else {
        const ordered = day.activities.filter((entry) => entry.id !== activityId);
        const index = dto.position ? Math.min(dto.position - 1, ordered.length) : day.activities.findIndex((entry) => entry.id === activityId);
        ordered.splice(index, 0, edited);
        await this.saveDay(tx, day.id, ordered, new Set([activityId]), {
          dayStart: day.activities[0]?.startTime,
          anchor: dto.startTime ? { index, startTime: dto.startTime } : undefined
        });
      }

      await this.afterEdit(tx, tripId);
    });

    return this.trips.findById(tripId, userId);
  }

  async removeActivity(tripId: string, activityId: string, userId: string) {
    await this.ownedTrip(tripId, userId);

    await this.prisma.$transaction(async (tx) => {
      const { day } = await this.activity(tx, tripId, activityId);
      await tx.tripActivity.delete({ where: { id: activityId } });
      await this.saveDay(tx, day.id, day.activities.filter((entry) => entry.id !== activityId), new Set());
      await this.afterEdit(tx, tripId);
    });

    return this.trips.findById(tripId, userId);
  }

  /** Plans one day again with places that are not already on other days. */
  async regenerateDay(tripId: string, dayNumber: number, userId: string) {
    const trip = await this.ownedTrip(tripId, userId);
    const elsewhere = await this.prisma.tripActivity.findMany({
      where: { tripDay: { tripId, dayNumber: { not: dayNumber } }, placeId: { not: null } },
      select: { placeId: true }
    });
    const plan = await this.generator.generateDay(
      this.trips.planInput(trip, elsewhere.map((entry) => entry.placeId!)),
      dayNumber
    );

    if (!plan) {
      throw new NotFoundException(`Day ${dayNumber} is not part of this trip`);
    }

    await this.prisma.$transaction(async (tx) => {
      const day = await this.day(tx, tripId, dayNumber);
      await tx.tripActivity.deleteMany({ where: { tripDayId: day.id } });
      await tx.tripDay.update({
        where: { id: day.id },
        data: {
          title: plan.title,
          description: plan.description,
          estimatedDistanceKm: plan.estimatedDistanceKm,
          estimatedCost: plan.estimatedCost,
          activities: { create: plan.activities.map((activity) => this.trips.activityData(activity)) }
        }
      });
      await this.afterEdit(tx, tripId);
    });

    return this.trips.findById(tripId, userId);
  }

  // ───────────────────────── Helpers ─────────────────────────

  private async ownedTrip(tripId: string, userId: string) {
    const trip = await this.prisma.trip.findFirst({ where: { id: tripId, userId } });

    if (!trip) {
      throw new NotFoundException(`Trip ${tripId} was not found`);
    }

    return trip;
  }

  private async day(tx: Tx, tripId: string, dayNumber: number): Promise<DayWithActivities> {
    const day = await tx.tripDay.findUnique({ where: { tripId_dayNumber: { tripId, dayNumber } }, include: dayInclude });

    if (!day) {
      throw new NotFoundException(`Day ${dayNumber} is not part of this trip. Generate the itinerary first.`);
    }

    return day;
  }

  private async activity(tx: Tx, tripId: string, activityId: string) {
    const activity = await tx.tripActivity.findFirst({ where: { id: activityId, tripDay: { tripId } } });

    if (!activity) {
      throw new NotFoundException('That stop is not part of this trip');
    }

    return { activity, day: (await tx.tripDay.findUniqueOrThrow({ where: { id: activity.tripDayId }, include: dayInclude })) };
  }

  private async placeActivity(tx: Tx, tripId: string, placeId: string, travellers: number, durationMinutes?: number) {
    const place = await tx.place.findFirst({ where: { id: placeId, status: 'PUBLISHED' } });

    if (!place) {
      throw new NotFoundException('That place is not available');
    }

    const existing = await tx.tripActivity.findFirst({
      where: { placeId, tripDay: { tripId } },
      select: { tripDay: { select: { dayNumber: true } } }
    });

    if (existing) {
      throw new ConflictException(`${place.name} is already in your plan on day ${existing.tripDay.dayNumber}`);
    }

    const perPerson = place.isFree ? 0 : (decimalToNumber(place.estimatedCost ?? place.entryFeeIndian) ?? 0);

    return {
      placeId,
      title: place.name,
      description: place.description,
      activityType:
        place.category === PlaceCategory.FOOD || place.category === PlaceCategory.CAFE
          ? TripActivityType.MEAL
          : place.category === PlaceCategory.ACTIVITY
            ? TripActivityType.ACTIVITY
            : TripActivityType.SIGHTSEEING,
      durationMinutes: durationMinutes ?? Math.max(30, Math.min(place.timeRequiredMinMinutes ?? place.averageVisitMinutes ?? 90, 300)),
      latitude: place.latitude,
      longitude: place.longitude,
      estimatedCost: Math.round(perPerson * travellers)
    };
  }

  /** Default slot: before the closing dinner, drive or check-in; otherwise at the end. */
  private insertAt(activities: StoredActivity[], position?: number): number {
    if (position) {
      return Math.min(position - 1, activities.length);
    }

    const last = activities.at(-1);
    return last && activities.length > 1 && CLOSING_TYPES.includes(last.activityType) ? activities.length - 1 : activities.length;
  }

  /** Writes order and new times for a day, flagging the touched stops. */
  private async saveDay(
    tx: Tx,
    dayId: string,
    ordered: StoredActivity[],
    touched: Set<string>,
    options: { anchor?: { index: number; startTime: string }; dayStart?: string | null } = {}
  ): Promise<void> {
    const timed = retimeDay(
      ordered.map((activity) => ({
        ...activity,
        latitude: decimalToNumber(activity.latitude),
        longitude: decimalToNumber(activity.longitude),
        distanceFromPreviousKm: decimalToNumber(activity.distanceFromPreviousKm)
      })) as (Omit<StoredActivity, 'latitude' | 'longitude' | 'distanceFromPreviousKm'> & TimedActivity)[],
      options
    );

    for (const [index, activity] of timed.entries()) {
      await tx.tripActivity.update({
        where: { id: activity.id },
        data: {
          sortOrder: index + 1,
          title: activity.title,
          startTime: activity.startTime,
          endTime: activity.endTime,
          durationMinutes: activity.durationMinutes,
          distanceFromPreviousKm: activity.distanceFromPreviousKm,
          travelTimeFromPreviousMinutes: activity.travelTimeFromPreviousMinutes,
          ...(touched.has(activity.id) ? { isUserEdited: true } : {})
        }
      });
    }

    await tx.tripDay.update({
      where: { id: dayId },
      data: {
        estimatedDistanceKm: Math.round(timed.reduce((sum, activity) => sum + (activity.distanceFromPreviousKm ?? 0), 0)),
        estimatedCost: ordered.reduce((sum, activity) => sum + (decimalToNumber(activity.estimatedCost) ?? 0), 0)
      }
    });
  }

  /** Keeps the trip distance and cost in step with the edited days. */
  private async afterEdit(tx: Tx, tripId: string): Promise<void> {
    const trip = await tx.trip.findUniqueOrThrow({
      where: { id: tripId },
      select: { travelMode: true, days: { select: { estimatedDistanceKm: true } } }
    });

    if (trip.travelMode !== 'FLIGHT') {
      await tx.trip.update({
        where: { id: tripId },
        data: { estimatedDistanceKm: Math.round(trip.days.reduce((sum, day) => sum + (decimalToNumber(day.estimatedDistanceKm) ?? 0), 0)) }
      });
    }

    await this.trips.refreshCost(tripId, tx);
  }
}
