import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { normalizeIndianRegistration } from '../../common/validators/india-registration.util';
import { decimalToNumber } from '../../common/utils/number.util';
import { CreateUserVehicleDto } from './dto/create-user-vehicle.dto';
import { ListVehiclesQueryDto } from './dto/list-vehicles-query.dto';
import { PrismaService } from '../../database/prisma.service';
import { UpdateUserVehicleDto } from './dto/update-user-vehicle.dto';

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListVehiclesQueryDto) {
    const vehicles = await this.prisma.vehicle.findMany({
      where: {
        type: query.type,
        fuelType: query.fuelType
      },
      distinct: ['brand', 'model', 'type', 'fuelType'],
      orderBy: [{ brand: 'asc' }, { model: 'asc' }]
    });

    return vehicles.map((vehicle) => ({
      ...vehicle,
      tankCapacity: vehicle.tankCapacity ?? null,
      averageMileage: decimalToNumber(vehicle.averageMileage)
    }));
  }

  async findUserVehicles(userId: string) {
    const userVehicles = await this.prisma.userVehicle.findMany({
      where: { userId },
      include: {
        vehicle: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return userVehicles.map((userVehicle) => ({
      ...userVehicle,
      customMileage: userVehicle.customMileage ?? null,
      vehicle: {
        ...userVehicle.vehicle,
        tankCapacity: userVehicle.vehicle.tankCapacity ?? null,
        averageMileage: decimalToNumber(userVehicle.vehicle.averageMileage)
      }
    }));
  }

  async createUserVehicle(userId: string, dto: CreateUserVehicleDto) {
    const vehicle = await this.prisma.vehicle.findUnique({
      where: { id: dto.vehicleId },
      select: { id: true }
    });

    if (!vehicle) {
      throw new BadRequestException(`Vehicle '${dto.vehicleId}' was not found`);
    }

    const userVehicle = await this.prisma.userVehicle.create({
      data: {
        userId,
        vehicleId: dto.vehicleId,
        nickname: dto.nickname,
        customMileage: dto.customMileage,
        registrationNumber: dto.registrationNumber
          ? normalizeIndianRegistration(dto.registrationNumber)
          : undefined
      },
      include: {
        vehicle: true
      }
    });

    return this.serializeUserVehicle(userVehicle);
  }

  async updateUserVehicle(userId: string, id: string, dto: UpdateUserVehicleDto) {
    await this.assertUserVehicleExists(userId, id);

    if (dto.vehicleId) {
      const vehicle = await this.prisma.vehicle.findUnique({
        where: { id: dto.vehicleId },
        select: { id: true }
      });

      if (!vehicle) {
        throw new BadRequestException(`Vehicle '${dto.vehicleId}' was not found`);
      }
    }

    const userVehicle = await this.prisma.userVehicle.update({
      where: { id },
      data: {
        vehicleId: dto.vehicleId,
        nickname: dto.nickname,
        customMileage: dto.customMileage,
        registrationNumber: dto.registrationNumber
          ? normalizeIndianRegistration(dto.registrationNumber)
          : dto.registrationNumber
      },
      include: {
        vehicle: true
      }
    });

    return this.serializeUserVehicle(userVehicle);
  }

  async deleteUserVehicle(userId: string, id: string) {
    await this.assertUserVehicleExists(userId, id);

    await this.prisma.userVehicle.delete({
      where: { id }
    });

    return {
      id,
      deleted: true
    };
  }

  private async assertUserVehicleExists(userId: string, id: string) {
    const userVehicle = await this.prisma.userVehicle.findFirst({
      where: {
        id,
        userId
      },
      select: {
        id: true
      }
    });

    if (!userVehicle) {
      throw new NotFoundException(
        `Saved vehicle '${id}' was not found for the signed-in user`
      );
    }

    return userVehicle;
  }

  private serializeUserVehicle(userVehicle: {
    customMileage: number | null;
    vehicle: {
      tankCapacity: number | null;
      averageMileage: Parameters<typeof decimalToNumber>[0];
    };
    [key: string]: unknown;
  }) {
    return {
      ...userVehicle,
      customMileage: userVehicle.customMileage ?? null,
      vehicle: {
        ...userVehicle.vehicle,
        tankCapacity: userVehicle.vehicle.tankCapacity ?? null,
        averageMileage: decimalToNumber(userVehicle.vehicle.averageMileage)
      }
    };
  }
}
