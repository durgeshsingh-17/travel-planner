import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiClient, ApiServer, startApi, uniqueEmail } from './harness';

interface Activity {
  id: string;
  placeId: string | null;
  title: string;
  activityType: string;
  startTime: string | null;
  isUserEdited: boolean;
}

interface Day {
  dayNumber: number;
  overnightLocation: string | null;
  activities: Activity[];
}

let server: ApiServer;

beforeAll(async () => {
  // No network in tests: use the built-in road estimate.
  server = await startApi({ ROUTING_PROVIDER: 'estimate' });
});

afterAll(async () => {
  await server?.stop();
});

const day = (trip: { days: Day[] }, dayNumber: number) => trip.days.find((entry) => entry.dayNumber === dayNumber)!;
const placeIds = (trip: { days: Day[] }) => trip.days.flatMap((entry) => entry.activities.map((activity) => activity.placeId).filter(Boolean));

async function generatedTrip(client: ApiClient) {
  const created = await client.call('POST', '/trips', {
    source: { name: 'Delhi', latitude: 28.6139, longitude: 77.209 },
    destination: { name: 'Rishikesh', latitude: 30.0869, longitude: 78.2676 },
    startDate: '2027-02-10',
    endDate: '2027-02-12',
    travellerCount: 1,
    travellers: [{ fullName: 'Edit Person', age: 34, gender: 'FEMALE' }],
    travelMode: 'CAR',
    interests: ['Nature'],
    pace: 'RELAXED'
  });
  expect(created.status).toBe(201);
  const generated = await client.call('POST', `/trips/${created.body.data.id}/generate-itinerary`);
  expect(generated.status).toBe(201);
  return generated.body.data;
}

describe('itinerary generation', () => {
  it('links the destination guide and explains where the plan came from', async () => {
    const client = new ApiClient(server.baseUrl);
    await client.register('Plan Person', uniqueEmail('plan'));
    const trip = await generatedTrip(client);

    expect(trip.pace).toBe('RELAXED');
    expect(trip.routeProvider).toBe('estimate');
    expect(['FULL', 'PARTIAL']).toContain(trip.coverage);
    expect(trip.destinationGuide).toEqual({ slug: 'rishikesh', name: 'Rishikesh' });
    expect(trip.days).toHaveLength(3);
    expect(day(trip, 1).overnightLocation).toBe('Rishikesh');
    expect(trip.costBreakdown.assumptions.length).toBeGreaterThan(3);
    expect(new Set(placeIds(trip)).size).toBe(placeIds(trip).length);
  });
});

