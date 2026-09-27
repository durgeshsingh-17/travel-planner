import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiClient, ApiServer, runCli, startApi, uniqueEmail, uniquePhone } from './harness';

let server: ApiServer;
let admin: ApiClient;
let editor: ApiClient;
let traveller: ApiClient;
let agentUser: ApiClient;
let anonymous: ApiClient;
let agentUserEmail: string;
const suffix = Math.random().toString(36).slice(2, 8);
const packageSlug = `rishikesh-weekend-${suffix}`;
const inTwoMonths = new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString().slice(0, 10);
const inTenDays = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();

function packageDoc(overrides: Record<string, unknown> = {}) {
  return {
    slug: packageSlug,
    title: 'Rishikesh riverside weekend',
    summary: 'Two nights by the Ganga with a rafting morning and an evening aarti.',
    durationDays: 3,
    durationNights: 2,
    startLocationSlug: 'delhi',
    availableMonths: [10, 11, 12, 1, 2, 3],
    route: [{ destinationSlug: 'rishikesh', nights: 2 }],
    tiers: [
      { level: 'BUDGET', pricePerPerson: 8000, taxesIncluded: true },
      { level: 'PREMIUM', pricePerPerson: 15000, compareAtPrice: 17000, taxesIncluded: true, hotelCategory: 4 }
    ],
    days: [
      { dayNumber: 1, title: 'Drive and evening aarti', description: 'Arrive by afternoon and walk to Triveni Ghat.', mealsIncluded: ['D'] },
      {
        dayNumber: 2,
        title: 'Rafting and ashrams',
        description: 'Morning rafting, afternoon at the ashram quarter.',
        mealsIncluded: ['B', 'D'],
        places: [{ destinationSlug: 'rishikesh', placeSlug: 'beatles-ashram' }]
      },
      { dayNumber: 3, title: 'Return', description: 'Breakfast and drive back.', mealsIncluded: ['B'] }
    ],
    stays: [
      { tierLevel: 'BUDGET', destinationSlug: 'rishikesh', nights: 2, hotelName: 'Riverside guesthouse', mealPlan: 'MAP' },
      { tierLevel: 'PREMIUM', destinationSlug: 'rishikesh', nights: 2, hotelName: 'Ganga view resort', mealPlan: 'MAP', hotelCategory: 4 }
    ],
    inclusions: ['Hotel stay', 'Breakfast and dinner', 'Rafting session'],
    exclusions: ['Lunch', 'Personal expenses'],
    policies: [{ kind: 'CANCELLATION', body: 'Free cancellation up to 7 days before departure.' }],
    ...overrides
  };
}

function agentDoc(slug: string, states: string[], extra: Record<string, unknown> = {}) {
  return { slug: `${slug}-${suffix}`, displayName: `Agency ${slug}`, email: `${slug}@agency.test`, phone: uniquePhone(), serviceStates: states, ...extra };
}

async function verifyPhone(client: ApiClient, phone = uniquePhone()) {
  expect((await client.call('POST', '/me/phone/verification', { phone })).status).toBe(200);
  return client.call('POST', '/me/phone/verification/confirm', { phone, code: '123456' });
}

beforeAll(async () => {
  server = await startApi();
  admin = new ApiClient(server.baseUrl);
  editor = new ApiClient(server.baseUrl);
  traveller = new ApiClient(server.baseUrl);
  agentUser = new ApiClient(server.baseUrl);
  anonymous = new ApiClient(server.baseUrl);
  const adminEmail = uniqueEmail('pkg-admin');
  const editorEmail = uniqueEmail('pkg-editor');
  agentUserEmail = uniqueEmail('agency-user');
  await admin.register('Admin Person', adminEmail);
  await editor.register('Editor Person', editorEmail);
  await traveller.register('Asha Traveller', uniqueEmail('traveller'));
  await agentUser.register('Agency Person', agentUserEmail);
  await runCli('promote-user', [adminEmail, 'ADMIN']);
  await runCli('promote-user', [editorEmail, 'EDITOR']);
});

afterAll(async () => {
  await server?.stop();
});

