import { describe, expect, it, vi } from 'vitest';

import { LocationsService } from './locations.service';

describe('LocationsService', () => {
  it('searches active locations by query and serializes coordinates', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'location-1',
        name: 'Delhi',
        slug: 'delhi',
        state: 'Delhi',
        country: 'India',
        latitude: 28.6139,
        longitude: 77.209,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);
    const service = new LocationsService({
      location: {
        findMany
      }
    } as never);

    const result = await service.findAll({ q: 'del', limit: 30 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 30,
        where: expect.objectContaining({
          isActive: true,
          OR: expect.any(Array)
        })
      })
    );
    expect(result).toEqual([
      expect.objectContaining({
        name: 'Delhi',
        latitude: 28.6139,
        longitude: 77.209
      })
    ]);
  });
});
