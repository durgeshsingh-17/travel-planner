import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { SavedTripsService } from './saved-trips.service';

function tripRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trip-1',
    userId: 'owner-1',
    title: 'Delhi to Rishikesh',
    sourceName: 'Delhi',
    destinationName: 'Rishikesh',
    startDate: new Date('2026-10-10T00:00:00Z'),
    endDate: new Date('2026-10-12T00:00:00Z'),
    travellerCount: 2,
    travelMode: 'CAR',
    status: 'GENERATED',
    visibility: 'PRIVATE',
    shareSlug: null,
    estimatedDistanceKm: 480,
    estimatedTotalCost: 20000,
    ...overrides
  };
}

describe('SavedTripsService', () => {
  it('refuses to save another user’s private trip', async () => {
    const upsert = vi.fn();
    const service = new SavedTripsService({
      trip: { findFirst: vi.fn().mockResolvedValue(null) },
      savedItem: { upsert }
    } as never);

    await expect(service.save('intruder-1', 'trip-1')).rejects.toThrow(NotFoundException);
    expect(upsert).not.toHaveBeenCalled();
  });

  it('saves own trips idempotently', async () => {
    const upsert = vi.fn().mockResolvedValue({ createdAt: new Date('2026-09-27T00:00:00Z') });
    const service = new SavedTripsService({
      trip: { findFirst: vi.fn().mockResolvedValue(tripRow()) },
      savedItem: { upsert }
    } as never);

    const result = await service.save('owner-1', 'trip-1');

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_tripId: { userId: 'owner-1', tripId: 'trip-1' } },
        update: {}
      })
    );
    expect(result).toMatchObject({ tripId: 'trip-1', isOwner: true, available: true });
  });

  it('hides details of a saved trip its owner stopped sharing', async () => {
    const service = new SavedTripsService({
      savedItem: {
        findMany: vi.fn().mockResolvedValue([
          { createdAt: new Date(), trip: tripRow({ userId: 'someone-else' }) },
          {
            createdAt: new Date(),
            trip: tripRow({
              id: 'trip-2',
              userId: 'someone-else',
              visibility: 'UNLISTED',
              shareSlug: 'shared-slug'
            })
          }
        ])
      }
    } as never);

    const [revoked, shared] = await service.findAll('viewer-1');

    expect(revoked).toMatchObject({ available: false, trip: null, shareSlug: null });
    expect(shared).toMatchObject({ available: true, shareSlug: 'shared-slug' });
  });

  it('imports only trips the user can see', async () => {
    const createMany = vi.fn();
    const service = new SavedTripsService({
      trip: { findMany: vi.fn().mockResolvedValue([{ id: 'trip-1' }]) },
      savedItem: { createMany, findMany: vi.fn().mockResolvedValue([]) }
    } as never);

    await service.import('owner-1', ['trip-1', 'trip-1', 'trip-9']);

    expect(createMany).toHaveBeenCalledWith({
      data: [{ userId: 'owner-1', tripId: 'trip-1', type: 'TRIP' }],
      skipDuplicates: true
    });
  });
});
