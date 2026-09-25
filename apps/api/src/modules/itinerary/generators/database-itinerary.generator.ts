import { Injectable } from '@nestjs/common';
import { Place, PlaceCategory, TripActivityType } from '@prisma/client';

import {
  GeneratedTripActivity,
  GeneratedTripDay,
  GeneratedTripPlan,
  ItineraryGenerator,
  ItineraryGeneratorInput
} from '../contracts/itinerary-generator.contract';
import { PrismaService } from '../../../database/prisma.service';
import { TripDistanceService } from '../services/trip-distance.service';
import { decimalToNumber } from '../../../common/utils/number.util';
import { toDateOnly, toIsoDate } from '../../../common/utils/date.util';

type PlaceForPlan = Place;

const mealPlaceCategories: PlaceCategory[] = [PlaceCategory.FOOD, PlaceCategory.CAFE];
const scenicPlaceCategories: PlaceCategory[] = [PlaceCategory.VIEWPOINT, PlaceCategory.ATTRACTION];
const activityPlaceCategories: PlaceCategory[] = [
  PlaceCategory.ACTIVITY,
  PlaceCategory.ATTRACTION,
  PlaceCategory.VIEWPOINT
];

@Injectable()
export class DatabaseItineraryGenerator implements ItineraryGenerator {
  constructor(
    private readonly distanceService: TripDistanceService,
    private readonly prisma: PrismaService
  ) {}

  async generateTripPlan(input: ItineraryGeneratorInput): Promise<GeneratedTripPlan> {
    const oneWayDistance = this.distanceService.estimateRoadDistanceKm(
      input.sourceLatitude,
      input.sourceLongitude,
      input.destinationLatitude,
      input.destinationLongitude
    );
    const totalDistance = this.distanceService.estimateRoundTripDistanceKm(oneWayDistance);
    const dayCount = this.calculateDayCount(input.startDate, input.endDate);
    const places = await this.findDestinationPlaces(input);
    const rankedPlaces = this.rankPlaces(places, input);
    const days = this.buildDays(input, rankedPlaces, oneWayDistance, dayCount);

    return {
      estimatedDistanceKm: totalDistance,
      estimatedDurationMinutes: this.distanceService.estimateDurationMinutes(totalDistance),
      days
    };
  }

  private async findDestinationPlaces(input: ItineraryGeneratorInput): Promise<PlaceForPlan[]> {
    const destination = await this.prisma.destination.findFirst({
      where: {
        OR: [
          {
            name: {
              equals: input.destinationName,
              mode: 'insensitive'
            }
          },
          {
            latitude: {
              gte: input.destinationLatitude - 0.02,
              lte: input.destinationLatitude + 0.02
            },
            longitude: {
              gte: input.destinationLongitude - 0.02,
              lte: input.destinationLongitude + 0.02
            }
          }
        ]
      },
      include: {
        places: true
      }
    });

    return destination?.places ?? [];
  }

  private buildDays(
    input: ItineraryGeneratorInput,
    places: PlaceForPlan[],
    oneWayDistance: number,
    dayCount: number
  ): GeneratedTripDay[] {
    if (dayCount === 1) {
      return [this.singleDay(input, places, oneWayDistance)];
    }

    const days: GeneratedTripDay[] = [
      this.arrivalDay(input, places.slice(0, 1), oneWayDistance)
    ];
    const middleDayCount = Math.max(dayCount - 2, 0);
    const middlePlaces = places.slice(1);

    for (let index = 0; index < middleDayCount; index += 1) {
      const dayPlaces = this.pickPlacesForDay(middlePlaces, index);
      days.push(this.localDay(input, dayPlaces, index + 2));
    }

    days.push(this.returnDay(input, oneWayDistance, dayCount));
    return days;
  }

