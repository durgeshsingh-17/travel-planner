import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';

interface StoredToken {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

/** Minimal in-memory stand-in for the Prisma calls AuthService makes. */
function fakePrisma() {
  const users = new Map<string, Record<string, unknown>>();
  const tokens: StoredToken[] = [];
  let tokenSeq = 0;

  const matches = (token: StoredToken, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => token[key as keyof StoredToken] === value);

  return {
    tokens,
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; email?: string } }) =>
        [...users.values()].find(
          (user) => user.id === where.id || (where.email && user.email === where.email)
        ) ?? null
      ),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const user = { id: `user-${users.size + 1}`, avatarUrl: null, role: 'TRAVELLER', ...data };
        users.set(user.id as string, user);
        return user;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: object }) => {
        const user = { ...users.get(where.id), ...data };
        users.set(where.id, user);
        return user;
      })
    },
    refreshToken: {
      create: vi.fn(async ({ data }: { data: Omit<StoredToken, 'id' | 'revokedAt' | 'replacedById'> }) => {
        const token = { id: `rt-${++tokenSeq}`, revokedAt: null, replacedById: null, ...data };
        tokens.push(token);
        return { id: token.id };
      }),
      findUnique: vi.fn(async ({ where }: { where: { tokenHash: string } }) => {
        const token = tokens.find((candidate) => candidate.tokenHash === where.tokenHash);
        return token ? { ...token, user: users.get(token.userId) } : null;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Partial<StoredToken> }) => {
        const token = tokens.find((candidate) => candidate.id === where.id)!;
        Object.assign(token, data);
        return token;
      }),
      updateMany: vi.fn(
        async ({ where, data }: { where: Record<string, unknown>; data: Partial<StoredToken> }) => {
          const hits = tokens.filter((token) => matches(token, where));
          hits.forEach((token) => Object.assign(token, data));
          return { count: hits.length };
        }
      )
    }
  };
}

function createService(auth: Record<string, unknown> = { tokenSecret: SECRET }) {
  const prisma = fakePrisma();
  const service = new AuthService(prisma as never, new ConfigService({ auth }));
  return { service, prisma };
}

function register(service: AuthService) {
  return service.register({
    name: 'Asha Singh',
    email: 'asha@example.com',
    password: 'long-enough-password'
  });
}

describe('AuthService access tokens', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('refuses to start without a strong secret', () => {
    expect(() => createService({})).toThrow(/AUTH_TOKEN_SECRET/);
    expect(() => createService({ tokenSecret: 'short' })).toThrow(/AUTH_TOKEN_SECRET/);
  });

  it('issues short-lived HS256 access tokens (15 minutes by default)', async () => {
    const { service } = createService();
    const session = await register(service);

    expect(session.token.split('.')).toHaveLength(3);
    const claims = service.verifyToken(`Bearer ${session.token}`);
    expect(claims.sub).toBe('user-1');
    expect(claims.exp - claims.iat).toBe(15 * 60);
    expect(session.user).toMatchObject({ role: 'TRAVELLER' });
  });

  it('rejects tampered payloads and foreign signatures', async () => {
    const { service } = createService();
    const [header, , signature] = (await register(service)).token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'someone-else', iat: 1, exp: 9999999999 })
    ).toString('base64url');

    expect(() => service.verifyToken(`${header}.${forged}.${signature}`)).toThrow(
      UnauthorizedException
    );

    const other = createService({ tokenSecret: 'another-secret-that-is-also-long-enough-123' });
    const foreignToken = (await register(other.service)).token;
    expect(() => service.verifyToken(foreignToken)).toThrow(UnauthorizedException);
  });

  it('rejects expired access tokens', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z'));
    const { service } = createService({ tokenSecret: SECRET, accessTokenTtlSeconds: 60 });
    const { token } = await register(service);

    vi.setSystemTime(new Date('2026-09-01T00:01:01Z'));

    expect(() => service.verifyToken(token)).toThrow(/expired/);
  });

  it('rejects legacy two-part tokens and missing headers', () => {
    const { service } = createService();

    expect(() => service.verifyToken('eyJzdWIiOiJ1c2VyLTEifQ.signature')).toThrow(
      UnauthorizedException
    );
    expect(() => service.verifyToken(undefined)).toThrow(UnauthorizedException);
  });
});

