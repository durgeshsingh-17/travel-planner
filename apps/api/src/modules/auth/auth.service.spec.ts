import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

const SECRET = 'test-secret-that-is-at-least-32-characters-long';

function createService(auth: Record<string, unknown> = { tokenSecret: SECRET }) {
  const prisma = {
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation(({ data }) => ({
        id: 'user-1',
        avatarUrl: null,
        phone: null,
        ...data
      }))
    }
  };

  return new AuthService(prisma as never, new ConfigService({ auth }));
}

async function issueToken(service: AuthService): Promise<string> {
  const response = await service.register({
    name: 'Asha Singh',
    email: 'asha@example.com',
    password: 'long-enough-password'
  });

  return response.token;
}

describe('AuthService tokens', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('refuses to start without a strong secret', () => {
    expect(() => createService({})).toThrow(/AUTH_TOKEN_SECRET/);
    expect(() => createService({ tokenSecret: 'short' })).toThrow(/AUTH_TOKEN_SECRET/);
  });

  it('issues a three-part HS256 token that verifies and carries an expiry', async () => {
    const service = createService();
    const token = await issueToken(service);

    expect(token.split('.')).toHaveLength(3);
    const claims = service.verifyToken(`Bearer ${token}`);
    expect(claims.sub).toBe('user-1');
    expect(claims.exp - claims.iat).toBe(7 * 24 * 60 * 60);
  });

  it('rejects tampered payloads', async () => {
    const service = createService();
    const [header, , signature] = (await issueToken(service)).split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: 'someone-else', iat: 1, exp: 9999999999 })
    ).toString('base64url');

    expect(() => service.verifyToken(`${header}.${forgedPayload}.${signature}`)).toThrow(
      UnauthorizedException
    );
  });

  it('rejects tokens signed with a different secret', async () => {
    const token = await issueToken(
      createService({ tokenSecret: 'another-secret-that-is-also-long-enough-123' })
    );

    expect(() => createService().verifyToken(token)).toThrow(UnauthorizedException);
  });

  it('rejects expired tokens', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-01T00:00:00Z'));
    const service = createService({ tokenSecret: SECRET, tokenTtlSeconds: 60 });
    const token = await issueToken(service);

    vi.setSystemTime(new Date('2026-09-01T00:01:01Z'));

    expect(() => service.verifyToken(token)).toThrow(/expired/);
  });

  it('rejects legacy two-part tokens and missing headers', () => {
    const service = createService();

    expect(() => service.verifyToken('eyJzdWIiOiJ1c2VyLTEifQ.signature')).toThrow(
      UnauthorizedException
    );
    expect(() => service.verifyToken(undefined)).toThrow(UnauthorizedException);
  });
});

describe('AuthGuard', () => {
  function contextFor(request: Record<string, unknown>) {
    return {
      switchToHttp: () => ({ getRequest: () => request })
    } as never;
  }

  it('rejects requests without a token', () => {
    const guard = new AuthGuard(createService());

    expect(() => guard.canActivate(contextFor({ headers: {} }))).toThrow(
      UnauthorizedException
    );
  });

  it('attaches the user id for valid tokens', async () => {
    const service = createService();
    const token = await issueToken(service);
    const request: Record<string, unknown> = {
      headers: { authorization: `Bearer ${token}` }
    };

    expect(new AuthGuard(service).canActivate(contextFor(request))).toBe(true);
    expect(request.user).toEqual({ id: 'user-1' });
  });
});
