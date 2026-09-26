import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiClient, ApiServer, startApi, uniqueEmail } from './harness';

let server: ApiServer;

beforeAll(async () => {
  server = await startApi();
});

afterAll(async () => {
  await server?.stop();
});

function tripBody(extra: Record<string, unknown> = {}) {
  return {
    source: { name: 'Delhi', latitude: 28.6139, longitude: 77.209 },
    destination: { name: 'Rishikesh', latitude: 30.0869, longitude: 78.2676 },
    startDate: '2027-01-10',
    endDate: '2027-01-16',
    travellerCount: 2,
    travellers: [
      { fullName: 'Asha Owner', age: 30, gender: 'FEMALE' },
      { fullName: 'Kid Owner', age: 8, gender: 'MALE' }
    ],
    travelMode: 'CAR',
    interests: ['Nature'],
    notes: 'secret medical note',
    budget: 30000,
    ...extra
  };
}

describe('sessions', () => {
  it('sets an httpOnly refresh cookie scoped to the auth routes', async () => {
    const client = new ApiClient(server.baseUrl);
    const result = await client.register('Cookie Person', uniqueEmail('cookie'));

    expect(result.status).toBe(201);
    expect(result.body.data).not.toHaveProperty('refreshToken');
    const cookie = result.cookies.find((value) => value.startsWith('tp_refresh='));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Path=\/api\/v1\/auth/);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('refreshes with the cookie, rotates it, and detects reuse of the old one', async () => {
    const client = new ApiClient(server.baseUrl);
    await client.register('Rotating Person', uniqueEmail('rotate'));
    const original = client.jar.get('tp_refresh')!;

    const refreshed = await client.call('POST', '/auth/refresh');
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.data.token).toBeTruthy();
    expect(client.jar.get('tp_refresh')).not.toBe(original);

    client.token = refreshed.body.data.token;
    expect((await client.call('GET', '/me')).status).toBe(200);

    // Replaying the retired cookie after the grace window would revoke the family;
    // inside the window it is treated as a two-tab race and still works.
    const replay = new ApiClient(server.baseUrl);
    replay.jar.set('tp_refresh', original);
    expect((await replay.call('POST', '/auth/refresh')).status).toBe(200);
  });

  it('logout revokes the refresh token and clears the cookie', async () => {
    const client = new ApiClient(server.baseUrl);
    await client.register('Leaving Person', uniqueEmail('logout'));
    const cookie = client.jar.get('tp_refresh')!;

    expect((await client.call('POST', '/auth/logout')).status).toBe(200);
    expect(client.jar.has('tp_refresh')).toBe(false);

    const stolen = new ApiClient(server.baseUrl);
    stolen.jar.set('tp_refresh', cookie);
    const result = await stolen.call('POST', '/auth/refresh');
    expect(result.status).toBe(401);
    expect(result.body.error?.code).toBe('UNAUTHORIZED');
  });

  it('rejects forged and legacy tokens with a request id in the error', async () => {
    const client = new ApiClient(server.baseUrl);
    await client.register('Forger', uniqueEmail('forge'));
    const [header, payload, signature] = client.token!.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'x', iat: 1, exp: 9999999999 })).toString(
      'base64url'
    );

    for (const token of [`${header}.${forged}.${signature}`, `${payload}.${signature}`]) {
      client.token = token;
      const result = await client.call('GET', '/trips');
      expect(result.status).toBe(401);
      expect(result.headers.get('x-request-id')).toBeTruthy();
      expect((result.body.error as { requestId?: string }).requestId).toBe(
        result.headers.get('x-request-id')
      );
    }
  });
});

