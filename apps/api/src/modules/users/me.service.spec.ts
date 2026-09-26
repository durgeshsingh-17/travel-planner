import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { MeService } from './me.service';

const baseUser = {
  id: 'user-1',
  name: 'Asha Singh',
  email: 'asha@example.com',
  phone: null,
  avatarUrl: null,
  role: 'TRAVELLER',
  createdAt: new Date('2026-09-01T00:00:00Z')
};

function createService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue({ ...baseUser, profile: null }),
      update: vi.fn().mockResolvedValue(baseUser),
      delete: vi.fn().mockReturnValue('delete-user')
    },
    trip: { deleteMany: vi.fn().mockReturnValue('delete-trips') },
    location: { findFirst: vi.fn().mockResolvedValue({ id: 'loc-1' }) },
    userVehicle: { findFirst: vi.fn().mockResolvedValue({ id: 'uv-1' }) },
    userProfile: { upsert: vi.fn().mockResolvedValue({}) },
    $transaction: vi.fn().mockResolvedValue([]),
    ...overrides
  };
  const authService = {
    serializeUser: (user: typeof baseUser) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      role: user.role
    }),
    assertPassword: vi.fn().mockResolvedValue(baseUser)
  };

  return { service: new MeService(prisma as never, authService as never), prisma, authService };
}

describe('MeService', () => {
  it('returns defaults when the user has no profile yet', async () => {
    const { service } = createService();

    const me = await service.get('user-1');

    expect(me).toMatchObject({
      id: 'user-1',
      role: 'TRAVELLER',
      profile: { interests: [], pace: 'BALANCED', homeLocation: null, marketingOptIn: false }
    });
    expect(me).not.toHaveProperty('passwordHash');
  });

  it('upserts the profile and clears fields sent as null', async () => {
    const { service, prisma } = createService();

    await service.updateProfile('user-1', {
      homeLocationId: 'loc-1',
      interests: [' Nature ', ''],
      budgetBand: null
    });

    expect(prisma.userProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        update: expect.objectContaining({
          homeLocationId: 'loc-1',
          interests: ['Nature'],
          budgetBand: null
        })
      })
    );
  });

  it('rejects a default vehicle the user does not own', async () => {
    const { service, prisma } = createService({
      userVehicle: { findFirst: vi.fn().mockResolvedValue(null) }
    });

    await expect(
      service.updateProfile('user-1', { defaultUserVehicleId: 'someone-elses' })
    ).rejects.toThrow(BadRequestException);
    expect(prisma.userProfile.upsert).not.toHaveBeenCalled();
  });

  it('rejects an unknown home city', async () => {
    const { service } = createService({
      location: { findFirst: vi.fn().mockResolvedValue(null) }
    });

    await expect(service.updateProfile('user-1', { homeLocationId: 'nowhere' })).rejects.toThrow(
      /Home city/
    );
  });

  it('deletes the account and its trips only after checking the password', async () => {
    const { service, prisma, authService } = createService();

    await service.delete('user-1', 'long-enough-password');

    expect(authService.assertPassword).toHaveBeenCalledWith('user-1', 'long-enough-password');
    expect(prisma.trip.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(prisma.$transaction).toHaveBeenCalledWith(['delete-trips', 'delete-user']);
  });

  it('does not delete anything when the password is wrong', async () => {
    const { service, prisma, authService } = createService();
    authService.assertPassword.mockRejectedValue(new BadRequestException('Current password is incorrect'));

    await expect(service.delete('user-1', 'nope')).rejects.toThrow(/incorrect/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
