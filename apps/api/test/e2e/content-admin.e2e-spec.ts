import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ApiClient, ApiServer, runCli, startApi, uniqueEmail } from './harness';

let server: ApiServer;
let admin: ApiClient;
let editor: ApiClient;
let traveller: ApiClient;
let anonymous: ApiClient;
const suffix = Math.random().toString(36).slice(2, 8);
const slug = (name: string) => `${name}-${suffix}`;

// 1×1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

function destinationDoc(overrides: Record<string, unknown> = {}) {
  return {
    slug: slug('e2e-town'),
    name: 'E2E Town',
    state: 'Uttarakhand',
    latitude: 30.1,
    longitude: 78.3,
    shortDescription: 'A test destination used by the end-to-end suite.',
    tags: [],
    months: [{ month: 10, rating: 'GOOD' }],
    ...overrides
  };
}

beforeAll(async () => {
  server = await startApi();
  admin = new ApiClient(server.baseUrl);
  editor = new ApiClient(server.baseUrl);
  traveller = new ApiClient(server.baseUrl);
  anonymous = new ApiClient(server.baseUrl);
  const adminEmail = uniqueEmail('admin');
  const editorEmail = uniqueEmail('editor');
  await admin.register('Admin Person', adminEmail);
  await editor.register('Editor Person', editorEmail);
  await traveller.register('Traveller Person', uniqueEmail('traveller'));
  await runCli('promote-user', [adminEmail, 'ADMIN']);
  await runCli('promote-user', [editorEmail, 'EDITOR']);
});

afterAll(async () => {
  await server?.stop();
});

describe('public content', () => {
  it('lists only published destinations, with facets, home rails and search', async () => {
    const list = await anonymous.call('GET', '/destinations?pageSize=48');
    expect(list.status).toBe(200);
    expect(list.body.data).toMatchObject({ page: 1, pageSize: 48 });
    expect(list.body.data.items.map((item: { slug: string }) => item.slug)).toContain('rishikesh');

    const facets = await anonymous.call('GET', '/destinations/facets');
    expect(facets.body.data.states.length).toBeGreaterThan(0);

    const home = await anonymous.call('GET', '/home?month=10');
    expect(home.body.data).toMatchObject({ month: 10, stats: expect.any(Object) });

    const suggest = await anonymous.call('GET', '/search/suggest?q=gurgaon');
    expect(suggest.body.data.locations.map((location: { slug: string }) => location.slug)).toEqual(['gurugram']);
    expect((await anonymous.call('GET', '/locations?q=gurgaon')).body.data[0].slug).toBe('gurugram');
  });

  it('returns 404 for unknown and malformed slugs', async () => {
    expect((await anonymous.call('GET', '/destinations/nowhere-at-all')).status).toBe(404);
    expect((await anonymous.call('GET', '/destinations/Robert%27);DROP')).status).toBe(404);
  });
});

describe('admin access', () => {
  it('keeps travellers and anonymous users out, and limits editors', async () => {
    expect((await anonymous.call('GET', '/admin/destinations')).status).toBe(401);
    expect((await traveller.call('GET', '/admin/destinations')).status).toBe(403);
    expect((await editor.call('GET', '/admin/destinations')).status).toBe(200);
    expect((await editor.call('GET', '/admin/users')).status).toBe(403);
    expect((await editor.call('POST', '/admin/imports', {})).status).toBe(403);
    expect((await admin.call('GET', '/admin/users')).status).toBe(200);
  });
});