describe('itinerary editing', () => {
  it('reorders, adds, moves, edits, removes and re-plans stops for the owner only', async () => {
    const owner = new ApiClient(server.baseUrl);
    const other = new ApiClient(server.baseUrl);
    const anonymous = new ApiClient(server.baseUrl);
    await owner.register('Edit Owner', uniqueEmail('edit-owner'));
    await other.register('Edit Other', uniqueEmail('edit-other'));
    let trip = await generatedTrip(owner);
    const base = `/trips/${trip.id}`;

    // Reorder: reversing day 2 flags the moved stops and re-times the day.
    const dayTwo = day(trip, 2).activities.map((activity) => activity.id);
    expect((await owner.call('PUT', `${base}/days/2/order`, { activityIds: dayTwo.slice(1) })).status).toBe(400);
    const reordered = await owner.call('PUT', `${base}/days/2/order`, { activityIds: [...dayTwo].reverse() });
    expect(reordered.status).toBe(200);
    trip = reordered.body.data;
    expect(day(trip, 2).activities.map((activity) => activity.id)).toEqual([...dayTwo].reverse());
    expect(day(trip, 2).activities[0].isUserEdited).toBe(true);
    const times = day(trip, 2).activities.map((activity) => activity.startTime!);
    expect([...times].sort()).toEqual(times);

    // Add a published place that is not in the plan yet; adding it twice is refused.
    const places = (await anonymous.call('GET', '/destinations/rishikesh/places?pageSize=48')).body.data.items as { id: string; name: string }[];
    const spare = places.find((place) => !placeIds(trip).includes(place.id))!;
    expect(spare).toBeDefined();
    const added = await owner.call('POST', `${base}/days/2/activities`, { placeId: spare.id });
    expect(added.status).toBe(201);
    trip = added.body.data;
    const addedStop = day(trip, 2).activities.find((activity) => activity.placeId === spare.id)!;
    expect(addedStop.isUserEdited).toBe(true);
    const duplicate = await owner.call('POST', `${base}/days/1/activities`, { placeId: spare.id });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error?.message).toContain('day 2');

    // A custom stop needs a title.
    expect((await owner.call('POST', `${base}/days/2/activities`, {})).status).toBe(400);
    const custom = await owner.call('POST', `${base}/days/2/activities`, { title: 'Ganga aarti at Triveni Ghat', durationMinutes: 45 });
    expect(custom.status).toBe(201);
    trip = custom.body.data;
    const customStop = day(trip, 2).activities.find((activity) => activity.title === 'Ganga aarti at Triveni Ghat')!;

    // Move to another day and pin a time.
    const moved = await owner.call('PATCH', `${base}/activities/${addedStop.id}`, { dayNumber: 1, startTime: '16:00' });
    expect(moved.status).toBe(200);
    trip = moved.body.data;
    expect(day(trip, 2).activities.some((activity) => activity.id === addedStop.id)).toBe(false);
    expect(day(trip, 1).activities.find((activity) => activity.id === addedStop.id)?.startTime).toBe('16:00');

    // Remove the custom stop.
    const removed = await owner.call('DELETE', `${base}/activities/${customStop.id}`);
    expect(removed.status).toBe(200);
    trip = removed.body.data;
    expect(day(trip, 2).activities.some((activity) => activity.id === customStop.id)).toBe(false);
    expect(trip.costBreakdown.total).toBeGreaterThan(0);

    // Re-plan day 2: never reuses stops that are on other days.
    const elsewhere = [...placeIds({ days: [day(trip, 1), day(trip, 3)] })];
    const replanned = await owner.call('POST', `${base}/days/2/regenerate`);
    expect(replanned.status).toBe(201);
    trip = replanned.body.data;
    day(trip, 2).activities.forEach((activity) => expect(elsewhere).not.toContain(activity.placeId));
    expect(new Set(placeIds(trip)).size).toBe(placeIds(trip).length);
    expect(day(trip, 2).activities.every((activity) => !activity.isUserEdited)).toBe(true);

    // Nobody else can edit, and the edits never leak to them.
    const activityId = day(trip, 2).activities[0].id;
    for (const [method, path, body] of [
      ['PUT', `${base}/days/2/order`, { activityIds: [activityId] }],
      ['POST', `${base}/days/2/activities`, { title: 'Sneaky stop' }],
      ['POST', `${base}/days/2/regenerate`, undefined],
      ['PATCH', `${base}/activities/${activityId}`, { title: 'Hijacked' }],
      ['DELETE', `${base}/activities/${activityId}`, undefined]
    ] as const) {
      expect((await anonymous.call(method, path, body)).status).toBe(401);
      expect((await other.call(method, path, body)).status).toBe(404);
    }
    expect((await owner.call('GET', base)).body.data.days[1].activities[0].title).not.toBe('Hijacked');
  });

  it('asks for a generated plan before editing', async () => {
    const client = new ApiClient(server.baseUrl);
    await client.register('Draft Person', uniqueEmail('draft'));
    const created = await client.call('POST', '/trips', {
      source: { name: 'Delhi', latitude: 28.6139, longitude: 77.209 },
      destination: { name: 'Rishikesh', latitude: 30.0869, longitude: 78.2676 },
      startDate: '2027-02-10',
      endDate: '2027-02-12',
      travellerCount: 1,
      travellers: [{ fullName: 'Draft Person', age: 34, gender: 'MALE' }],
      travelMode: 'CAR',
      interests: ['Nature']
    });
    expect(created.status).toBe(201);

    const result = await client.call('POST', `/trips/${created.body.data.id}/days/1/activities`, { title: 'Too early' });
    expect(result.status).toBe(404);
    expect(result.body.error?.message).toContain('Generate the itinerary first');
  });
});