  private singleDay(
    input: ItineraryGeneratorInput,
    places: PlaceForPlan[],
    oneWayDistance: number
  ): GeneratedTripDay {
    const dayPlaces = places.slice(0, 2);
    const activities: GeneratedTripActivity[] = [
      this.activity(`Leave ${input.sourceName}`, TripActivityType.TRAVEL, '06:00', 1, {
        description: `Drive from ${input.sourceName} to ${input.destinationName}.`,
        latitude: input.sourceLatitude,
        longitude: input.sourceLongitude,
        distanceFromPreviousKm: 0
      }),
      this.activity(`Arrive at ${input.destinationName}`, TripActivityType.CHECK_IN, '11:00', 2, {
        description: 'Arrive, park and take a short reset before exploring.',
        latitude: input.destinationLatitude,
        longitude: input.destinationLongitude,
        distanceFromPreviousKm: oneWayDistance,
        travelTimeFromPreviousMinutes: this.distanceService.estimateDurationMinutes(oneWayDistance)
      }),
      ...this.placeActivities(dayPlaces, 3, input.travellerCount),
      this.activity(`Return to ${input.sourceName}`, TripActivityType.TRAVEL, '18:00', 10, {
        description: 'Begin return journey after local exploration.',
        latitude: input.sourceLatitude,
        longitude: input.sourceLongitude,
        distanceFromPreviousKm: oneWayDistance,
        travelTimeFromPreviousMinutes: this.distanceService.estimateDurationMinutes(oneWayDistance)
      })
    ];

    return {
      dayNumber: 1,
      date: this.dateForDay(input.startDate, 1),
      title: `${input.sourceName} to ${input.destinationName} day trip`,
      description: this.planDescription(input, 'A compact same-day plan using available destination places.'),
      estimatedDistanceKm: oneWayDistance * 2,
      estimatedCost: this.estimateDayCost(activities, input.travellerCount),
      activities
    };
  }

  private arrivalDay(
    input: ItineraryGeneratorInput,
    places: PlaceForPlan[],
    oneWayDistance: number
  ): GeneratedTripDay {
    const activities: GeneratedTripActivity[] = [
      this.activity(`Leave ${input.sourceName}`, TripActivityType.TRAVEL, '06:00', 1, {
        description: `Start toward ${input.destinationName}.`,
        latitude: input.sourceLatitude,
        longitude: input.sourceLongitude
      }),
      this.activity(`Reach ${input.destinationName}`, TripActivityType.CHECK_IN, '15:30', 2, {
        description: 'Check in, freshen up and keep the first evening light.',
        latitude: input.destinationLatitude,
        longitude: input.destinationLongitude,
        distanceFromPreviousKm: oneWayDistance,
        travelTimeFromPreviousMinutes: this.distanceService.estimateDurationMinutes(oneWayDistance)
      }),
      ...this.placeActivities(places, 3, input.travellerCount, ['17:00'])
    ];

    return {
      dayNumber: 1,
      date: this.dateForDay(input.startDate, 1),
      title: `${input.sourceName} to ${input.destinationName}`,
      description: this.planDescription(input, 'Travel day with a light destination activity after arrival.'),
      estimatedDistanceKm: oneWayDistance,
      estimatedCost: this.estimateDayCost(activities, input.travellerCount),
      activities
    };
  }

  private localDay(
    input: ItineraryGeneratorInput,
    places: PlaceForPlan[],
    dayNumber: number
  ): GeneratedTripDay {
    const activities = [
      this.activity('Breakfast and day briefing', TripActivityType.MEAL, '08:30', 1, {
        estimatedCost: input.travellerCount * 350
      }),
      ...this.placeActivities(places, 2, input.travellerCount),
      this.activity('Flexible local dinner', TripActivityType.MEAL, '19:30', 9, {
        description: 'Keep dinner flexible around the last stop and traveller pace.',
        estimatedCost: input.travellerCount * 650
      })
    ];

    return {
      dayNumber,
      date: this.dateForDay(input.startDate, dayNumber),
      title: places.length
        ? `${input.destinationName}: ${places.map((place) => place.name).join(' + ')}`
        : `${input.destinationName} local exploration`,
      description: this.planDescription(input, 'Local exploration built from saved destination places.'),
      estimatedDistanceKm: Math.max(18, places.length * 12),
      estimatedCost: this.estimateDayCost(activities, input.travellerCount),
      activities
    };
  }

  private returnDay(
    input: ItineraryGeneratorInput,
    oneWayDistance: number,
    dayNumber: number
  ): GeneratedTripDay {
    const activities = [
      this.activity('Checkout', TripActivityType.CHECK_OUT, '09:00', 1, {
        description: 'Checkout after breakfast and settle bills.'
      }),
      this.activity(`Return to ${input.sourceName}`, TripActivityType.TRAVEL, '09:30', 2, {
        description: `Drive back from ${input.destinationName} to ${input.sourceName}.`,
        latitude: input.sourceLatitude,
        longitude: input.sourceLongitude,
        distanceFromPreviousKm: oneWayDistance,
        travelTimeFromPreviousMinutes: this.distanceService.estimateDurationMinutes(oneWayDistance)
      })
    ];

    return {
      dayNumber,
      date: this.dateForDay(input.startDate, dayNumber),
      title: `${input.destinationName} to ${input.sourceName}`,
      description: 'Return journey with buffer for breaks and traffic.',
      estimatedDistanceKm: oneWayDistance,
      estimatedCost: this.estimateDayCost(activities, input.travellerCount),
      activities
    };
  }