describe('editorial workflow', () => {
  let destinationId: string;
  let placeId: string;
  let updatedAt: string;

  it('keeps drafts private until published', async () => {
    const created = await editor.call('POST', '/admin/destinations', destinationDoc());
    expect(created.status).toBe(201);
    expect(created.body.data.status).toBe('DRAFT');
    destinationId = created.body.data.id;
    updatedAt = created.body.data.updatedAt;

    expect((await anonymous.call('GET', `/destinations/${slug('e2e-town')}`)).status).toBe(404);

    const place = await editor.call('POST', '/admin/places', {
      destinationId,
      slug: 'test-viewpoint',
      name: 'Test Viewpoint',
      category: 'VIEWPOINT',
      description: 'A viewpoint used by the end-to-end suite.',
      latitude: 30.101,
      longitude: 78.301,
      isFree: true,
      timings: [{ dayOfWeek: 0, isClosed: true }]
    });
    placeId = place.body.data.id;

    const blocked = await editor.call('POST', `/admin/places/${placeId}/publish`);
    expect(blocked.status).toBe(400);
    expect(blocked.body.error.message).toMatch(/destination is published/);
  });

  it('publishes, shows the page publicly and lists it in the sitemap', async () => {
    const published = await editor.call('POST', `/admin/destinations/${destinationId}/publish`);
    expect(published.body.data.status).toBe('PUBLISHED');
    expect((await editor.call('POST', `/admin/places/${placeId}/publish`)).status).toBe(201);

    const page = await anonymous.call('GET', `/destinations/${slug('e2e-town')}`);
    expect(page.status).toBe(200);
    expect(page.body.data.places.map((place: { slug: string }) => place.slug)).toEqual(['test-viewpoint']);

    const placePage = await anonymous.call('GET', `/destinations/${slug('e2e-town')}/places/test-viewpoint`);
    expect(placePage.body.data).toMatchObject({ isFree: true, openNow: { status: expect.any(String) } });

    const sitemap = await anonymous.call('GET', '/seo/sitemap-entries');
    const paths = sitemap.body.data.map((entry: { path: string }) => entry.path);
    expect(paths).toContain(`/destinations/${slug('e2e-town')}`);
    expect(paths).toContain(`/destinations/${slug('e2e-town')}/places/test-viewpoint`);
  });

  it('rejects a save based on a stale copy', async () => {
    const stale = await editor.call('PUT', `/admin/destinations/${destinationId}`, {
      ...destinationDoc({ name: 'Stale edit' }),
      expectedUpdatedAt: '2000-01-01T00:00:00.000Z'
    });
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe('CONFLICT');
    expect(updatedAt).toBeTruthy();
  });

  it('redirects old slugs after a published destination is renamed', async () => {
    const current = await editor.call('GET', `/admin/destinations/${destinationId}`);
    const renamed = await editor.call('PUT', `/admin/destinations/${destinationId}`, {
      ...current.body.data.document,
      slug: slug('e2e-city'),
      expectedUpdatedAt: current.body.data.updatedAt
    });
    expect(renamed.status).toBe(200);

    const viaOldSlug = await anonymous.call('GET', `/destinations/${slug('e2e-town')}`);
    expect(viaOldSlug.status).toBe(200);
    expect(viaOldSlug.body.data.slug).toBe(slug('e2e-city'));

    const oldPlaceUrl = await anonymous.call('GET', `/destinations/${slug('e2e-town')}/places/test-viewpoint`);
    expect(oldPlaceUrl.body.data.slug).toBe('test-viewpoint');

    const audit = await editor.call('GET', `/admin/audit-log?entityType=DESTINATION&entityId=${destinationId}`);
    expect(audit.body.data.items.map((entry: { action: string }) => entry.action)).toEqual(
      expect.arrayContaining(['CREATE', 'PUBLISH', 'UPDATE'])
    );
  });

  it('uploads images by content, attaches a cover and protects images in use', async () => {
    const svg = await editor.upload('/admin/media/upload', new Blob(['<svg/>']), 'x.png', {
      altText: 'Not really a PNG',
      license: 'OWNED'
    });
    expect(svg.status).toBe(400);

    const uploaded = await editor.upload('/admin/media/upload', new Blob([PNG]), 'dot.png', {
      altText: 'A single pixel',
      license: 'OWNED'
    });
    expect(uploaded.status).toBe(201);
    expect(uploaded.body.data).toMatchObject({ width: 1, height: 1, mimeType: 'image/png' });
    const mediaId = uploaded.body.data.id;
    const file = await fetch(uploaded.body.data.url.replace(/^https?:\/\/[^/]+/, server.baseUrl.replace('/api/v1', '')));
    expect(file.status).toBe(200);
    expect(file.headers.get('content-type')).toBe('image/png');

    const current = await editor.call('GET', `/admin/destinations/${destinationId}`);
    await editor.call('PUT', `/admin/destinations/${destinationId}`, {
      ...current.body.data.document,
      media: [{ mediaId, isCover: true }]
    });
    const page = await anonymous.call('GET', `/destinations/${slug('e2e-city')}`);
    expect(page.body.data.cover).toMatchObject({ altText: 'A single pixel', width: 1 });

    expect((await editor.call('DELETE', `/admin/media/${mediaId}`)).status).toBe(409);
  });

  it('lets only admins delete, and only after unpublishing', async () => {
    expect((await editor.call('DELETE', `/admin/destinations/${destinationId}`)).status).toBe(403);
    expect((await admin.call('DELETE', `/admin/destinations/${destinationId}`)).status).toBe(409);
    await admin.call('POST', `/admin/destinations/${destinationId}/unpublish`);
    expect((await anonymous.call('GET', `/destinations/${slug('e2e-city')}`)).status).toBe(404);
    expect((await admin.call('DELETE', `/admin/destinations/${destinationId}`)).status).toBe(200);
  });
});

