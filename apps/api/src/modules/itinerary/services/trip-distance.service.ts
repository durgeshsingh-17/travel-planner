import { Injectable } from '@nestjs/common';

@Injectable()
export class TripDistanceService {
  estimateRoadDistanceKm(
    sourceLatitude: number,
    sourceLongitude: number,
    destinationLatitude: number,
    destinationLongitude: number
  ): number {
    const straightLineDistance = this.haversineKm(
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

  private haversineKm(
    startLatitude: number,
    startLongitude: number,
    endLatitude: number,
    endLongitude: number
  ): number {
    const earthRadiusKm = 6371;
    const latitudeDelta = this.toRadians(endLatitude - startLatitude);
    const longitudeDelta = this.toRadians(endLongitude - startLongitude);
    const startLatRad = this.toRadians(startLatitude);
    const endLatRad = this.toRadians(endLatitude);

    const a =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(startLatRad) *
        Math.cos(endLatRad) *
        Math.sin(longitudeDelta / 2) ** 2;

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private toRadians(value: number): number {
    return (value * Math.PI) / 180;
  }
}
