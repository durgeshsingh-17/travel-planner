import { describe, expect, it } from 'vitest';

import { ContentWriterService } from './content-writer.service';
import { packageHealth } from './shared/content-rules';

const writer = new ContentWriterService() as unknown as { packageProblems: (doc: object) => string[] };

const base = {
  slug: 'p',
  title: 'Package',
  summary: 'A summary that is long enough.',
  durationDays: 3,
  durationNights: 2,
  route: [{ destinationSlug: 'rishikesh', nights: 2 }],
  tiers: [{ level: 'BUDGET', pricePerPerson: 8000 }],
  days: [1, 2, 3].map((dayNumber) => ({ dayNumber, title: 'Day', description: 'A long enough day.' })),
  stays: [{ tierLevel: 'BUDGET', destinationSlug: 'rishikesh', nights: 2, hotelName: 'Hotel', mealPlan: 'CP' }]
};

describe('package consistency rules', () => {
  it('accepts a consistent package', () => {
    expect(writer.packageProblems(base)).toEqual([]);
  });

  it('reports every inconsistency at once', () => {
    const problems = writer.packageProblems({
      ...base,
      durationDays: 5,
      route: [{ destinationSlug: 'rishikesh', nights: 3 }],
      tiers: [{ level: 'BUDGET', pricePerPerson: 8000, compareAtPrice: 8000 }, { level: 'BUDGET', pricePerPerson: 9000 }],
      days: [{ dayNumber: 1, title: 'Day', description: 'x' }, { dayNumber: 3, title: 'Day', description: 'x' }],
      stays: [
        { tierLevel: 'PREMIUM', destinationSlug: 'rishikesh', nights: 1, hotelName: 'Palace', mealPlan: 'AP' },
        { tierLevel: 'BUDGET', destinationSlug: 'goa', nights: 2, hotelName: 'Beach hut', mealPlan: 'EP' }
      ]
    });

    expect(problems).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Days must equal nights/),
        expect.stringMatching(/Route nights add up to 3/),
        expect.stringMatching(/Each tier level can appear only once/),
        expect.stringMatching(/"was" price must be higher/),
        expect.stringMatching(/exactly one entry for each day 1–5/),
        expect.stringMatching(/tier PREMIUM, which the package does not offer/),
        expect.stringMatching(/in goa, which is not on the route/),
        expect.stringMatching(/PREMIUM stays cover 1 nights/)
      ])
    );
  });
});

describe('packageHealth', () => {
  const complete = {
    summary: 'A summary that is long enough.',
    overview: Array.from({ length: 150 }, () => 'word').join(' '),
    durationDays: 3,
    routeCount: 1,
    unpublishedRouteDestinations: 0,
    tierCount: 2,
    dayCount: 3,
    tiersWithoutStays: 0,
    inclusionCount: 3,
    exclusionCount: 2,
    hasCancellationPolicy: true,
    imageCount: 3,
    hasCover: true,
    faqCount: 3,
    tagCount: 1,
    seoTitle: 'T',
    seoDescription: 'D'
  };

  it('blocks publishing when the route includes an unpublished destination or days are missing', () => {
    const health = packageHealth({ ...complete, unpublishedRouteDestinations: 1, dayCount: 2 });

    expect(health.canPublish).toBe(false);
    expect(health.errors).toEqual(['Every destination on the route is published', 'A day-by-day itinerary for every day']);
  });

  it('scores a complete package 100', () => {
    expect(packageHealth(complete)).toMatchObject({ score: 100, canPublish: true });
  });
});
