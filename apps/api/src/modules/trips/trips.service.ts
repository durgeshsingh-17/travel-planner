import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { Prisma, Trip } from '@prisma/client';
import { randomBytes } from 'crypto';

import { assertDateRange, toDateOnly, toIsoDate } from '../../common/utils/date.util';
import { decimalToNumber } from '../../common/utils/number.util';
import { CreateTripDto } from './dto/create-trip.dto';
import {
  ITINERARY_GENERATOR,
  ItineraryGenerator
} from '../itinerary/contracts/itinerary-generator.contract';
import { PreviewTripDto } from './dto/preview-trip.dto';
import { PrismaService } from '../../database/prisma.service';
import { TripCostService } from '../itinerary/services/trip-cost.service';
import { UpdateTripDto } from './dto/update-trip.dto';

type TripWithRelations = Prisma.TripGetPayload<{
  include: {
    vehicle: true;
    userVehicle: true;
    days: {
      include: {
        activities: {
          include: {
            place: true;
          };
        };
      };
    };
    travellers: true;
  };
}>;

interface VehicleSelection {
  vehicleId: string | null;
  userVehicleId: string | null;
}

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tripCostService: TripCostService,
    @Inject(ITINERARY_GENERATOR)
    private readonly itineraryGenerator: ItineraryGenerator
  ) {}

  preview(dto: PreviewTripDto) {
    this.assertValidDateRange(dto.startDate, dto.endDate);

    return {
      title: `${dto.source.name} to ${dto.destination.name}`,
      source: dto.source,
      destination: dto.destination,
      startDate: dto.startDate,
      endDate: dto.endDate,
      travellerCount: dto.travellers.length,
      travellers: dto.travellers,
      travelMode: dto.travelMode,
      budget: dto.budget ?? null,
      vehicle: null,
      interests: dto.interests,
      preferences: dto.preferences ?? [],
      notes: dto.notes ?? null,
      status: 'READY_FOR_GENERATION'
    };
  }

  async create(dto: CreateTripDto, ownerUserId: string) {
    this.assertValidDateRange(dto.startDate, dto.endDate);
    this.assertTravellerCount(dto.travellerCount, dto.travellers.length);
    const vehicle = await this.resolveVehicleSelection(ownerUserId, dto);

    const trip = await this.prisma.trip.create({
      data: {
        user: {
          connect: {
            id: ownerUserId
          }
        },
        title: dto.title ?? `${dto.source.name} to ${dto.destination.name}`,
        sourceName: dto.source.name,
        sourceLatitude: dto.source.latitude,
        sourceLongitude: dto.source.longitude,
        destinationName: dto.destination.name,
        destinationLatitude: dto.destination.latitude,
        destinationLongitude: dto.destination.longitude,
        startDate: toDateOnly(dto.startDate),
        endDate: toDateOnly(dto.endDate),
        travellerCount: dto.travellers.length,
        travelMode: dto.travelMode,
        budget: dto.budget,
        interests: dto.interests,
        preferences: dto.preferences ?? [],
        notes: dto.notes,
        vehicle: vehicle?.vehicleId ? { connect: { id: vehicle.vehicleId } } : undefined,
        userVehicle: vehicle?.userVehicleId
          ? { connect: { id: vehicle.userVehicleId } }
          : undefined,
        travellers: {
          create: dto.travellers.map((traveller, index) => ({
            fullName: traveller.fullName.trim(),
            age: traveller.age,
            gender: traveller.gender,
            sortOrder: index + 1
          }))
        }
      } satisfies Prisma.TripCreateInput,
      include: this.tripInclude()
    });

    return this.serializeTripWithRelations(trip);
  }

  async findAll(ownerUserId: string) {
    const trips = await this.prisma.trip.findMany({
      where: {
        userId: ownerUserId
      },
      include: {
        vehicle: true,
        travellers: {
          orderBy: {
            sortOrder: 'asc'
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return trips.map((trip) => ({
      ...this.serializeTrip(trip),
      vehicle: trip.vehicle,
      travellers: trip.travellers
    }));
  }

  async findById(id: string, ownerUserId: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { id, userId: ownerUserId },
      include: this.tripInclude()
    });

    if (!trip) {
      throw this.tripNotFound(id);
    }

    return this.serializeTripWithRelations(trip);
  }

  async findShared(shareSlug: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { shareSlug, visibility: 'UNLISTED' },
      include: this.tripInclude()
    });

    if (!trip) {
      throw new NotFoundException('This shared trip is no longer available');
    }

    return this.serializeSharedTrip(trip);
  }

  async update(id: string, dto: UpdateTripDto, ownerUserId: string) {
    const existing = await this.findOwnedTripOrThrow(id, ownerUserId);
    const vehicle = await this.resolveVehicleSelection(ownerUserId, dto);
    const nextStartDate = dto.startDate ?? toIsoDate(existing.startDate);
    const nextEndDate = dto.endDate ?? toIsoDate(existing.endDate);
    this.assertValidDateRange(nextStartDate, nextEndDate);
    if (dto.travellerCount !== undefined && dto.travellers) {
      this.assertTravellerCount(dto.travellerCount, dto.travellers.length);
    }

    const data: Prisma.TripUpdateInput = {
      title: dto.title,
      sourceName: dto.source?.name,
      sourceLatitude: dto.source?.latitude,
      sourceLongitude: dto.source?.longitude,
      destinationName: dto.destination?.name,
      destinationLatitude: dto.destination?.latitude,
      destinationLongitude: dto.destination?.longitude,
      startDate: dto.startDate ? toDateOnly(dto.startDate) : undefined,
      endDate: dto.endDate ? toDateOnly(dto.endDate) : undefined,
      travellerCount: dto.travellers ? dto.travellers.length : dto.travellerCount,
      travelMode: dto.travelMode,
      budget: dto.budget,
      interests: dto.interests,
      preferences: dto.preferences,
      notes: dto.notes,
      ...this.vehicleUpdateInput(vehicle),
      status: dto.status,
      travellers: dto.travellers
        ? {
            deleteMany: {},
            create: dto.travellers.map((traveller, index) => ({
              fullName: traveller.fullName.trim(),
              age: traveller.age,
              gender: traveller.gender,
              sortOrder: index + 1
            }))
          }
        : undefined
    };

    const trip = await this.prisma.trip.update({
      where: { id },
      data,
      include: this.tripInclude()
    });

    return this.serializeTripWithRelations(trip);
  }

  async delete(id: string, ownerUserId: string) {
    await this.findOwnedTripOrThrow(id, ownerUserId);
    await this.prisma.trip.delete({
      where: { id }
    });

    return {
      id,
      deleted: true
    };
  }

  async enableSharing(id: string, ownerUserId: string) {
    const trip = await this.findOwnedTripOrThrow(id, ownerUserId);

    if (trip.visibility === 'UNLISTED' && trip.shareSlug) {
      return { id, visibility: trip.visibility, shareSlug: trip.shareSlug };
    }

    const updated = await this.prisma.trip.update({
      where: { id },
      data: {
        visibility: 'UNLISTED',
        shareSlug: this.createShareSlug()
      },
      select: { id: true, visibility: true, shareSlug: true }
    });

    return updated;
  }

  async disableSharing(id: string, ownerUserId: string) {
    await this.findOwnedTripOrThrow(id, ownerUserId);

    // Clearing the slug revokes every link handed out so far.
    return this.prisma.trip.update({
      where: { id },
      data: {
        visibility: 'PRIVATE',
        shareSlug: null
      },
      select: { id: true, visibility: true, shareSlug: true }
    });
  }

  async generateItinerary(id: string, ownerUserId: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { id, userId: ownerUserId },
      include: {
        vehicle: true,
        userVehicle: true
      }
    });

    if (!trip) {
      throw this.tripNotFound(id);
    }

    const generatedPlan = await this.itineraryGenerator.generateTripPlan({
      tripId: trip.id,
      sourceName: trip.sourceName,
      sourceLatitude: decimalToNumber(trip.sourceLatitude) ?? 0,
      sourceLongitude: decimalToNumber(trip.sourceLongitude) ?? 0,
      destinationName: trip.destinationName,
      destinationLatitude: decimalToNumber(trip.destinationLatitude) ?? 0,
      destinationLongitude: decimalToNumber(trip.destinationLongitude) ?? 0,
      startDate: toIsoDate(trip.startDate),
      endDate: toIsoDate(trip.endDate),
      travellerCount: trip.travellerCount,
      travelMode: trip.travelMode,
      interests: trip.interests,
      preferences: trip.preferences,
      notes: trip.notes
    });
    const costBreakdown = this.tripCostService.calculate({
      distanceKm: generatedPlan.estimatedDistanceKm,
      travellerCount: trip.travellerCount,
      dayCount: generatedPlan.days.length,
      mileageKmPerLitre: this.effectiveMileage(trip),
      fuelType: trip.vehicle?.fuelType
    });

    const updatedTrip = await this.prisma.$transaction(async (tx) => {
      await tx.tripDay.deleteMany({
        where: {
          tripId: trip.id
        }
      });

      return tx.trip.update({
        where: { id: trip.id },
        data: {
          status: 'GENERATED',
          estimatedDistanceKm: generatedPlan.estimatedDistanceKm,
          estimatedDurationMinutes: generatedPlan.estimatedDurationMinutes,
          estimatedTotalCost: costBreakdown.total,
          estimatedFuelCost: costBreakdown.fuel,
          days: {
            create: generatedPlan.days.map((day) => ({
              dayNumber: day.dayNumber,
              date: toDateOnly(day.date),
              title: day.title,
              description: day.description,
              estimatedDistanceKm: day.estimatedDistanceKm,
              estimatedCost: day.estimatedCost,
              activities: {
                create: day.activities.map((activity) => ({
                  title: activity.title,
                  description: activity.description,
                  activityType: activity.activityType,
                  placeId: activity.placeId,
                  startTime: activity.startTime,
                  endTime: activity.endTime,
                  latitude: activity.latitude,
                  longitude: activity.longitude,
                  estimatedCost: activity.estimatedCost,
                  distanceFromPreviousKm: activity.distanceFromPreviousKm,
                  travelTimeFromPreviousMinutes:
                    activity.travelTimeFromPreviousMinutes,
                  sortOrder: activity.sortOrder
                }))
              }
            }))
          }
        },
        include: this.tripInclude()
      });
    });

    return this.serializeTripWithRelations(updatedTrip);
  }

  private assertValidDateRange(startDate: string, endDate: string): void {
    if (!assertDateRange(startDate, endDate)) {
      throw new BadRequestException('End date must be after start date');
    }
  }

  private assertTravellerCount(travellerCount: number, actualCount: number): void {
    if (travellerCount !== actualCount) {
      throw new BadRequestException(
        'Traveller count must match the number of traveller details'
      );
    }
  }

  /**
   * Returns the vehicle ids to store, or `undefined` when the request does not
   * touch the vehicle. A saved garage entry wins over a bare catalog id.
   */
  private async resolveVehicleSelection(
    ownerUserId: string,
    dto: { userVehicleId?: string | null; vehicleId?: string | null }
  ): Promise<VehicleSelection | undefined> {
    if (dto.userVehicleId) {
      const userVehicle = await this.prisma.userVehicle.findFirst({
        where: { id: dto.userVehicleId, userId: ownerUserId },
        select: { id: true, vehicleId: true }
      });

      if (!userVehicle) {
        throw new BadRequestException(
          `Saved vehicle '${dto.userVehicleId}' was not found for the signed-in user`
        );
      }

      return { vehicleId: userVehicle.vehicleId, userVehicleId: userVehicle.id };
    }

    if (dto.userVehicleId === null || dto.vehicleId === null) {
      return { vehicleId: null, userVehicleId: null };
    }

    if (dto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: dto.vehicleId },
        select: { id: true }
      });

      if (!vehicle) {
        throw new BadRequestException(`Vehicle '${dto.vehicleId}' was not found`);
      }

      return { vehicleId: vehicle.id, userVehicleId: null };
    }

    return undefined;
  }

  private vehicleUpdateInput(
    selection?: VehicleSelection
  ): Pick<Prisma.TripUpdateInput, 'vehicle' | 'userVehicle'> {
    if (!selection) {
      return {};
    }

    return {
      vehicle: selection.vehicleId
        ? { connect: { id: selection.vehicleId } }
        : { disconnect: true },
      userVehicle: selection.userVehicleId
        ? { connect: { id: selection.userVehicleId } }
        : { disconnect: true }
    };
  }

  private effectiveMileage(trip: {
    vehicle: { averageMileage: number | null } | null;
    userVehicle: { customMileage: number | null } | null;
  }): number | null {
    return trip.userVehicle?.customMileage ?? trip.vehicle?.averageMileage ?? null;
  }

  private async findOwnedTripOrThrow(id: string, ownerUserId: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { id, userId: ownerUserId },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        visibility: true,
        shareSlug: true
      }
    });

    if (!trip) {
      throw this.tripNotFound(id);
    }

    return trip;
  }

  private tripNotFound(id: string): NotFoundException {
    // Same response for "missing" and "not yours" so ids cannot be probed.
    return new NotFoundException(`Trip '${id}' was not found`);
  }

  private createShareSlug(): string {
    return randomBytes(9).toString('base64url');
  }

  private tripInclude() {
    return {
      vehicle: true,
      userVehicle: true,
      travellers: {
        orderBy: {
          sortOrder: 'asc'
        }
      },
      days: {
        orderBy: {
          dayNumber: 'asc'
        },
        include: {
          activities: {
            orderBy: {
              sortOrder: 'asc'
            },
            include: {
              place: true
            }
          }
        }
      }
    } satisfies Prisma.TripInclude;
  }

  private serializeTrip(trip: Trip) {
    return {
      ...trip,
      sourceLatitude: decimalToNumber(trip.sourceLatitude),
      sourceLongitude: decimalToNumber(trip.sourceLongitude),
      destinationLatitude: decimalToNumber(trip.destinationLatitude),
      destinationLongitude: decimalToNumber(trip.destinationLongitude),
      startDate: toIsoDate(trip.startDate),
      endDate: toIsoDate(trip.endDate),
      budget: decimalToNumber(trip.budget),
      estimatedDistanceKm: decimalToNumber(trip.estimatedDistanceKm),
      estimatedTotalCost: decimalToNumber(trip.estimatedTotalCost),
      estimatedFuelCost: decimalToNumber(trip.estimatedFuelCost)
    };
  }

  private serializeTripWithRelations(trip: TripWithRelations) {
    return {
      ...this.serializeTrip(trip),
      vehicle: trip.vehicle,
      userVehicle: trip.userVehicle
        ? {
            id: trip.userVehicle.id,
            nickname: trip.userVehicle.nickname,
            customMileage: trip.userVehicle.customMileage,
            registrationNumber: trip.userVehicle.registrationNumber
          }
        : null,
      travellers: trip.travellers,
      costBreakdown: this.buildCostBreakdown(trip),
      days: this.serializeDays(trip.days)
    };
  }

  /**
   * Explicit allow-list for the public share view: no owner id, travellers,
   * notes, budget or vehicle registration.
   */
  private serializeSharedTrip(trip: TripWithRelations) {
    return {
      id: trip.id,
      shareSlug: trip.shareSlug,
      title: trip.title,
      sourceName: trip.sourceName,
      sourceLatitude: decimalToNumber(trip.sourceLatitude),
      sourceLongitude: decimalToNumber(trip.sourceLongitude),
      destinationName: trip.destinationName,
      destinationLatitude: decimalToNumber(trip.destinationLatitude),
      destinationLongitude: decimalToNumber(trip.destinationLongitude),
      startDate: toIsoDate(trip.startDate),
      endDate: toIsoDate(trip.endDate),
      travellerCount: trip.travellerCount,
      travelMode: trip.travelMode,
      interests: trip.interests,
      status: trip.status,
      estimatedDistanceKm: decimalToNumber(trip.estimatedDistanceKm),
      estimatedDurationMinutes: trip.estimatedDurationMinutes,
      estimatedTotalCost: decimalToNumber(trip.estimatedTotalCost),
      estimatedFuelCost: decimalToNumber(trip.estimatedFuelCost),
      vehicle: trip.vehicle
        ? {
            id: trip.vehicle.id,
            brand: trip.vehicle.brand,
            model: trip.vehicle.model,
            type: trip.vehicle.type,
            fuelType: trip.vehicle.fuelType,
            averageMileage: trip.vehicle.averageMileage
          }
        : null,
      costBreakdown: this.buildCostBreakdown(trip),
      days: this.serializeDays(trip.days)
    };
  }

  private serializeDays(days: TripWithRelations['days']) {
    return days.map((day) => ({
      id: day.id,
      dayNumber: day.dayNumber,
      date: toIsoDate(day.date),
      title: day.title,
      description: day.description,
      estimatedDistanceKm: decimalToNumber(day.estimatedDistanceKm),
      estimatedCost: decimalToNumber(day.estimatedCost),
      activities: day.activities.map((activity) => ({
        ...activity,
        place: activity.place
          ? {
              ...activity.place,
              latitude: decimalToNumber(activity.place.latitude),
              longitude: decimalToNumber(activity.place.longitude),
              estimatedCost: decimalToNumber(activity.place.estimatedCost),
              rating: decimalToNumber(activity.place.rating)
            }
          : null,
        latitude: decimalToNumber(activity.latitude),
        longitude: decimalToNumber(activity.longitude),
        estimatedCost: decimalToNumber(activity.estimatedCost),
        distanceFromPreviousKm: decimalToNumber(activity.distanceFromPreviousKm)
      }))
    }));
  }

  private buildCostBreakdown(trip: TripWithRelations) {
    const estimatedDistanceKm = decimalToNumber(trip.estimatedDistanceKm);

    if (!estimatedDistanceKm) {
      return null;
    }

    return this.tripCostService.calculate({
      distanceKm: estimatedDistanceKm,
      travellerCount: trip.travellerCount,
      dayCount: Math.max(trip.days.length, 1),
      mileageKmPerLitre: this.effectiveMileage(trip),
      fuelType: trip.vehicle?.fuelType
    });
  }
}
