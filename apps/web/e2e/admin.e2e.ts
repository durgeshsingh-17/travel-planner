import { api, expect, registerAccount, signIn, test, unique } from './support/fixtures';

test.describe('admin', () => {
  test('an editor publishes a draft collection and it goes live', async ({ page, openPage }) => {
    const editor = await registerAccount('Content Editor', 'EDITOR');
    const slug = unique('river-towns');
    const draft = await api<{ id: string }>('POST', '/admin/collections', {
      slug,
      title: 'River towns for a slow weekend',
      intro: 'Quiet riverside towns within a day’s drive of Delhi, picked for easy walks and good food.',
      items: [{ destinationSlug: 'rishikesh', blurb: 'Ghats, cafes and short hikes.' }]
    }, editor.token);

    const visitor = await openPage();
    expect((await visitor.goto(`/collections/${slug}`))?.status()).toBe(404);

    await signIn(page, editor.email, `/admin/collections/${draft.id}`);
    await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('River towns for a slow weekend');
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.getByText('Published').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'View live' })).toBeVisible();

    expect((await visitor.goto(`/collections/${slug}`))?.status()).toBe(200);
    await expect(visitor.getByRole('heading', { level: 1, name: 'River towns for a slow weekend' })).toBeVisible();
    await expect(visitor.getByRole('link', { name: /Rishikesh/ }).first()).toBeVisible();
  });

  test('travellers cannot open the admin area', async ({ page }) => {
    const traveller = await registerAccount('Curious Traveller');
    await signIn(page, traveller.email, '/admin');

    await expect(page).not.toHaveURL(/\/admin/);
  });
});
