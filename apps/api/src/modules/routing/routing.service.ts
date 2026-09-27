import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TravelMode } from '@prisma/client';

import { LatLng } from '../../common/utils/polyline.util';
import { PrismaService } from '../../database/prisma.service';
import { haversineKm } from '../../common/utils/geo.util';

export interface RouteLeg {
  distanceKm: number;
  durationMinutes: number;
  /** Encoded polyline (precision 5) when a road router answered. */
  polyline: string | null;
  provider: 'osrm' | 'estimate' | 'air';
  /** True when the numbers are an approximation rather than a road route. */
  estimated: boolean;
}

/** Average door-to-door road speeds used when no router is available (km/h). */
const ESTIMATE_SPEED: Record<Exclude<TravelMode, 'FLIGHT'>, number> = { CAR: 50, BIKE: 42, BUS: 40 };
/** Router durations are for cars; bikes and buses are slower on the same road. */
const ROUTER_TIME_FACTOR: Record<Exclude<TravelMode, 'FLIGHT'>, number> = { CAR: 1, BIKE: 1.15, BUS: 1.3 };
const ROAD_WINDING_FACTOR = 1.35;

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);
  private readonly provider: string;
  private readonly osrmBaseUrl: string;
  private readonly timeoutMs: number;
  private readonly cacheMs: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService
  ) {
    this.provider = config.get<string>('routing.provider') ?? 'estimate';
    this.osrmBaseUrl = (config.get<string>('routing.osrmBaseUrl') ?? '').replace(/\/$/, '');
    this.timeoutMs = config.get<number>('routing.timeoutMs') ?? 4000;
    this.cacheMs = (config.get<number>('routing.cacheDays') ?? 30) * 24 * 60 * 60 * 1000;
  }

  /**
   * Road route between two points. Uses the cache, then the configured router,
   * and falls back to a straight-line estimate so trip planning never fails
   * because a router is down.
   */
  async route(from: LatLng, to: LatLng, mode: TravelMode): Promise<RouteLeg> {
    if (mode === 'FLIGHT') {
      return this.flight(from, to);
    }

    if (this.provider !== 'osrm') {
      return this.estimate(from, to, mode);
    }

    const key = this.cacheKey(from, to);
    const cached = await this.prisma.routeCache.findUnique({ where: { key } });

    if (cached && Date.now() - cached.createdAt.getTime() < this.cacheMs) {
      return this.forMode(
        { distanceKm: Number(cached.distanceKm), durationMinutes: cached.durationMinutes, polyline: cached.polyline },
        mode
      );
    }

    try {
      const leg = await this.osrm(from, to);
      await this.prisma.routeCache.upsert({
        where: { key },
        update: { ...leg, provider: 'osrm', createdAt: new Date() },
        create: { key, ...leg, provider: 'osrm' }
      });
      return this.forMode(leg, mode);
    } catch (error) {
      this.logger.warn(`Road router unavailable, using an estimate: ${(error as Error).message}`);
      return this.estimate(from, to, mode);
    }
  }

  /** Straight-line distance with a winding factor, at typical Indian road speeds. */
  estimate(from: LatLng, to: LatLng, mode: Exclude<TravelMode, 'FLIGHT'>): RouteLeg {
    const distanceKm = Math.round(haversineKm(from.latitude, from.longitude, to.latitude, to.longitude) * ROAD_WINDING_FACTOR);

    return {
      distanceKm,
      durationMinutes: Math.round((distanceKm / ESTIMATE_SPEED[mode]) * 60),
      polyline: null,
      provider: 'estimate',
      estimated: true
    };
  }

  private flight(from: LatLng, to: LatLng): RouteLeg {
    const distanceKm = Math.round(haversineKm(from.latitude, from.longitude, to.latitude, to.longitude));
    // Air time at ~700 km/h plus about three hours of airport time and transfers.
    return {
      distanceKm,
      durationMinutes: Math.round((distanceKm / 700) * 60) + 180,
      polyline: null,
      provider: 'air',
      estimated: true
    };
  }

  private async osrm(from: LatLng, to: LatLng): Promise<{ distanceKm: number; durationMinutes: number; polyline: string | null }> {
    const coordinates = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
    const response = await fetch(
      `${this.osrmBaseUrl}/route/v1/driving/${coordinates}?overview=simplified&geometries=polyline`,
      { signal: AbortSignal.timeout(this.timeoutMs), headers: { 'User-Agent': 'travel-platform/1.0' } }
    );

    if (!response.ok) {
      throw new Error(`OSRM answered ${response.status}`);
    }

    const body = (await response.json()) as {
      code?: string;
      routes?: Array<{ distance: number; duration: number; geometry?: string }>;
    };
    const route = body.routes?.[0];

    if (body.code !== 'Ok' || !route) {
      throw new Error(`OSRM found no route (${body.code ?? 'unknown'})`);
    }

    return {
      distanceKm: Math.round(route.distance / 100) / 10,
      durationMinutes: Math.round(route.duration / 60),
      polyline: route.geometry ?? null
    };
  }

  private forMode(
    leg: { distanceKm: number; durationMinutes: number; polyline: string | null },
    mode: Exclude<TravelMode, 'FLIGHT'>
  ): RouteLeg {
    return {
      distanceKm: leg.distanceKm,
      durationMinutes: Math.round(leg.durationMinutes * ROUTER_TIME_FACTOR[mode]),
      polyline: leg.polyline,
      provider: 'osrm',
      estimated: false
    };
  }

  /** ~100 m precision: nearby requests share one cached route. */
  private cacheKey(from: LatLng, to: LatLng): string {
    const point = (value: LatLng) => `${value.latitude.toFixed(3)},${value.longitude.toFixed(3)}`;
    return `driving:${point(from)}>${point(to)}`;
  }
}
