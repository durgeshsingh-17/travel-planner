import { describe, expect, it, vi } from 'vitest';

import { VehiclesService } from './vehicles.service';

describe('VehiclesService', () => {
  it('updates a saved user vehicle by garage entry id', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'garage-1' });
    const findUnique = vi.fn().mockResolvedValue({ id: 'vehicle-1' });
    const update = vi.fn().mockResolvedValue({
      id: 'garage-1',
      userId: 'user-1',
      vehicleId: 'vehicle-1',
      nickname: 'Creta',
      customMileage: 21,
      registrationNumber: 'HR98AC9791',
      vehicle: {
        id: 'vehicle-1',
        brand: 'Hyundai',
        model: 'Creta',
        type: 'CAR',
        fuelType: 'PETROL',
        tankCapacity: null,
        averageMileage: 18
      }
    });
    const service = new VehiclesService({
      vehicle: {
        findUnique
      },
      userVehicle: {
        findFirst,
        update
      }
    } as never);

    const result = await service.updateUserVehicle('user-1', 'garage-1', {
      vehicleId: 'vehicle-1',
      nickname: 'Creta',
      customMileage: 21,
      registrationNumber: 'HR 98 AC 9791'
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        id: 'garage-1',
        userId: 'user-1'
      },
      select: {
        id: true
      }
    });
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'garage-1' },
        data: expect.objectContaining({
          registrationNumber: 'HR98AC9791'
        })
      })
    );
    expect(result.registrationNumber).toBe('HR98AC9791');
  });
});