  private pickPlacesForDay(places: PlaceForPlan[], dayIndex: number): PlaceForPlan[] {
    const placesPerDay = 3;
    const start = dayIndex * placesPerDay;
    const picked = places.slice(start, start + placesPerDay);

    if (picked.length > 0) {
      return picked;
    }

    return places.slice(0, Math.min(places.length, placesPerDay));
  }

  private placeActivities(
    places: PlaceForPlan[],
    startSortOrder: number,
    travellerCount: number,
    startTimes = ['10:00', '13:00', '16:00']
  ): GeneratedTripActivity[] {
    return places.map((place, index) =>
      this.activity(
        place.name,
        this.resolveActivityType(place.category),
        startTimes[index] ?? '16:30',
        startSortOrder + index,
        {
          placeId: place.id,
          description: place.description,
          latitude: decimalToNumber(place.latitude) ?? undefined,
          longitude: decimalToNumber(place.longitude) ?? undefined,
          estimatedCost: Math.round((decimalToNumber(place.estimatedCost) ?? 0) * travellerCount),
          distanceFromPreviousKm: index === 0 ? 8 : 4,
          travelTimeFromPreviousMinutes: index === 0 ? 25 : 15
        }
      )
    );
  }

  private rankPlaces(
    places: PlaceForPlan[],
    input: ItineraryGeneratorInput
  ): PlaceForPlan[] {
    return [...places].sort((left, right) => {
      const scoreDelta = this.placeScore(right, input) - this.placeScore(left, input);

      if (scoreDelta !== 0) {
        return scoreDelta;
      }

      return (decimalToNumber(right.rating) ?? 0) - (decimalToNumber(left.rating) ?? 0);
    });
  }

  private placeScore(place: PlaceForPlan, input: ItineraryGeneratorInput): number {
    const signals = [...input.interests, ...input.preferences].join(' ').toLowerCase();
    let score = decimalToNumber(place.rating) ?? 0;

    if (/food|cafe|coffee/.test(signals) && mealPlaceCategories.includes(place.category)) {
      score += 5;
    }

    if (
      /nature|mountain|peace|photography|scenic/.test(signals) &&
      scenicPlaceCategories.includes(place.category)
    ) {
      score += 4;
    }

    if (
      /adventure|active|hike|rafting/.test(signals) &&
      activityPlaceCategories.includes(place.category)
    ) {
      score += 4;
    }

    if (/family|less crowded/.test(signals)) {
      score += place.estimatedCost ? 1 : 2;
    }

    return score;
  }

  private resolveActivityType(category: PlaceCategory): TripActivityType {
    if (mealPlaceCategories.includes(category)) {
      return TripActivityType.MEAL;
    }

    if (category === PlaceCategory.HOTEL) {
      return TripActivityType.CHECK_IN;
    }

    if (activityPlaceCategories.includes(category)) {
      return TripActivityType.ACTIVITY;
    }

    return TripActivityType.SIGHTSEEING;
  }

  private activity(
    title: string,
    activityType: TripActivityType,
    startTime: string,
    sortOrder: number,
    rest: Omit<GeneratedTripActivity, 'title' | 'activityType' | 'startTime' | 'sortOrder'> = {}
  ): GeneratedTripActivity {
    return {
      title,
      activityType,
      startTime,
      sortOrder,
      ...rest
    };
  }

  private estimateDayCost(
    activities: GeneratedTripActivity[],
    travellerCount: number
  ): number {
    const activityCost = activities.reduce(
      (total, activity) => total + (activity.estimatedCost ?? 0),
      0
    );

    return Math.round(activityCost + travellerCount * 900);
  }

  private planDescription(input: ItineraryGeneratorInput, fallback: string): string {
    const preferenceText = input.preferences.length
      ? ` Preferences considered: ${input.preferences.join(', ')}.`
      : '';
    const notesText = input.notes ? ` Notes: ${input.notes}` : '';

    return `${fallback}${preferenceText}${notesText}`;
  }

  private calculateDayCount(startDate: string, endDate: string): number {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.max(
      1,
      Math.round((toDateOnly(endDate).getTime() - toDateOnly(startDate).getTime()) / millisecondsPerDay) + 1
    );
  }

  private dateForDay(startDate: string, dayNumber: number): string {
    const date = toDateOnly(startDate);
    date.setUTCDate(date.getUTCDate() + dayNumber - 1);
    return toIsoDate(date);
  }
}
