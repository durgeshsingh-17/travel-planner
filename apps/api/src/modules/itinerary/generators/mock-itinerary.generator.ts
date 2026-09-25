import { Injectable } from '@nestjs/common';
import { TripActivityType } from '@prisma/client';

import {
  GeneratedTripActivity,
  GeneratedTripDay,
  GeneratedTripPlan,
  ItineraryGenerator,
  ItineraryGeneratorInput
} from '../contracts/itinerary-generator.contract';
import { TripDistanceService } from '../services/trip-distance.service';
import { toDateOnly, toIsoDate } from '../../../common/utils/date.util';

@Injectable()
export class MockItineraryGenerator implements ItineraryGenerator {
  constructor(private readonly distanceService: TripDistanceService) {}

  generateTripPlan(input: ItineraryGeneratorInput): GeneratedTripPlan {
    const oneWayDistance = this.distanceService.estimateRoadDistanceKm(
      input.sourceLatitude,
      input.sourceLongitude,
      input.destinationLatitude,
      input.destinationLongitude
    );
    const totalDistance = this.distanceService.estimateRoundTripDistanceKm(oneWayDistance);
    const dayCount = this.calculateDayCount(input.startDate, input.endDate);
    const days = this.buildDays(input, oneWayDistance, dayCount);

    return {
      estimatedDistanceKm: totalDistance,
      estimatedDurationMinutes: this.distanceService.estimateDurationMinutes(totalDistance),
      days
    };
  }

  private buildDays(
    input: ItineraryGeneratorInput,
    oneWayDistance: number,
    dayCount: number
  ): GeneratedTripDay[] {
    const days: GeneratedTripDay[] = [
      this.arrivalDay(input, oneWayDistance, 1)
    ];

    for (let dayNumber = 2; dayNumber < dayCount; dayNumber += 1) {
      days.push(this.localDay(input, dayNumber));
    }

    if (dayCount > 1) {
      days.push(this.returnDay(input, oneWayDistance, dayCount));
    }

    return days;
  }

  private arrivalDay(
    input: ItineraryGeneratorInput,
    oneWayDistance: number,
    dayNumber: number
  ): GeneratedTripDay {
    return {
      dayNumber,
      date: this.dateForDay(input.startDate, dayNumber),
      title: `${input.sourceName} to ${input.destinationName}`,
      description: 'Early start, highway breaks and a relaxed arrival.',
      estimatedDistanceKm: oneWayDistance,
      estimatedCost: 2600,
      activities: [
        this.activity('Leave ' + input.sourceName, TripActivityType.TRAVEL, '05:00', 1, {
          description: 'Start before traffic and keep the first leg calm.',
          latitude: input.sourceLatitude,
          longitude: input.sourceLongitude
        }),
        this.activity('Breakfast near Murthal', TripActivityType.MEAL, '08:00', 2, {
          description: 'Classic highway breakfast stop.',
          estimatedCost: 450,
          distanceFromPreviousKm: 65,
          travelTimeFromPreviousMinutes: 90
        }),
        this.activity('Chandigarh break', TripActivityType.BREAK, '11:00', 3, {
          description: 'Refuel, stretch and reset before the hill section.',
          estimatedCost: 250,
          distanceFromPreviousKm: 180,
          travelTimeFromPreviousMinutes: 210
        }),
        this.activity('Lunch stop', TripActivityType.MEAL, '14:00', 4, {
          description: 'Simple local lunch before entering the valley roads.',
          estimatedCost: 700
        }),
        this.activity('Reach ' + input.destinationName, TripActivityType.CHECK_IN, '18:30', 5, {
          description: 'Check in and settle down near the riverside.',
          latitude: input.destinationLatitude,
          longitude: input.destinationLongitude,
          distanceFromPreviousKm: oneWayDistance - 245,
          travelTimeFromPreviousMinutes: 330
        }),
        this.activity('Riverside walk', TripActivityType.ACTIVITY, '19:30', 6, {
          description: 'Keep the evening light after a long drive.',
          estimatedCost: 0
        })
      ]
    };
  }