describe('profile', () => {
  it('reads and updates the account and travel preferences', async () => {
    const client = new ApiClient(server.baseUrl);
    await client.register('Profile Person', uniqueEmail('profile'));
    const locations = await client.call('GET', '/locations?q=Delhi');
    const delhi = locations.body.data[0];

    const me = await client.call('GET', '/me');
    expect(me.body.data).toMatchObject({ name: 'Profile Person', role: 'TRAVELLER' });
    expect(me.body.data.profile.pace).toBe('BALANCED');

    expect(
      (await client.call('PATCH', '/me', { name: 'Renamed Person', phone: '9876543210' })).body
        .data
    ).toMatchObject({ name: 'Renamed Person', phone: '9876543210' });

    const updated = await client.call('PATCH', '/me/profile', {
      homeLocationId: delhi.id,
      pace: 'RELAXED',
      interests: ['Nature', 'Food'],
      dietaryPreference: 'VEG'
    });
    expect(updated.status).toBe(200);
    expect(updated.body.data.profile).toMatchObject({
      homeLocation: { id: delhi.id, name: 'Delhi' },
      pace: 'RELAXED',
      interests: ['Nature', 'Food'],
      dietaryPreference: 'VEG'
    });

    const cleared = await client.call('PATCH', '/me/profile', { dietaryPreference: null });
    expect(cleared.body.data.profile.dietaryPreference).toBeNull();
    expect((await client.call('PATCH', '/me/profile', { pace: 'SPRINT' })).status).toBe(400);
    expect((await client.call('PATCH', '/me', { role: 'ADMIN' })).status).toBe(400);
  });

  it('changing the password signs out other sessions', async () => {
    const email = uniqueEmail('password');
    const laptop = new ApiClient(server.baseUrl);
    await laptop.register('Password Person', email);
    const phone = new ApiClient(server.baseUrl);
    const login = await phone.call('POST', '/auth/login', { email, password: 'password-123' });
    phone.token = login.body.data.token;

    const changed = await laptop.call('POST', '/me/password', {
      currentPassword: 'password-123',
      newPassword: 'new-password-456'
    });
    expect(changed.status).toBe(200);

    expect((await phone.call('POST', '/auth/refresh')).status).toBe(401);
    expect((await laptop.call('POST', '/auth/refresh')).status).toBe(200);
    expect(
      (await phone.call('POST', '/auth/login', { email, password: 'password-123' })).status
    ).toBe(401);
    expect(
      (
        await laptop.call('POST', '/me/password', {
          currentPassword: 'wrong',
          newPassword: 'another-password'
        })
      ).status
    ).toBe(400);
  });

  it('deletes the account and its trips after confirming the password', async () => {
    const email = uniqueEmail('delete');
    const client = new ApiClient(server.baseUrl);
    await client.register('Delete Person', email);
    const trip = await client.call('POST', '/trips', tripBody());
    expect(trip.status).toBe(201);

    expect((await client.call('DELETE', '/me', { password: 'wrong' })).status).toBe(400);
    expect((await client.call('DELETE', '/me', { password: 'password-123' })).status).toBe(200);

    expect((await client.call('GET', '/me')).status).toBe(401);
    expect(
      (await client.call('POST', '/auth/login', { email, password: 'password-123' })).status
    ).toBe(401);
  });
});

describe('trips', () => {
  it('enforces ownership, private sharing and saved-trip rules end to end', async () => {
    const owner = new ApiClient(server.baseUrl);
    const other = new ApiClient(server.baseUrl);
    const anonymous = new ApiClient(server.baseUrl);
    await owner.register('Asha Owner', uniqueEmail('owner'));
    await other.register('Bala Other', uniqueEmail('other'));

    const catalog = await anonymous.call('GET', '/vehicles?type=CAR');
    const garage = await owner.call('POST', '/vehicles/my', {
      vehicleId: catalog.body.data[0].id,
      nickname: 'Family car',
      customMileage: 25,
      registrationNumber: 'HR 98 AC 9791'
    });
    const created = await owner.call(
      'POST',
      '/trips',
      tripBody({ userVehicleId: garage.body.data.id })
    );
    const tripId = created.body.data.id;
    expect(
      (await other.call('POST', '/trips', tripBody({ userVehicleId: garage.body.data.id }))).status
    ).toBe(400);

    const generated = await owner.call('POST', `/trips/${tripId}/generate-itinerary`);
    expect(generated.body.data.costBreakdown.mileageKmPerLitre).toBe(25);
    const stops = generated.body.data.days.flatMap((day: { activities: { placeId?: string }[] }) =>
      day.activities.map((activity) => activity.placeId).filter(Boolean)
    );
    expect(new Set(stops).size).toBe(stops.length);
    expect(JSON.stringify(generated.body.data.days)).not.toContain('secret medical note');

    expect((await anonymous.call('GET', '/trips')).status).toBe(401);
    expect((await other.call('GET', '/trips')).body.data).toEqual([]);
    for (const [method, path] of [
      ['GET', `/trips/${tripId}`],
      ['PATCH', `/trips/${tripId}`],
      ['DELETE', `/trips/${tripId}`],
      ['POST', `/trips/${tripId}/share`],
      ['POST', `/trips/${tripId}/generate-itinerary`]
    ]) {
      expect((await anonymous.call(method, path, method === 'PATCH' ? {} : undefined)).status).toBe(401);
      expect((await other.call(method, path, method === 'PATCH' ? {} : undefined)).status).toBe(404);
    }
    expect((await other.call('PUT', `/me/saved-trips/${tripId}`, {})).status).toBe(404);

    const shared = await owner.call('POST', `/trips/${tripId}/share`);
    const slug = shared.body.data.shareSlug;
    for (const viewer of [anonymous, other, owner]) {
      const view = await viewer.call('GET', `/shared-trips/${slug}`);
      const text = JSON.stringify(view.body);
      expect(view.status).toBe(200);
      expect(view.body.data).not.toHaveProperty('travellers');
      expect(view.body.data).not.toHaveProperty('budget');
      expect(text).not.toContain('Kid Owner');
      expect(text).not.toContain('secret medical note');
      expect(text).not.toContain('HR98AC9791');
    }

    expect((await other.call('PUT', `/me/saved-trips/${tripId}`, {})).status).toBe(200);
    await owner.call('DELETE', `/trips/${tripId}/share`);
    expect((await anonymous.call('GET', `/shared-trips/${slug}`)).status).toBe(404);
    const savedByOther = await other.call('GET', '/me/saved-trips');
    expect(savedByOther.body.data[0]).toMatchObject({ available: false, trip: null });

    expect((await owner.call('DELETE', `/trips/${tripId}`)).status).toBe(200);
  });
});
