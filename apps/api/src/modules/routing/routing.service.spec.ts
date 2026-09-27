import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RoutingService } from './routing.service';

const delhi = { latitude: 28.6139, longitude: 77.209 };
const rishikesh = { latitude: 30.0869, longitude: 78.2676 };

function service(provider: string, cache: Record<string, unknown> | null = null) {
  const prisma = {
    routeCache: { findUnique: vi.fn().mockResolvedValue(cache), upsert: vi.fn() }
  };
  return {
    prisma,
    routing: new RoutingService(prisma as never, new ConfigService({ routing: { provider, osrmBaseUrl: 'https://osrm.test', timeoutMs: 1000, cacheDays: 30 } }))
  };
}

describe('RoutingService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('estimates a road route offline, slower by bike and bus', async () => {
    const { routing } = service('estimate');

    const car = await routing.route(delhi, rishikesh, 'CAR');
    const bike = await routing.route(delhi, rishikesh, 'BIKE');

    expect(car).toMatchObject({ provider: 'estimate', estimated: true, polyline: null });
    expect(car.distanceKm).toBeGreaterThan(220);
    expect(bike.durationMinutes).toBeGreaterThan(car.durationMinutes);
  });

  it('treats flights as air distance plus airport time', async () => {
    const { routing } = service('osrm');
    const flight = await routing.route(delhi, rishikesh, 'FLIGHT');

    expect(flight.provider).toBe('air');
    expect(flight.durationMinutes).toBeGreaterThan(180);
  });

  it('calls OSRM once, caches the answer, and scales duration by mode', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ code: 'Ok', routes: [{ distance: 243_400, duration: 5 * 3600, geometry: 'abc' }] })
    });
    vi.stubGlobal('fetch', fetchMock);
    const { routing, prisma } = service('osrm');

    const bus = await routing.route(delhi, rishikesh, 'BUS');

    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/route/v1/driving/77.209,28.6139;78.2676,30.0869'), expect.anything());
    expect(bus).toMatchObject({ provider: 'osrm', estimated: false, distanceKm: 243.4, durationMinutes: 390, polyline: 'abc' });
    expect(prisma.routeCache.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'driving:28.614,77.209>30.087,78.268' } })
    );
  });

  it('uses a fresh cache entry without calling the router', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { routing } = service('osrm', { distanceKm: 240, durationMinutes: 300, polyline: null, createdAt: new Date() });

    expect((await routing.route(delhi, rishikesh, 'CAR')).durationMinutes).toBe(300);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to an estimate when the router fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')));
    const { routing } = service('osrm');

    expect((await routing.route(delhi, rishikesh, 'CAR')).provider).toBe('estimate');
  });
});