describe('packages', () => {
  let packageId: string;

  it('rejects an inconsistent package with every problem listed', async () => {
    const result = await editor.call(
      'POST',
      '/admin/packages',
      packageDoc({ route: [{ destinationSlug: 'rishikesh', nights: 3 }], durationDays: 5 })
    );
    expect(result.status).toBe(400);
    expect(result.body.error?.message).toMatch(/Days must equal nights/);
    expect(result.body.error?.message).toMatch(/Route nights add up to 3/);
  });

  it('keeps drafts private, then publishes to listing, detail, destination page and sitemap', async () => {
    const created = await editor.call('POST', '/admin/packages', packageDoc());
    expect(created.status).toBe(201);
    packageId = created.body.data.id;
    expect(created.body.data.health.canPublish).toBe(true);
    expect((await anonymous.call('GET', `/packages/${packageSlug}`)).status).toBe(404);

    expect((await editor.call('POST', `/admin/packages/${packageId}/publish`)).body.data.status).toBe('PUBLISHED');

    const list = await anonymous.call('GET', '/packages?destination=rishikesh&sort=price_asc');
    const card = list.body.data.items.find((item: { slug: string }) => item.slug === packageSlug);
    expect(card).toMatchObject({ fromPrice: 8000, durationNights: 2, route: [{ slug: 'rishikesh', nights: 2 }] });
    expect(card.compareAtPrice).toBeNull();

    const detail = await anonymous.call('GET', `/packages/${packageSlug}`);
    expect(detail.body.data.tiers.map((tier: { level: string }) => tier.level)).toEqual(['BUDGET', 'PREMIUM']);
    expect(detail.body.data.tiers[1]).toMatchObject({ compareAtPrice: 17000, stays: [{ hotelName: 'Ganga view resort' }] });
    expect(detail.body.data.days[1].places[0]).toMatchObject({ slug: 'beatles-ashram', hasPage: true });

    expect((await anonymous.call('GET', '/packages?priceMax=5000')).body.data.items.map((item: { slug: string }) => item.slug)).not.toContain(packageSlug);
    expect((await anonymous.call('GET', '/packages/facets')).body.data.destinations.map((d: { slug: string }) => d.slug)).toContain('rishikesh');

    const destination = await anonymous.call('GET', '/destinations/rishikesh');
    expect(destination.body.data.packages.map((pkg: { slug: string }) => pkg.slug)).toContain(packageSlug);

    const sitemap = await anonymous.call('GET', '/seo/sitemap-entries');
    expect(sitemap.body.data.map((entry: { path: string }) => entry.path)).toContain(`/packages/${packageSlug}`);
  });

  it('imports packages through the bundle importer', async () => {
    const slug = `imported-${packageSlug}`;
    const dryRun = await admin.call('POST', '/admin/imports', { packages: [packageDoc({ slug, title: 'Imported Rishikesh weekend' })] });
    expect(dryRun.body.data.rows[0]).toMatchObject({ entity: 'package', action: 'create' });
    expect((await admin.call('GET', `/admin/packages?q=${slug}`)).body.data.total).toBe(0);
  });
});

