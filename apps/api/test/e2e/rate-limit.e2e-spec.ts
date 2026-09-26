import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiClient, ApiServer, startApi } from './harness';

let server: ApiServer;

beforeAll(async () => {
  server = await startApi({ AUTH_RATE_LIMIT_PER_MINUTE: '3' });
});

afterAll(async () => {
  await server?.stop();
});

describe('auth rate limiting', () => {
  it('returns 429 with RATE_LIMITED after too many sign-in attempts', async () => {
    const client = new ApiClient(server.baseUrl);
    const attempt = () =>
      client.call('POST', '/auth/login', { email: 'nobody@e2e.test', password: 'wrong-password' });

    for (let index = 0; index < 3; index += 1) {
      expect((await attempt()).status).toBe(401);
    }

    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error?.code).toBe('RATE_LIMITED');
    // Ordinary public endpoints keep working.
    expect((await client.call('GET', '/health')).status).toBe(200);
  });
});