describe('importer', () => {
  const bundle = () => ({
    tags: [{ slug: slug('e2e-theme'), name: 'E2E theme' }],
    destinations: [
      destinationDoc({ slug: slug('import-town'), name: 'Import Town', tags: [slug('e2e-theme')], status: 'PUBLISHED' })
    ],
    places: [
      {
        destinationSlug: slug('import-town'),
        slug: 'import-lake',
        name: 'Import Lake',
        category: 'VIEWPOINT',
        description: 'A lake created by the importer test.',
        latitude: 30.2,
        longitude: 78.4,
        status: 'PUBLISHED'
      }
    ]
  });

  it('dry-runs without writing, then applies atomically and is idempotent', async () => {
    const dryRun = await admin.call('POST', '/admin/imports', bundle());
    expect(dryRun.status).toBe(201);
    expect(dryRun.body.data).toMatchObject({ dryRun: true, applied: false });
    expect(dryRun.body.data.rows.map((row: { action: string }) => row.action)).toEqual(['create', 'create', 'create']);
    expect((await anonymous.call('GET', `/destinations/${slug('import-town')}`)).status).toBe(404);

    const applied = await admin.call('POST', '/admin/imports?dryRun=false', bundle());
    expect(applied.body.data.applied).toBe(true);
    const page = await anonymous.call('GET', `/destinations/${slug('import-town')}`);
    expect(page.status).toBe(200);
    expect(page.body.data.tags[0].slug).toBe(slug('e2e-theme'));

    const again = await admin.call('POST', '/admin/imports', bundle());
    expect(again.body.data.rows.every((row: { action: string }) => row.action === 'unchanged')).toBe(true);
  });

  it('writes nothing when any row fails', async () => {
    const broken = await admin.call('POST', '/admin/imports?dryRun=false', {
      destinations: [destinationDoc({ slug: slug('never-created'), name: 'Never Created' })],
      places: [
        {
          destinationSlug: 'missing-destination',
          slug: 'orphan',
          name: 'Orphan',
          category: 'VIEWPOINT',
          description: 'A place whose destination does not exist.',
          latitude: 30,
          longitude: 78
        }
      ]
    });
    expect(broken.body.data.applied).toBe(false);
    expect(broken.body.data.rows[1]).toMatchObject({ action: 'error' });
    expect((await admin.call('GET', `/admin/destinations?q=${slug('never-created')}`)).body.data.total).toBe(0);
  });

  it('imports locations from CSV', async () => {
    const csv = `slug,name,state,latitude,longitude,aliases\n${slug('csv-town')},Csv Town,Punjab,30.9,75.8,Old Csv|Csvpur\n`;
    const result = await admin.call('POST', '/admin/imports/csv?dryRun=false', { entity: 'locations', csv });
    expect(result.body.data).toMatchObject({ applied: true });

    const found = await anonymous.call('GET', '/locations?q=csvpur');
    expect(found.body.data[0].slug).toBe(slug('csv-town'));
  });
});
