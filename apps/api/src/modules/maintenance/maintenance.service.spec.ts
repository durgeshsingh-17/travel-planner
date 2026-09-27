import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';

import { MaintenanceService } from './maintenance.service';

describe('MaintenanceService', () => {
  it('expires stale quotes and prunes old OTPs, refresh tokens and cached routes', async () => {
    const deleted = (count: number) => vi.fn().mockResolvedValue({ count });
    const prisma = {
      quoteRequest: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      quote: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
      otpChallenge: { deleteMany: deleted(4) },
      refreshToken: { deleteMany: deleted(2) },
      routeCache: { deleteMany: deleted(1) }
    };
    const service = new MaintenanceService(prisma as never, new ConfigService({ routing: { cacheDays: 30 } }));
    const now = new Date('2026-10-01T00:00:00Z');

    expect(await service.run(now)).toEqual({ otpChallenges: 4, refreshTokens: 2, routeCache: 1 });
    expect(prisma.quoteRequest.updateMany).toHaveBeenCalled();
    expect(prisma.otpChallenge.deleteMany).toHaveBeenCalledWith({ where: { createdAt: { lt: new Date('2026-09-29T00:00:00Z') } } });
    expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { expiresAt: { lt: new Date('2026-09-24T00:00:00Z') } } });
    expect(prisma.routeCache.deleteMany).toHaveBeenCalledWith({ where: { createdAt: { lt: new Date('2026-09-01T00:00:00Z') } } });
  });

  it('does not start a timer in tests', () => {
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    new MaintenanceService({} as never, new ConfigService()).onApplicationBootstrap();

    expect(setIntervalSpy).not.toHaveBeenCalled();
  });
});
