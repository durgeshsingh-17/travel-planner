import { describe, expect, it, vi } from 'vitest';

import { LocationsService } from './locations.service';

const location = (id: string, name: string) => ({
  id,
  name,
  slug: name.toLowerCase(),
  state: 'Haryana',
  country: 'India',
  latitude: 28.4595,
  longitude: 77.0266,
  aliases: name === 'Gurugram' ? ['Gurgaon'] : [],
  popularity: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date()
});

describe('LocationsService', () => {
  it('searches names and aliases, keeping the ranked order from the search query', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ id: 'loc-2' }, { id: 'loc-1' }]);
    const findMany = vi
      .fn()
      .mockResolvedValue([location('loc-1', 'Gurugram Sector'), location('loc-2', 'Gurugram')]);
    const service = new LocationsService({ $queryRaw: queryRaw, location: { findMany } } as never);

    const result = await service.findAll({ q: 'gurgaon', limit: 30 });

    expect(queryRaw).toHaveBeenCalledTimes(1);
    const sql = queryRaw.mock.calls[0][0] as { sql: string; values: unknown[] };
    expect(sql.sql).toContain('unnest("aliases")');
    expect(sql.values).toContain('%gurgaon%');
    expect(result.map((entry) => entry.id)).toEqual(['loc-2', 'loc-1']);
    expect(result[0]).toMatchObject({ name: 'Gurugram', latitude: 28.4595, longitude: 77.0266 });
  });

  it('escapes LIKE wildcards typed by the user', async () => {
    const queryRaw = vi.fn().mockResolvedValue([]);
    const service = new LocationsService({ $queryRaw: queryRaw, location: { findMany: vi.fn().mockResolvedValue([]) } } as never);

    await service.findAll({ q: '100%_off' });

    expect((queryRaw.mock.calls[0][0] as { values: unknown[] }).values).toContain('%100\\%\\_off%');
  });

  it('lists popular active locations when there is no query', async () => {
    const findMany = vi.fn().mockResolvedValue([location('loc-1', 'Delhi')]);
    const service = new LocationsService({ location: { findMany } } as never);

    await service.findAll({ limit: 10 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true, state: undefined }, take: 10 })
    );
  });
});
