import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FuelType, TravelMode } from '@prisma/client';

export interface CostAssumption {
  item: string;
  basis: string;
}

export interface TripCostBreakdown {
  fuel: number;
  tolls: number;
  fares: number;
  localTransport: number;
  stay: number;
  food: number;
  activities: number;
  parking: number;
  miscellaneous: number;
  total: number;
  fuelRequiredLitres: number;
  fuelPricePerLitre: number;
  mileageKmPerLitre: number;
  /** Fares and hotel prices are typical figures, not quotes. */
  isIndicative: boolean;
  assumptions: CostAssumption[];
}

export interface TripCostInput {
  distanceKm: number;
  travellerCount: number;
  dayCount: number;
  travelMode?: TravelMode;
  /** One-way distance between home and destination, for fares. Defaults to half of distanceKm. */
  oneWayKm?: number;
  mileageKmPerLitre?: number | null;
  fuelType?: FuelType | null;
  /** Entry fees from the generated plan, for the whole group (meals are in the food allowance). */
  plannedActivityCost?: number | null;
}

/** Typical figures used when the plan has nothing more specific. All in INR. */
const RATES = {
  defaultMileage: 18,
  tollPerKm: { CAR: 0.8, BIKE: 0 },
  parkingPerDay: { CAR: 120, BIKE: 40 },
  roomPerNight: 2200,
  foodPerPersonDay: 900,
  activitiesPerPersonDay: 450,
  busFarePerKm: 1.6,
  flightFareBase: 4500,
  flightFarePerKm: 3,
  airportTransfersPerPerson: 1500,
  localCabPerDay: 1800,
  miscellaneousShare: 0.08
};

const format = (value: number) => `₹${value.toLocaleString('en-IN')}`;

/**
 * Deterministic, explainable trip estimate. Every line records how it was
 * worked out so the traveller can see (and question) the numbers.
 */
@Injectable()
export class TripCostService {
  constructor(private readonly config: ConfigService) {}

  calculate(input: TripCostInput): TripCostBreakdown {
    const mode = input.travelMode ?? 'CAR';
    const travellers = Math.max(1, input.travellerCount);
    const nights = Math.max(input.dayCount - 1, 0);
    const rooms = Math.ceil(travellers / 2);
    const oneWayKm = input.oneWayKm ?? input.distanceKm / 2;
    const assumptions: CostAssumption[] = [];
    let fuel = 0;
    let tolls = 0;
    let fares = 0;
    let localTransport = 0;
    let parking = 0;
    let fuelRequiredLitres = 0;
    const mileage = input.mileageKmPerLitre ?? RATES.defaultMileage;
    const fuelPrice = this.fuelPrice(input.fuelType);

    if (mode === 'CAR' || mode === 'BIKE') {
      fuelRequiredLitres = input.fuelType === FuelType.ELECTRIC ? 0 : input.distanceKm / mileage;
      fuel = Math.round(fuelRequiredLitres * fuelPrice);
      tolls = Math.round(input.distanceKm * RATES.tollPerKm[mode]);
      parking = input.dayCount * RATES.parkingPerDay[mode];
      assumptions.push(
        input.fuelType === FuelType.ELECTRIC
          ? { item: 'Fuel', basis: 'Electric vehicle: charging cost not estimated' }
          : {
              item: 'Fuel',
              basis: `${Math.round(input.distanceKm)} km ÷ ${mileage} km/l${input.mileageKmPerLitre ? '' : ' (typical)'} × ${format(fuelPrice)}/l`
            },
        { item: 'Tolls', basis: mode === 'BIKE' ? 'Two-wheelers are exempt on most national highways' : `${Math.round(input.distanceKm)} km × ${format(RATES.tollPerKm.CAR)}/km (average)` },
        { item: 'Parking', basis: `${input.dayCount} day(s) × ${format(RATES.parkingPerDay[mode])}` }
      );
    } else if (mode === 'BUS') {
      fares = Math.round(oneWayKm * 2 * RATES.busFarePerKm * travellers);
      localTransport = input.dayCount * RATES.localCabPerDay;
      assumptions.push(
        { item: 'Bus fares', basis: `${Math.round(oneWayKm)} km each way × ${format(RATES.busFarePerKm)}/km × ${travellers} traveller(s) (typical AC bus)` },
        { item: 'Local transport', basis: `${input.dayCount} day(s) × ${format(RATES.localCabPerDay)} for a local cab` }
      );
    } else {
      fares = Math.round((RATES.flightFareBase + oneWayKm * RATES.flightFarePerKm) * 2 * travellers);
      localTransport = RATES.airportTransfersPerPerson * travellers + input.dayCount * RATES.localCabPerDay;
      assumptions.push(
        { item: 'Flights', basis: `Return economy, about ${format(Math.round(RATES.flightFareBase + oneWayKm * RATES.flightFarePerKm))} each way per person (varies a lot with dates)` },
        { item: 'Local transport', basis: `Airport transfers plus ${input.dayCount} day(s) of local cab` }
      );
    }

    const stay = nights * rooms * RATES.roomPerNight;
    const food = input.dayCount * travellers * RATES.foodPerPersonDay;
    const activities =
      input.plannedActivityCost != null && input.plannedActivityCost > 0
        ? Math.round(input.plannedActivityCost)
        : input.dayCount * travellers * RATES.activitiesPerPersonDay;
    const subtotal = fuel + tolls + fares + localTransport + stay + food + activities + parking;
    const miscellaneous = Math.round(subtotal * RATES.miscellaneousShare);

    assumptions.push(
      { item: 'Stay', basis: `${nights} night(s) × ${rooms} room(s) × ${format(RATES.roomPerNight)} (typical mid-range, two per room)` },
      { item: 'Food', basis: `${input.dayCount} day(s) × ${travellers} × ${format(RATES.foodPerPersonDay)}` },
      {
        item: 'Activities',
        basis: input.plannedActivityCost ? 'Entry fees for the stops in your plan' : `${input.dayCount} day(s) × ${travellers} × ${format(RATES.activitiesPerPersonDay)} allowance`
      },
      { item: 'Buffer', basis: `${Math.round(RATES.miscellaneousShare * 100)}% for tips, snacks and surprises` }
    );

    return {
      fuel,
      tolls,
      fares,
      localTransport,
      stay,
      food,
      activities,
      parking,
      miscellaneous,
      total: subtotal + miscellaneous,
      fuelRequiredLitres: Math.round(fuelRequiredLitres * 10) / 10,
      fuelPricePerLitre: mode === 'CAR' || mode === 'BIKE' ? fuelPrice : 0,
      mileageKmPerLitre: mileage,
      isIndicative: true,
      assumptions
    };
  }

  private fuelPrice(fuelType?: FuelType | null): number {
    if (fuelType === FuelType.DIESEL) {
      return this.config.get<number>('pricing.dieselFuelPriceInr', 94);
    }

    if (fuelType === FuelType.ELECTRIC) {
      return 0;
    }

    return this.config.get<number>('pricing.petrolFuelPriceInr', 105);
  }
}
