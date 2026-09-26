import { haversineKm } from '../../../common/utils/geo.util';
import { Injectable } from '@nestjs/common';

@Injectable()
export class TripDistanceService {
  estimateRoadDistanceKm(
    sourceLatitude: number,
    sourceLongitude: number,
    destinationLatitude: number,
    destinationLongitude: number
  ): number {
    const straightLineDistance = haversineKm(
      sourceLatitude,
      sourceLongitude,
      destinationLatitude,
      destinationLongitude
    );

    return Math.round(straightLineDistance * 1.35);
  }

  estimateRoundTripDistanceKm(oneWayDistanceKm: number): number {
    return Math.round(oneWayDistanceKm * 2);
  }

  estimateDurationMinutes(distanceKm: number): number {
    return Math.round((distanceKm / 45) * 60);
  }
}