  private localDay(input: ItineraryGeneratorInput, dayNumber: number): GeneratedTripDay {
    const isSecondDay = dayNumber === 2;

    return {
      dayNumber,
      date: this.dateForDay(input.startDate, dayNumber),
      title: isSecondDay ? 'Jalori Pass and Serolsar Lake' : `${input.destinationName} slow exploration`,
      description: isSecondDay
        ? 'A mountain day with viewpoints, forest trails and cafe time.'
        : 'Keep the day flexible with local food, viewpoints and rest.',
      estimatedDistanceKm: isSecondDay ? 74 : 32,
      estimatedCost: isSecondDay ? 3400 : 2400,
      activities: isSecondDay
        ? [
            this.activity('Breakfast at the stay', TripActivityType.MEAL, '08:30', 1, {
              estimatedCost: 500
            }),
            this.activity('Jalori Pass drive', TripActivityType.TRAVEL, '10:00', 2, {
              description: 'Scenic mountain road with photo stops.',
              estimatedCost: 0,
              distanceFromPreviousKm: 32,
              travelTimeFromPreviousMinutes: 90
            }),
            this.activity('Serolsar Lake trail', TripActivityType.ACTIVITY, '12:00', 3, {
              description: 'Forest walk and lake views.',
              estimatedCost: 300,
              distanceFromPreviousKm: 5,
              travelTimeFromPreviousMinutes: 20
            }),
            this.activity('Lunch near Shoja', TripActivityType.MEAL, '14:30', 4, {
              estimatedCost: 900
            }),
            this.activity('Local cafe evening', TripActivityType.ACTIVITY, '17:30', 5, {
              estimatedCost: 700
            })
          ]
        : [
            this.activity('Late breakfast', TripActivityType.MEAL, '09:30', 1, {
              estimatedCost: 550
            }),
            this.activity('Village walk', TripActivityType.ACTIVITY, '11:00', 2, {
              description: 'Explore lanes, bridges and local views.',
              estimatedCost: 0
            }),
            this.activity('Local lunch', TripActivityType.MEAL, '14:00', 3, {
              estimatedCost: 850
            }),
            this.activity('Viewpoint sunset', TripActivityType.ACTIVITY, '17:00', 4, {
              estimatedCost: 200
            })
          ]
    };
  }

  private returnDay(
    input: ItineraryGeneratorInput,
    oneWayDistance: number,
    dayNumber: number
  ): GeneratedTripDay {
    return {
      dayNumber,
      date: this.dateForDay(input.startDate, dayNumber),
      title: `${input.destinationName} to ${input.sourceName}`,
      description: 'Checkout, local breakfast and return journey.',
      estimatedDistanceKm: oneWayDistance,
      estimatedCost: 2400,
      activities: [
        this.activity('Local breakfast', TripActivityType.MEAL, '08:00', 1, {
          estimatedCost: 500
        }),
        this.activity('Checkout', TripActivityType.CHECK_OUT, '09:00', 2),
        this.activity('Return journey begins', TripActivityType.TRAVEL, '09:30', 3, {
          latitude: input.destinationLatitude,
          longitude: input.destinationLongitude,
          distanceFromPreviousKm: 0
        }),
        this.activity('Lunch break', TripActivityType.MEAL, '14:00', 4, {
          estimatedCost: 700,
          distanceFromPreviousKm: 210,
          travelTimeFromPreviousMinutes: 270
        }),
        this.activity('Reach ' + input.sourceName, TripActivityType.TRAVEL, '20:30', 5, {
          latitude: input.sourceLatitude,
          longitude: input.sourceLongitude,
          distanceFromPreviousKm: oneWayDistance - 210,
          travelTimeFromPreviousMinutes: 390
        })
      ]
    };
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