describe('quote requests', () => {
  let requestId: string;
  let uttarakhandAgents: string[];
  let rajasthanAgent: string;

  it('lets admins set up agencies and link a login', async () => {
    const linked = await admin.call('POST', '/admin/agents', agentDoc('hills', ['Uttarakhand'], { userEmail: agentUserEmail }));
    expect(linked.status).toBe(201);
    const second = await admin.call('POST', '/admin/agents', agentDoc('ganga', ['Uttarakhand', 'Himachal Pradesh']));
    const desert = await admin.call('POST', '/admin/agents', agentDoc('desert', ['Rajasthan']));
    uttarakhandAgents = [linked.body.data.id, second.body.data.id];
    rajasthanAgent = desert.body.data.id;
    expect((await editor.call('GET', '/admin/agents')).status).toBe(403);
  });

  it('requires a verified phone, and verifies it with a one-time code', async () => {
    const blocked = await traveller.call('POST', '/quote-requests', {
      packageSlug, packageTier: 'PREMIUM', startDate: inTwoMonths, nights: 2, adults: 2, rooms: 1,
      contactName: 'Asha Traveller', consent: true
    });
    expect(blocked.status).toBe(400);
    expect((blocked.body.error as { details?: { code?: string } }).details?.code).toBe('PHONE_NOT_VERIFIED');

    const phone = uniquePhone();
    await traveller.call('POST', '/me/phone/verification', { phone });
    expect((await traveller.call('POST', '/me/phone/verification/confirm', { phone, code: '000000' })).status).toBe(400);
    expect((await traveller.call('POST', '/me/phone/verification', { phone })).status).toBe(429);
    const confirmed = await traveller.call('POST', '/me/phone/verification/confirm', { phone, code: '123456' });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.phone).toBe(`+91${phone}`);
    expect((await traveller.call('GET', '/me')).body.data.phoneVerifiedAt).toBeTruthy();
  });

  it('routes a request to up to three agencies that serve the trip, and blocks duplicates', async () => {
    const body = {
      packageSlug, packageTier: 'PREMIUM', startDate: inTwoMonths, nights: 2, adults: 2, childAges: [8], rooms: 1,
      budgetPerPersonMax: 20000, contactName: 'Asha Traveller', consent: true
    };
    expect((await traveller.call('POST', '/quote-requests', { ...body, consent: false })).status).toBe(400);
    expect((await traveller.call('POST', '/quote-requests', { ...body, startDate: '2020-01-01' })).status).toBe(400);

    const created = await traveller.call('POST', '/quote-requests', body);
    expect(created.status).toBe(201);
    requestId = created.body.data.id;
    expect(created.body.data.status).toBe('ROUTED');
    expect(created.body.data.agenciesContacted).toBeGreaterThanOrEqual(2);
    expect(created.body.data.agenciesContacted).toBeLessThanOrEqual(3);

    const routed = await admin.call('GET', `/admin/quote-requests/${requestId}`);
    const routedIds = routed.body.data.routings.map((routing: { agent: { id: string } }) => routing.agent.id);
    expect(routedIds).toEqual(expect.arrayContaining(uttarakhandAgents));
    expect(routedIds).not.toContain(rajasthanAgent);

    const duplicate = await traveller.call('POST', '/quote-requests', body);
    expect(duplicate.status).toBe(409);
  });

  it('lets the agency see the request and send one quote; others cannot see it', async () => {
    const inbox = await agentUser.call('GET', '/agent/quote-requests');
    expect(inbox.status).toBe(200);
    expect(inbox.body.data.requests.map((entry: { requestId: string }) => entry.requestId)).toContain(requestId);

    const detail = await agentUser.call('GET', `/agent/quote-requests/${requestId}`);
    expect(detail.body.data).toMatchObject({ routingStatus: 'VIEWED', adults: 2, contactName: 'Asha Traveller' });
    expect(detail.body.data.contactPhone).toMatch(/^\+91/);

    const quote = {
      tier: 'PREMIUM', totalPrice: 42000, taxesIncluded: true, validUntil: inTenDays,
      hotels: [{ destinationName: 'Rishikesh', hotelName: 'Ganga view resort', hotelCategory: 4, mealPlan: 'MAP', nights: 2 }],
      inclusions: ['Hotel stay', 'Breakfast and dinner', 'Rafting session', 'Airport pickup'],
      exclusions: ['Lunch'], message: 'Happy to adjust the rafting slot.'
    };
    const sent = await agentUser.call('POST', `/agent/quote-requests/${requestId}/quotes`, quote);
    expect(sent.status).toBe(201);
    expect(sent.body.data.myQuote).toMatchObject({ totalPrice: 42000, pricePerPerson: 14000 });
    expect((await agentUser.call('POST', `/agent/quote-requests/${requestId}/quotes`, quote)).status).toBe(409);

    expect((await traveller.call('GET', '/agent/quote-requests')).status).toBe(403);
    expect((await agentUser.call('GET', '/admin/quote-requests')).status).toBe(403);
  });

  it('lets staff enter a quote for an agency without a login', async () => {
    const result = await admin.call('POST', `/admin/quote-requests/${requestId}/agents/${uttarakhandAgents[1]}/quotes`, {
      tier: 'PREMIUM', totalPrice: 39000, pricePerPerson: 13000, validUntil: inTenDays,
      hotels: [], inclusions: ['Hotel stay', 'Breakfast and dinner'], exclusions: ['Rafting']
    });
    expect(result.status).toBe(201);
  });

  it('compares quotes, then accepting one declines the rest and reveals that agency', async () => {
    const detail = await traveller.call('GET', `/me/quote-requests/${requestId}`);
    expect(detail.body.data.status).toBe('QUOTED');
    expect(detail.body.data.quotes).toHaveLength(2);
    detail.body.data.quotes.forEach((quote: { agent: { phone: string | null } }) => expect(quote.agent.phone).toBeNull());

    const cheapest = detail.body.data.quotes.find((quote: { totalPrice: number }) => quote.totalPrice === 39000);
    expect(detail.body.data.comparison.cheapestQuoteId).toBe(cheapest.id);
    const rafting = detail.body.data.comparison.inclusions.find((row: { item: string }) => row.item === 'Rafting session');
    expect(rafting.coveredBy).toHaveLength(1);

    const accepted = await traveller.call('POST', `/me/quotes/${cheapest.id}/accept`);
    expect(accepted.body.data.status).toBe('ACCEPTED');
    const statuses = accepted.body.data.quotes.map((quote: { id: string; status: string; agent: { phone: string | null } }) => [
      quote.id === cheapest.id, quote.status, Boolean(quote.agent.phone)
    ]);
    expect(statuses).toEqual(expect.arrayContaining([[true, 'ACCEPTED', true], [false, 'REJECTED', false]]));
    expect((await traveller.call('POST', `/me/quotes/${cheapest.id}/accept`)).status).toBe(409);
  });

  it('keeps requests private to their owner', async () => {
    const stranger = new ApiClient(server.baseUrl);
    await stranger.register('Stranger Person', uniqueEmail('stranger'));
    expect((await stranger.call('GET', `/me/quote-requests/${requestId}`)).status).toBe(404);
    expect((await stranger.call('GET', '/me/quote-requests')).body.data).toEqual([]);
  });
});

