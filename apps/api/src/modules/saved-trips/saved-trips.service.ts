import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { decimalToNumber } from '../../common/utils/number.util';
import { toIsoDate } from '../../common/utils/date.util';
import { PrismaService } from '../../database/prisma.service';

const savedTripSelect = {
  id: true,
  userId: true,
  title: true,
  sourceName: true,
  destinationName: true,
  startDate: true,
  endDate: true,
  travellerCount: true,
  travelMode: true,
  status: true,
  visibility: true,
  shareSlug: true,
  estimatedDistanceKm: true,
  estimatedTotalCost: true
} satisfies Prisma.TripSelect;

type SavedTripRow = Prisma.TripGetPayload<{ select: typeof savedTripSelect }>;

@Injectable()
export class SavedTripsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    const items = await this.prisma.savedItem.findMany({
      where: { userId, type: 'TRIP', tripId: { not: null } },
      include: { trip: { select: savedTripSelect } },
      orderBy: { createdAt: 'desc' }
    });

    return items.flatMap((item) =>
      item.trip ? [this.serialize(item.trip, userId, item.createdAt)] : []
    );
  }

  async save(userId: string, tripId: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, ...this.visibleToUser(userId) },
      select: savedTripSelect
    });

    if (!trip) {
      throw new NotFoundException(`Trip '${tripId}' was not found`);
    }

    const item = await this.prisma.savedItem.upsert({
      where: { userId_tripId: { userId, tripId } },
      update: {},
      create: { userId, tripId, type: 'TRIP' }
    });

    return this.serialize(trip, userId, item.createdAt);
  }

  async remove(userId: string, tripId: string) {
    await this.prisma.savedItem.deleteMany({
      where: { userId, tripId }
    });

    return { tripId, saved: false };
  }

  async import(userId: string, tripIds: string[]) {
    const uniqueIds = [...new Set(tripIds)];

    if (uniqueIds.length > 0) {
      const trips = await this.prisma.trip.findMany({
        where: { id: { in: uniqueIds }, ...this.visibleToUser(userId) },
        select: { id: true }
      });

      await this.prisma.savedItem.createMany({
        data: trips.map((trip) => ({ userId, tripId: trip.id, type: 'TRIP' as const })),
        skipDuplicates: true
      });
    }

    return this.findAll(userId);
  }

  /** A user may save their own trips and trips someone else is sharing. */
  private visibleToUser(userId: string): Prisma.TripWhereInput {
    return {
      OR: [{ userId }, { visibility: 'UNLISTED', shareSlug: { not: null } }]
    };
  }

  private serialize(trip: SavedTripRow, userId: string, savedAt: Date) {
    const isOwner = trip.userId === userId;
    const isShared = trip.visibility === 'UNLISTED' && trip.shareSlug !== null;

    return {
      tripId: trip.id,
      savedAt: savedAt.toISOString(),
      isOwner,
      // Someone else's trip that is no longer shared stays in the list, but its details are hidden.
      available: isOwner || isShared,
      shareSlug: isShared ? trip.shareSlug : null,
      trip:
        isOwner || isShared
          ? {
              id: trip.id,
              title: trip.title,
              sourceName: trip.sourceName,
              destinationName: trip.destinationName,
              startDate: toIsoDate(trip.startDate),
              endDate: toIsoDate(trip.endDate),
              travellerCount: trip.travellerCount,
              travelMode: trip.travelMode,
              status: trip.status,
              estimatedDistanceKm: decimalToNumber(trip.estimatedDistanceKm),
              estimatedTotalCost: decimalToNumber(trip.estimatedTotalCost)
            }
          : null
    };
  }
}
