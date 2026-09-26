import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';

import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

class Routes {
  @Roles('ADMIN', 'EDITOR')
  editorial() {}

  open() {}
}

function contextFor(handler: () => void, user?: { id: string }) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => handler,
    getClass: () => Routes
  } as never;
}

function guardWithRole(role: string | null) {
  const findUnique = vi.fn().mockResolvedValue(role ? { role } : null);
  return { guard: new RolesGuard(new Reflector(), { user: { findUnique } } as never), findUnique };
}

describe('RolesGuard', () => {
  it('ignores routes without @Roles', async () => {
    const { guard, findUnique } = guardWithRole(null);

    await expect(guard.canActivate(contextFor(Routes.prototype.open))).resolves.toBe(true);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('allows users holding one of the roles, read fresh from the database', async () => {
    const { guard, findUnique } = guardWithRole('EDITOR');

    await expect(
      guard.canActivate(contextFor(Routes.prototype.editorial, { id: 'user-1' }))
    ).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'user-1' }, select: { role: true } });
  });

  it('forbids other roles and deleted users', async () => {
    await expect(
      guardWithRole('TRAVELLER').guard.canActivate(
        contextFor(Routes.prototype.editorial, { id: 'user-1' })
      )
    ).rejects.toThrow(ForbiddenException);
    await expect(
      guardWithRole(null).guard.canActivate(contextFor(Routes.prototype.editorial, { id: 'gone' }))
    ).rejects.toThrow(ForbiddenException);
  });

  it('requires authentication first', async () => {
    await expect(
      guardWithRole('ADMIN').guard.canActivate(contextFor(Routes.prototype.editorial))
    ).rejects.toThrow(UnauthorizedException);
  });
});
