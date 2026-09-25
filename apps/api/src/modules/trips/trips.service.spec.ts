import { ConfigService } from '@nestjs/config';
import { TravelMode, TravellerGender } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';

import { TripCostService } from '../itinerary/services/trip-cost.service';
import { TripsService } from './trips.service';

describe('TripsService', () => {
  it('creates a trip with one stored traveller row per passenger', async () => {
    const tripCreate = vi.fn().mockImplementation(({ data }) => ({
      id: 'trip-1',
      title: data.title,
      sourceName: data.sourceName,
      sourceLatitude: data.sourceLatitude,
      sourceLongitude: data.sourceLongitude,
      destinationName: data.destinationName,
      destinationLatitude: data.destinationLatitude,
      destinationLongitude: data.destinationLongitude,
      startDate: data.startDate,
      endDate: data.endDate,
      travellerCount: data.travellerCount,
      travelMode: data.travelMode,
      budget: null,
      interests: data.interests,
      preferences: data.preferences,
      notes: data.notes,
      status: 'DRAFT',
      estimatedDistanceKm: null,
      estimatedDurationMinutes: null,
      estimatedTotalCost: null,
      estimatedFuelCost: null,
      vehicle: null,
      travellers: data.travellers.create.map(
        (traveller: Record<string, unknown>, index: number) => ({
          id: `traveller-${index + 1}`,
          tripId: 'trip-1',
          ...traveller,
          createdAt: new Date(),
          updatedAt: new Date()
        })
      ),
      days: [],
      createdAt: new Date(),
      updatedAt: new Date()
    }));
    const service = new TripsService(
      {
        trip: {
          create: tripCreate
        }
      } as never,
      new TripCostService(new ConfigService()),
      {
        generateTripPlan: vi.fn()
      }
    );

    const result = await service.create({
      source: {
        name: 'Delhi',
        latitude: 28.6139,
        longitude: 77.209
      },
      destination: {
        name: 'Rishikesh',
        latitude: 30.0869,
        longitude: 78.2676
      },
      startDate: '2026-10-10',
      endDate: '2026-10-12',
      travellerCount: 2,
      travellers: [
        {
          fullName: 'Asha Singh',
          age: 29,
          gender: TravellerGender.FEMALE
        },
        {
          fullName: 'Ravi Singh',
          age: 31,
          gender: TravellerGender.MALE
        }
      ],
      travelMode: TravelMode.CAR,
      interests: ['Nature'],
      preferences: ['Scenic route']
    });

    expect(tripCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          travellerCount: 2,
          travellers: {
            create: [
              expect.objectContaining({
                fullName: 'Asha Singh',
                sortOrder: 1
              }),
              expect.objectContaining({
                fullName: 'Ravi Singh',
                sortOrder: 2
              })
            ]
          }
        })
      })
    );
    expect(result.travellers).toHaveLength(2);
  });
});