describe('AuthService refresh tokens', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores only a hash of the refresh token', async () => {
    const { service, prisma } = createService();
    const session = await register(service);

    expect(prisma.tokens).toHaveLength(1);
    expect(prisma.tokens[0].tokenHash).not.toContain(session.refreshToken);
    expect(prisma.tokens[0].tokenHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('rotates on refresh: the old token is retired and linked to its replacement', async () => {
    const { service, prisma } = createService();
    const first = await register(service);

    const second = await service.refresh(first.refreshToken);

    expect(second.refreshToken).not.toBe(first.refreshToken);
    expect(service.verifyToken(second.token).sub).toBe('user-1');
    expect(prisma.tokens[0].revokedAt).toBeInstanceOf(Date);
    expect(prisma.tokens[0].replacedById).toBe(prisma.tokens[1].id);
    expect(prisma.tokens[1].familyId).toBe(prisma.tokens[0].familyId);
  });

  it('treats reuse of a retired token as theft and revokes the whole family', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z'));
    const { service, prisma } = createService();
    const first = await register(service);
    const second = await service.refresh(first.refreshToken);

    vi.setSystemTime(new Date('2026-09-01T00:05:00Z'));

    await expect(service.refresh(first.refreshToken)).rejects.toThrow(UnauthorizedException);
    expect(prisma.tokens.every((token) => token.revokedAt)).toBe(true);
    await expect(service.refresh(second.refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it('tolerates two tabs refreshing with the same token at the same moment', async () => {
    const { service } = createService();
    const first = await register(service);

    await service.refresh(first.refreshToken);
    const raced = await service.refresh(first.refreshToken);

    expect(service.verifyToken(raced.token).sub).toBe('user-1');
  });

  it('rejects expired, unknown and missing refresh tokens', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z'));
    const { service } = createService({ tokenSecret: SECRET, refreshTokenTtlDays: 1 });
    const session = await register(service);

    vi.setSystemTime(new Date('2026-09-02T00:00:01Z'));

    await expect(service.refresh(session.refreshToken)).rejects.toThrow(UnauthorizedException);
    await expect(service.refresh('not-a-real-token')).rejects.toThrow(UnauthorizedException);
    await expect(service.refresh(undefined)).rejects.toThrow(UnauthorizedException);
  });

  it('logout revokes the session family; logout-all revokes every session', async () => {
    const { service } = createService();
    const phone = await register(service);
    const laptop = await service.login({ email: 'asha@example.com', password: 'long-enough-password' });

    await service.logout(phone.refreshToken);
    await expect(service.refresh(phone.refreshToken)).rejects.toThrow(UnauthorizedException);
    const stillValid = await service.refresh(laptop.refreshToken);

    await service.logoutAll('user-1');
    await expect(service.refresh(stillValid.refreshToken)).rejects.toThrow(UnauthorizedException);
  });

  it('changing the password signs out other devices and returns a new session', async () => {
    const { service } = createService();
    const other = await register(service);

    const fresh = await service.changePassword(
      'user-1',
      'long-enough-password',
      'a-brand-new-password'
    );

    await expect(service.refresh(other.refreshToken)).rejects.toThrow(UnauthorizedException);
    await expect(service.refresh(fresh.refreshToken)).resolves.toBeTruthy();
    await expect(
      service.login({ email: 'asha@example.com', password: 'a-brand-new-password' })
    ).resolves.toBeTruthy();
    await expect(
      service.changePassword('user-1', 'wrong-password', 'another-new-password')
    ).rejects.toThrow(/incorrect/);
  });
});

describe('AuthGuard', () => {
  class Routes {
    @Public()
    open() {}

    closed() {}
  }

  function contextFor(request: Record<string, unknown>, handler: () => void) {
    return {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => handler,
      getClass: () => Routes
    } as never;
  }

  it('lets public routes through without a token', () => {
    const guard = new AuthGuard(createService().service, new Reflector());

    expect(guard.canActivate(contextFor({ headers: {} }, Routes.prototype.open))).toBe(true);
  });

  it('rejects other routes without a token', () => {
    const guard = new AuthGuard(createService().service, new Reflector());

    expect(() => guard.canActivate(contextFor({ headers: {} }, Routes.prototype.closed))).toThrow(
      UnauthorizedException
    );
  });

  it('attaches the user id for valid tokens', async () => {
    const { service } = createService();
    const { token } = await register(service);
    const request: Record<string, unknown> = { headers: { authorization: `Bearer ${token}` } };

    expect(
      new AuthGuard(service, new Reflector()).canActivate(
        contextFor(request, Routes.prototype.closed)
      )
    ).toBe(true);
    expect(request.user).toEqual({ id: 'user-1' });
  });
});