describe('reviews', () => {
  let reviewId: string;

  it('holds new reviews for moderation and marks verified travellers', async () => {
    const blocked = await traveller.call('POST', '/reviews', {
      packageSlug, rating: 5, body: 'Lovely trip, call me on 98765 43210 for details about it.'
    });
    expect(blocked.status).toBe(400);

    const created = await traveller.call('POST', '/reviews', {
      packageSlug, rating: 4, title: 'Great weekend', travellerType: 'FAMILY', travelledMonth: '2026-10',
      body: 'The riverside stay was calm and the rafting morning was the highlight for our family.'
    });
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ status: 'PENDING', isVerified: true });
    reviewId = created.body.data.id;

    expect((await anonymous.call('GET', `/reviews?packageSlug=${packageSlug}`)).body.data.total).toBe(0);
    expect(
      (await traveller.call('POST', '/reviews', { packageSlug, rating: 3, body: 'Trying to review the same package twice here.' })).status
    ).toBe(409);
  });

  it('publishes approved reviews and updates the package rating', async () => {
    expect((await traveller.call('POST', `/admin/reviews/${reviewId}/moderate`, { decision: 'APPROVED' })).status).toBe(403);
    const queue = await editor.call('GET', '/admin/reviews');
    expect(queue.body.data.map((review: { id: string }) => review.id)).toContain(reviewId);

    expect((await editor.call('POST', `/admin/reviews/${reviewId}/moderate`, { decision: 'APPROVED' })).body.data.status).toBe('APPROVED');
    const reviews = await anonymous.call('GET', `/reviews?packageSlug=${packageSlug}`);
    expect(reviews.body.data.summary).toMatchObject({ average: 4, count: 1 });
    expect(reviews.body.data.items[0]).toMatchObject({ author: 'Asha', isVerified: true });
    expect(JSON.stringify(reviews.body.data)).not.toContain('@e2e.test');

    const pkg = await anonymous.call('GET', `/packages/${packageSlug}`);
    expect(pkg.body.data.reviewSummary).toEqual({ average: 4, count: 1 });
  });

  it('sends edited reviews back to moderation', async () => {
    const edited = await traveller.call('PUT', `/me/reviews/${reviewId}`, {
      rating: 5, body: 'Updated: the rafting morning was even better than we expected overall.'
    });
    expect(edited.body.data.status).toBe('PENDING');
    expect((await anonymous.call('GET', `/reviews?packageSlug=${packageSlug}`)).body.data.total).toBe(0);
  });

  it('accepts unverified reviews of destinations and places', async () => {
    const other = new ApiClient(server.baseUrl);
    await other.register('Bala Reviewer', uniqueEmail('reviewer'));
    const destination = await other.call('POST', '/reviews', {
      destinationSlug: 'rishikesh', rating: 5, body: 'A calm riverside town that is easy to reach for a weekend.'
    });
    expect(destination.body.data).toMatchObject({ status: 'PENDING', isVerified: false });
    const place = await other.call('POST', '/reviews', {
      destinationSlug: 'rishikesh', placeSlug: 'beatles-ashram', rating: 4, body: 'Beautiful murals and a quiet forest walk through the old ashram.'
    });
    expect(place.status).toBe(201);
    expect((await other.call('GET', '/me/reviews')).body.data).toHaveLength(2);
  });
});
