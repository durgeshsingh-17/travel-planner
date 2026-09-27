import { Locator, Page } from '@playwright/test';

import { api, expect, registerAccount, signIn, test } from './support/fixtures';

async function generatedTrip(token: string) {
  const trip = await api<{ id: string }>(
    'POST',
    '/trips',
    {
      source: { name: 'Delhi', latitude: 28.6139, longitude: 77.209 },
      destination: { name: 'Rishikesh', latitude: 30.0869, longitude: 78.2676 },
      startDate: '2027-03-10',
      endDate: '2027-03-12',
      travellerCount: 1,
      travellers: [{ fullName: 'Asha Planner', age: 31, gender: 'FEMALE' }],
      travelMode: 'CAR',
      interests: ['Nature'],
      pace: 'RELAXED'
    },
    token
  );
  await api('POST', `/trips/${trip.id}/generate-itinerary`, {}, token);
  return trip.id;
}

const day = (page: Page, dayNumber: number) => page.locator('article.day').filter({ has: page.locator(`#day-title-${dayNumber}`) });
const stopTitles = (scope: Locator) => scope.locator('li.stop h3').allInnerTexts();

/** CDK drag needs real pointer movement, not a single synthetic drop. */
async function drag(page: Page, handle: Locator, target: Locator) {
  // Tab bodies slide in; measure only once the handle has stopped moving.
  await expect.poll(async () => {
    const first = await handle.boundingBox();
    await page.waitForTimeout(100);
    return JSON.stringify(first) === JSON.stringify(await handle.boundingBox());
  }).toBe(true);
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2 + 12, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 16 });
  await page.mouse.up();
}

test.describe('itinerary', () => {
  test('owner edits the plan: reorder, drag across days, add, remove and re-plan', async ({ page }) => {
    // Tall enough that both days are on screen for the drag.
    await page.setViewportSize({ width: 1280, height: 2200 });
    const owner = await registerAccount('Asha Planner');
    const tripId = await generatedTrip(owner.token);
    await signIn(page, owner.email, `/trip/${tripId}`);
    await page.getByRole('tab', { name: 'Itinerary' }).click();

    await expect(page.getByText('Night in Rishikesh').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Rishikesh guide' })).toBeVisible();

    // Drag a stop from day 2 onto day 1.
    const dayTwo = day(page, 2);
    const moving = (await stopTitles(dayTwo))[0];
    await drag(page, dayTwo.getByRole('button', { name: `Drag ${moving}` }), day(page, 1).locator('li.stop').first());
    await expect(page.getByText('Moved to day 1')).toBeVisible();
    await expect.poll(() => stopTitles(day(page, 1))).toContain(moving);
    expect(await stopTitles(dayTwo)).not.toContain(moving);

    // Keyboard-friendly reorder from the stop menu.
    const before = await stopTitles(dayTwo);
    await dayTwo.getByRole('button', { name: `Options for ${before[1]}` }).click();
    await page.getByRole('menuitem', { name: 'Move up' }).click();
    await expect(page.getByText('Order updated')).toBeVisible();
    await expect.poll(() => stopTitles(dayTwo)).toEqual([before[1], before[0], ...before.slice(2)]);
    await expect(dayTwo.locator('li.stop').first().getByText('Edited')).toBeVisible();

    // Add a custom stop, then remove it.
    await dayTwo.getByRole('button', { name: 'Add a stop' }).click();
    await dayTwo.getByLabel('Your own stop').fill('Evening aarti at Parmarth Niketan');
    await dayTwo.getByRole('button', { name: 'Add stop' }).click();
    await expect(page.getByText('Stop added')).toBeVisible();
    await expect(dayTwo.getByRole('heading', { name: 'Evening aarti at Parmarth Niketan' })).toBeVisible();
    await dayTwo.getByRole('button', { name: 'Options for Evening aarti at Parmarth Niketan' }).click();
    await page.getByRole('menuitem', { name: 'Remove' }).click();
    await expect(dayTwo.getByRole('heading', { name: 'Evening aarti at Parmarth Niketan' })).toHaveCount(0);

    // Re-plan the day.
    await dayTwo.getByRole('button', { name: 'Re-plan day' }).click();
    await expect(page.getByText('Day 2 re-planned')).toBeVisible();

    // Budget explains itself; route says where the numbers came from.
    await page.getByRole('tab', { name: 'Budget' }).click();
    await expect(page.getByText('How we worked this out')).toBeVisible();
    await expect(page.getByText(/km ÷ \d+ km\/l/)).toBeVisible();
    await page.getByRole('tab', { name: 'Route' }).click();
    await expect(page.getByText(/estimated from the straight-line distance/)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open directions in OpenStreetMap' })).toHaveAttribute('href', /openstreetmap\.org\/directions/);
  });

  test('shared links show the plan without any editing controls', async ({ page }) => {
    const owner = await registerAccount('Bala Sharer');
    const tripId = await generatedTrip(owner.token);
    const { shareSlug } = await api<{ shareSlug: string }>('POST', `/trips/${tripId}/share`, {}, owner.token);

    await page.goto(`/t/${shareSlug}`);
    await page.getByRole('tab', { name: 'Itinerary' }).click();
    await expect(page.locator('article.day').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add a stop' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Drag / })).toHaveCount(0);
  });

  test('planner offers a pace and a daily drive limit', async ({ page }) => {
    await page.goto('/plan');
    const modes = page.locator('mat-button-toggle-group[formcontrolname="travelMode"]');
    await expect(page.locator('mat-button-toggle-group[formcontrolname="pace"]').getByText('Relaxed')).toBeVisible();
    await modes.getByText('Car', { exact: true }).click();
    await expect(page.getByLabel('Longest drive in a day')).toBeVisible();
    await modes.getByText('Flight', { exact: true }).click();
    await expect(page.getByLabel('Longest drive in a day')).toHaveCount(0);
  });
});
