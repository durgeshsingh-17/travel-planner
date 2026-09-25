import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FuelType } from '@prisma/client';

export interface TripCostBreakdown {
  fuel: number;
  tolls: number;
  stay: number;
  food: number;
  activities: number;
  parking: number;
  miscellaneous: number;
  total: number;
  fuelRequiredLitres: number;
  fuelPricePerLitre: number;
}

@Injectable()
export class TripCostService {
  constructor(private readonly config: ConfigService) {}

  calculate(input: {
    distanceKm: number;
    travellerCount: number;
    dayCount: number;
    mileageKmPerLitre?: number | null;
    fuelType?: FuelType | null;
  }): TripCostBreakdown {
    const mileage = input.mileageKmPerLitre ?? 18;
    const fuelPrice = this.resolveFuelPrice(input.fuelType);
    const fuelRequiredLitres =
      input.fuelType === FuelType.ELECTRIC ? 0 : input.distanceKm / mileage;
    const fuel = Math.round(fuelRequiredLitres * fuelPrice);
    const nights = Math.max(input.dayCount - 1, 0);
    const tolls = Math.round(input.distanceKm * 0.8);
    const stay = nights * input.travellerCount * 1800;
    const food = input.dayCount * input.travellerCount * 900;
    const activities = input.dayCount * input.travellerCount * 450;
    const parking = input.dayCount * 120;
    const miscellaneous = Math.round((fuel + tolls + stay + food + activities) * 0.08);
    const total = fuel + tolls + stay + food + activities + parking + miscellaneous;

    return {
      fuel,
      tolls,
      stay,
      food,
      activities,
      parking,
      miscellaneous,
      total,
      fuelRequiredLitres: Math.round(fuelRequiredLitres * 10) / 10,
      fuelPricePerLitre: fuelPrice
    };
  }

  private resolveFuelPrice(fuelType?: FuelType | null): number {
    if (fuelType === FuelType.DIESEL) {
      return this.config.get<number>('pricing.dieselFuelPriceInr', 94);
    }

    if (fuelType === FuelType.ELECTRIC) {
      return 0;
    }

    return this.config.get<number>('pricing.petrolFuelPriceInr', 105);
  }
}
