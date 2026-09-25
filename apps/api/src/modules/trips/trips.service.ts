import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import { FuelType, Prisma, TravelMode, Trip, VehicleType } from '@prisma/client';

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
    days: {
      include: {
        activities: true;
      };
    };
    travellers: true;
  };
}>;

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
      vehicle: dto.vehicle ?? null,
      interests: dto.interests,
      preferences: dto.preferences ?? [],
      notes: dto.notes ?? null,
      status: 'READY_FOR_GENERATION'
    };
  }

  async create(dto: CreateTripDto) {
    this.assertValidDateRange(dto.startDate, dto.endDate);
    this.assertTravellerCount(dto.travellerCount, dto.travellers.length);
    await this.assertVehicleExists(dto.vehicleId);
    const vehicleId = dto.vehicleId ?? (await this.createVehicleFromInput(dto));

    const trip = await this.prisma.trip.create({
      data: {
        user: dto.userId
          ? {
              connect: {
                id: dto.userId
              }
            }
          : undefined,
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
        vehicle: vehicleId
          ? {
              connect: {
                id: vehicleId
              }
            }
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

  async findAll() {
    const trips = await this.prisma.trip.findMany({
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

  async findById(id: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: this.tripInclude()
    });

    if (!trip) {
      throw new NotFoundException(`Trip '${id}' was not found`);
    }

    return this.serializeTripWithRelations(trip);
  }

  async update(id: string, dto: UpdateTripDto) {
    await this.assertTripExists(id);
    await this.assertVehicleExists(dto.vehicleId);

    const existing = await this.prisma.trip.findUniqueOrThrow({
      where: { id },
      select: {
        startDate: true,
        endDate: true
      }
    });
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
      vehicle: dto.vehicleId
        ? {
            connect: {
              id: dto.vehicleId
            }
          }
        : undefined,
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

  async delete(id: string) {
    await this.assertTripExists(id);
    await this.prisma.trip.delete({
      where: { id }
    });

    return {
      id,
      deleted: true
    };
  }

  async generateItinerary(id: string) {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      include: {
        vehicle: true
      }
    });

    if (!trip) {
      throw new NotFoundException(`Trip '${id}' was not found`);
    }

    const generatedPlan = this.itineraryGenerator.generateTripPlan({
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
      travelMode: trip.travelMode
    });
    const costBreakdown = this.tripCostService.calculate({
      distanceKm: generatedPlan.estimatedDistanceKm,
      travellerCount: trip.travellerCount,
      dayCount: generatedPlan.days.length,
      mileageKmPerLitre: trip.vehicle?.averageMileage,
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

  private async createVehicleFromInput(dto: CreateTripDto): Promise<string | undefined> {
    if (!dto.vehicle?.brand || !dto.vehicle.model) {
      return undefined;
    }

    const vehicle = await this.prisma.vehicle.create({
      data: {
        brand: dto.vehicle.brand,
        model: dto.vehicle.model,
        type: this.resolveVehicleType(dto.travelMode),
        fuelType: this.resolveFuelType(dto.travelMode),
        averageMileage: dto.vehicle.mileage
      }
    });

    return vehicle.id;
  }

  private resolveVehicleType(travelMode: TravelMode): VehicleType {
    if (travelMode === TravelMode.BIKE) {
      return VehicleType.BIKE;
    }

    if (travelMode === TravelMode.CAR) {
      return VehicleType.CAR;
    }

    return VehicleType.CAR;
  }

  private resolveFuelType(travelMode: TravelMode): FuelType {
    return travelMode === TravelMode.FLIGHT ? FuelType.PETROL : FuelType.PETROL;
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

  private async assertVehicleExists(vehicleId?: string): Promise<void> {
    if (!vehicleId) {
      return;
    }

    const vehicle = await this.prisma.vehicle.findUnique({
      where: {
        id: vehicleId
      },
      select: {
        id: true
      }
    });

    if (!vehicle) {
      throw new BadRequestException(`Vehicle '${vehicleId}' was not found`);
    }
  }

  private async assertTripExists(id: string): Promise<void> {
    const trip = await this.prisma.trip.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!trip) {
      throw new NotFoundException(`Trip '${id}' was not found`);
    }
  }

  private tripInclude() {
    return {
      vehicle: true,
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
      travellers: trip.travellers,
      costBreakdown: this.buildCostBreakdown(trip),
      days: trip.days.map((day) => ({
        ...day,
        date: toIsoDate(day.date),
        estimatedDistanceKm: decimalToNumber(day.estimatedDistanceKm),
        estimatedCost: decimalToNumber(day.estimatedCost),
        activities: day.activities.map((activity) => ({
          ...activity,
          latitude: decimalToNumber(activity.latitude),
          longitude: decimalToNumber(activity.longitude),
          estimatedCost: decimalToNumber(activity.estimatedCost),
          distanceFromPreviousKm: decimalToNumber(activity.distanceFromPreviousKm)
        }))
      }))
    };
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
      mileageKmPerLitre: trip.vehicle?.averageMileage,
      fuelType: trip.vehicle?.fuelType
    });
  }
}
