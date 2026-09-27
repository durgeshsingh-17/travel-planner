import { expect, test } from './support/fixtures';

test.describe('public browsing', () => {
  test('destination and place pages are server-rendered and linked', async ({ page, request }) => {
    // Server HTML already carries the content (for search engines and link previews).
    const html = await (await request.get('/destinations/rishikesh')).text();
    expect(html).toContain('<h1');
    expect(html).toContain('Rishikesh');
    expect(html).toContain('application/ld+json');

    await page.goto('/destinations');
    await page.getByRole('link', { name: /Rishikesh/ }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Rishikesh' })).toBeVisible();
    await page.goto('/destinations/rishikesh/places');
    await page.getByRole('link', { name: /Triveni Ghat/ }).first().click();
    await expect(page.getByRole('heading', { level: 1, name: 'Triveni Ghat' })).toBeVisible();
  });

  test('unknown pages answer 404 with a helpful page', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist');

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: "We couldn't find that page" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await page.getByRole('link', { name: 'Browse destinations' }).click();
    await expect(page).toHaveURL(/\/destinations$/);
  });

  test('pages carry security headers, robots and a sitemap', async ({ request }) => {
    const home = await request.get('/');
    expect(home.status()).toBe(200);
    expect(home.headers()['x-content-type-options']).toBe('nosniff');
    expect(home.headers()['x-frame-options']).toBe('SAMEORIGIN');
    expect(home.headers()['content-security-policy']).toContain("frame-ancestors 'self'");
    expect(home.headers()['x-powered-by']).toBeUndefined();

    expect(await (await request.get('/robots.txt')).text()).toContain('Disallow: /admin');
    expect(await (await request.get('/sitemap.xml')).text()).toContain('/destinations/rishikesh');
  });

  test('destination page fits a phone screen', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/destinations/rishikesh');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
