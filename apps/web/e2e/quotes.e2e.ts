import { api, expect, registerAccount, signIn, test, unique } from './support/fixtures';

test.describe('quotes', () => {
  test('traveller requests quotes, an agency answers, the traveller compares and accepts', async ({ openPage }) => {
    const admin = await registerAccount('Quote Admin', 'ADMIN');
    const agentUser = await registerAccount('Agency Person');
    const traveller = await registerAccount('Asha Traveller');
    const stamp = unique('q');
    await api('POST', '/admin/agents', { slug: `hills-${stamp}`, displayName: 'Hills & Rivers Travel', email: 'hills@agency.test', phone: '9811111111', city: 'Dehradun', serviceStates: ['Uttarakhand'], userEmail: agentUser.email }, admin.token);
    const second = await api<{ id: string }>('POST', '/admin/agents', { slug: `ganga-${stamp}`, displayName: 'Ganga Journeys', email: 'ganga@agency.test', phone: '9822222222', city: 'Haridwar', serviceStates: ['Uttarakhand'] }, admin.token);
    const slug = `rishikesh-weekend-${stamp}`;
    const pkg = await api<{ id: string }>('POST', '/admin/packages', {
      slug,
      title: 'Rishikesh riverside weekend',
      summary: 'Two nights by the Ganga with a rafting morning and an evening aarti.',
      overview: 'A relaxed weekend by the river.\n\nEvenings at the ghats and a morning on the water.',
      durationDays: 3,
      durationNights: 2,
      startLocationSlug: 'delhi',
      availableMonths: [10, 11, 12, 1, 2, 3],
      route: [{ destinationSlug: 'rishikesh', nights: 2 }],
      tiers: [
        { level: 'BUDGET', pricePerPerson: 8000, taxesIncluded: true },
        { level: 'PREMIUM', pricePerPerson: 15000, taxesIncluded: true, hotelCategory: 4 }
      ],
      days: [
        { dayNumber: 1, title: 'Drive and evening aarti', description: 'Arrive by afternoon and walk to Triveni Ghat.', mealsIncluded: ['D'] },
        { dayNumber: 2, title: 'Rafting and ashrams', description: 'Morning rafting, afternoon at the ashram quarter.', mealsIncluded: ['B', 'D'] },
        { dayNumber: 3, title: 'Return', description: 'Breakfast and drive back.', mealsIncluded: ['B'] }
      ],
      stays: [
        { tierLevel: 'BUDGET', destinationSlug: 'rishikesh', nights: 2, hotelName: 'Riverside guesthouse', mealPlan: 'MAP' },
        { tierLevel: 'PREMIUM', destinationSlug: 'rishikesh', nights: 2, hotelName: 'Ganga view resort', mealPlan: 'MAP', hotelCategory: 4 }
      ],
      inclusions: ['Hotel stay', 'Breakfast and dinner', 'Rafting session'],
      exclusions: ['Lunch'],
      policies: [{ kind: 'CANCELLATION', body: 'Free cancellation up to 7 days before departure.' }]
    }, admin.token);
    await api('POST', `/admin/packages/${pkg.id}/publish`, {}, admin.token);

    // Traveller picks the premium tier and asks for quotes.
    const travellerPage = await openPage();
    await travellerPage.goto(`/packages/${slug}`);
    await travellerPage.getByRole('radio', { name: 'Premium' }).click();
    await expect(travellerPage.locator('.price-card .price strong', { hasText: '15,000' })).toBeVisible();
    await travellerPage.locator('.price-card').getByRole('link', { name: 'Get quotes' }).click();
    await travellerPage.waitForURL(/sign-in/);
    await travellerPage.locator('input[formcontrolname="email"]').fill(traveller.email);
    await travellerPage.locator('input[formcontrolname="password"]').fill('password-123');
    await travellerPage.locator('button[type="submit"]').click();
    await travellerPage.waitForURL(/\/quote\?.*tier=PREMIUM/);

    const phone = `9${Math.floor(100_000_000 + Math.random() * 899_999_999)}`;
    await travellerPage.getByLabel('Start date').fill(new Date(Date.now() + 45 * 86_400_000).toISOString().slice(0, 10));
    await travellerPage.getByRole('button', { name: 'Continue' }).click();
    await travellerPage.getByRole('button', { name: 'Continue' }).click();
    await travellerPage.getByLabel('Mobile number').fill(phone);
    await travellerPage.getByRole('button', { name: 'Send code' }).click();
    await travellerPage.getByLabel('6-digit code').fill('123456');
    await travellerPage.getByRole('button', { name: 'Verify' }).click();
    await expect(travellerPage.getByText('Verified', { exact: true })).toBeVisible();
    await travellerPage.getByRole('checkbox').check();
    await travellerPage.getByRole('button', { name: 'Send request' }).click();
    await travellerPage.waitForURL(/\/quotes\/[0-9a-f-]{36}$/);
    await expect(travellerPage.getByRole('heading', { name: 'Waiting for quotes' })).toBeVisible();
    const requestId = new URL(travellerPage.url()).pathname.split('/').pop()!;

    // The agency answers from its inbox.
    const agencyPage = await openPage();
    await signIn(agencyPage, agentUser.email, '/agent');
    await agencyPage.getByRole('link', { name: /Rishikesh riverside weekend/ }).first().click();
    await expect(agencyPage.getByText(`+91${phone}`)).toBeVisible();
    await agencyPage.getByLabel('Total price for the group (₹)').fill('42000');
    await agencyPage.getByLabel('Hotel', { exact: true }).fill('Ganga view resort');
    await agencyPage.getByLabel('Included (one per line)', { exact: true }).fill('Hotel stay\nBreakfast and dinner\nRafting session');
    await agencyPage.getByRole('button', { name: 'Send quote' }).click();
    await expect(agencyPage.getByRole('heading', { name: 'Your quote' })).toBeVisible();

    // Staff add the second agency's quote on its behalf.
    await api('POST', `/admin/quote-requests/${requestId}/agents/${second.id}/quotes`, {
      totalPrice: 39000,
      validUntil: new Date(Date.now() + 5 * 86_400_000).toISOString(),
      hotels: [],
      inclusions: ['Hotel stay', 'Breakfast and dinner']
    }, admin.token);

    // Traveller compares and accepts the cheaper one.
    await travellerPage.reload();
    await expect(travellerPage.getByRole('heading', { name: 'Compare quotes' })).toBeVisible();
    await expect(travellerPage.getByText('Lowest price')).toHaveCount(1);
    await travellerPage.getByRole('button', { name: 'Accept', exact: true }).first().click();
    await expect(travellerPage.getByRole('heading', { name: /You accepted Ganga Journeys/ })).toBeVisible();
    await expect(travellerPage.getByText('+919822222222')).toBeVisible();
  });
});
