import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TravelMode, TravellerGender } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { TripCostService } from '../itinerary/services/trip-cost.service';
import { TripsService } from './trips.service';

function storedTrip(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trip-1',
    userId: 'owner-1',
    title: 'Delhi to Rishikesh',
    sourceName: 'Delhi',
    sourceLatitude: 28.6139,
    sourceLongitude: 77.209,
    destinationName: 'Rishikesh',
    destinationLatitude: 30.0869,
    destinationLongitude: 78.2676,
    startDate: new Date('2026-10-10T00:00:00Z'),
    endDate: new Date('2026-10-12T00:00:00Z'),
    travellerCount: 2,
    travelMode: 'CAR',
    budget: 25000,
    interests: ['Nature'],
    preferences: [],
    notes: 'Private note about mum’s medication',
    vehicleId: 'vehicle-1',
    userVehicleId: 'garage-1',
    visibility: 'UNLISTED',
    shareSlug: 'abc123share',
    status: 'GENERATED',
    estimatedDistanceKm: 480,
    estimatedDurationMinutes: 640,
    estimatedTotalCost: 20000,
    estimatedFuelCost: 2800,
    vehicle: {
      id: 'vehicle-1',
      brand: 'Hyundai',
      model: 'Creta',
      type: 'CAR',
      fuelType: 'PETROL',
      averageMileage: 16
    },
    userVehicle: {
      id: 'garage-1',
      nickname: 'Family car',
      customMileage: 20,
      registrationNumber: 'HR98AC9791'
    },
    travellers: [
      { id: 't-1', fullName: 'Asha Singh', age: 29, gender: 'FEMALE', sortOrder: 1 }
    ],
    days: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

function createService(prisma: Record<string, unknown>, generator = vi.fn()) {
  return new TripsService(prisma as never, new TripCostService(new ConfigService()), {
    generateTripPlan: generator
  });
}

describe('TripsService', () => {
  it('creates a trip owned by the signed-in user with one traveller row per passenger', async () => {
    const tripCreate = vi.fn().mockImplementation(({ data }) =>
      storedTrip({
        travellerCount: data.travellerCount,
        travellers: data.travellers.create.map(
          (traveller: Record<string, unknown>, index: number) => ({
            id: `traveller-${index + 1}`,
            ...traveller
          })
        ),
        userVehicle: null,
        vehicle: null
      })
    );
    const service = createService({ trip: { create: tripCreate } });

    const result = await service.create(
      {
        source: { name: 'Delhi', latitude: 28.6139, longitude: 77.209 },
        destination: { name: 'Rishikesh', latitude: 30.0869, longitude: 78.2676 },
        startDate: '2026-10-10',
        endDate: '2026-10-12',
        travellerCount: 2,
        travellers: [
          { fullName: 'Asha Singh', age: 29, gender: TravellerGender.FEMALE },
          { fullName: 'Ravi Singh', age: 31, gender: TravellerGender.MALE }
        ],
        travelMode: TravelMode.CAR,
        interests: ['Nature'],
        preferences: ['Scenic route']
      },
      'owner-1'
    );

    expect(tripCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          user: { connect: { id: 'owner-1' } },
          travellerCount: 2,
          travellers: {
            create: [
              expect.objectContaining({ fullName: 'Asha Singh', sortOrder: 1 }),
              expect.objectContaining({ fullName: 'Ravi Singh', sortOrder: 2 })
            ]
          }
        })
      })
    );
    expect(result.travellers).toHaveLength(2);
  });

  it('rejects a saved vehicle that belongs to another user', async () => {
    const service = createService({
      userVehicle: { findFirst: vi.fn().mockResolvedValue(null) },
      trip: { create: vi.fn() }
    });

    await expect(
      service.create(
        {
          source: { name: 'Delhi', latitude: 28.6, longitude: 77.2 },
          destination: { name: 'Rishikesh', latitude: 30.08, longitude: 78.26 },
          startDate: '2026-10-10',
          endDate: '2026-10-12',
          travellerCount: 1,
          travellers: [{ fullName: 'Asha Singh', age: 29, gender: TravellerGender.FEMALE }],
          travelMode: TravelMode.CAR,
          interests: ['Nature'],
          userVehicleId: '5b0a5a4e-7f0c-4d7e-9a53-2f1f1f1f1f1f'
        },
        'owner-1'
      )
    ).rejects.toThrow(/Saved vehicle/);
  });

  it('only lists trips owned by the signed-in user', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = createService({ trip: { findMany } });

    await service.findAll('owner-1');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'owner-1' } })
    );
  });

  it('hides trips that belong to someone else', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = createService({ trip: { findFirst } });

    await expect(service.findById('trip-1', 'intruder-1')).rejects.toThrow(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'trip-1', userId: 'intruder-1' } })
    );
  });

  it('does not update or delete a trip owned by someone else', async () => {
    const update = vi.fn();
    const remove = vi.fn();
    const service = createService({
      trip: { findFirst: vi.fn().mockResolvedValue(null), update, delete: remove }
    });

    await expect(service.update('trip-1', { title: 'Mine now' }, 'intruder-1')).rejects.toThrow(
      NotFoundException
    );
    await expect(service.delete('trip-1', 'intruder-1')).rejects.toThrow(NotFoundException);
    expect(update).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it('uses the saved vehicle custom mileage for fuel estimates', async () => {
    const service = createService({
      trip: { findFirst: vi.fn().mockResolvedValue(storedTrip()) }
    });

    const trip = await service.findById('trip-1', 'owner-1');

    expect(trip.costBreakdown?.mileageKmPerLitre).toBe(20);
    expect(trip.costBreakdown?.fuelRequiredLitres).toBe(24);
  });

  it('falls back to catalog mileage when the saved vehicle has no custom value', async () => {
    const service = createService({
      trip: {
        findFirst: vi.fn().mockResolvedValue(
          storedTrip({
            userVehicle: {
              id: 'garage-1',
              nickname: null,
              customMileage: null,
              registrationNumber: null
            }
          })
        )
      }
    });

    const trip = await service.findById('trip-1', 'owner-1');

    expect(trip.costBreakdown?.mileageKmPerLitre).toBe(16);
  });

  it('serves shared trips without traveller details, notes, budget or owner', async () => {
    const findFirst = vi.fn().mockResolvedValue(storedTrip());
    const service = createService({ trip: { findFirst } });

    const shared = await service.findShared('abc123share');

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shareSlug: 'abc123share', visibility: 'UNLISTED' } })
    );
    expect(shared).not.toHaveProperty('travellers');
    expect(shared).not.toHaveProperty('notes');
    expect(shared).not.toHaveProperty('budget');
    expect(shared).not.toHaveProperty('userId');
    expect(shared).not.toHaveProperty('userVehicle');
    expect(JSON.stringify(shared)).not.toContain('HR98AC9791');
    expect(shared.travellerCount).toBe(2);
  });

  it('returns 404 for revoked or unknown share links', async () => {
    const service = createService({ trip: { findFirst: vi.fn().mockResolvedValue(null) } });

    await expect(service.findShared('revoked')).rejects.toThrow(NotFoundException);
  });

  it('creates a share slug on first share and reuses it afterwards', async () => {
    const update = vi.fn().mockImplementation(({ data }) => ({ id: 'trip-1', ...data }));
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({ id: 'trip-1', visibility: 'PRIVATE', shareSlug: null })
      .mockResolvedValueOnce({ id: 'trip-1', visibility: 'UNLISTED', shareSlug: 'existing' });
    const service = createService({ trip: { findFirst, update } });

    const first = await service.enableSharing('trip-1', 'owner-1');
    const second = await service.enableSharing('trip-1', 'owner-1');

    expect(first.visibility).toBe('UNLISTED');
    expect(first.shareSlug).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(second.shareSlug).toBe('existing');
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('revokes the share link when sharing is turned off', async () => {
    const update = vi.fn().mockImplementation(({ data }) => ({ id: 'trip-1', ...data }));
    const service = createService({
      trip: { findFirst: vi.fn().mockResolvedValue({ id: 'trip-1' }), update }
    });

    const result = await service.disableSharing('trip-1', 'owner-1');

    expect(result).toEqual({ id: 'trip-1', visibility: 'PRIVATE', shareSlug: null });
  });
});
