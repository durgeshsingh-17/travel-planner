import { describe, expect, it } from 'vitest';

import { collectionHealth, destinationHealth, placeHealth } from './content-rules';

const words = (count: number) => Array.from({ length: count }, () => 'word').join(' ');

const completeDestination = {
  shortDescription: 'A complete destination description.',
  overview: words(150),
  seoTitle: 'Title',
  seoDescription: 'Description',
  idealDaysMin: 2,
  nearestAirport: 'Airport',
  imageCount: 3,
  hasCover: true,
  monthCount: 12,
  howToReachCount: 2,
  faqCount: 4,
  tagCount: 2,
  publishedPlaceCount: 5
};

describe('content rules', () => {
  it('scores a complete destination 100 and allows publishing', () => {
    expect(destinationHealth(completeDestination)).toMatchObject({ score: 100, canPublish: true, errors: [], warnings: [] });
  });

  it('turns gaps into warnings that lower the score but do not block', () => {
    const health = destinationHealth({ ...completeDestination, faqCount: 1, imageCount: 0, hasCover: false });

    expect(health.canPublish).toBe(true);
    expect(health.score).toBeLessThan(100);
    expect(health.warnings).toEqual(expect.arrayContaining(['At least 4 FAQs', 'A cover image']));
  });

  it('blocks a place whose destination is not published', () => {
    const health = placeHealth({
      description: 'A perfectly fine description.',
      destinationPublished: false,
      timingCount: 0,
      isFree: true,
      imageCount: 0,
      tagCount: 0
    });

    expect(health.canPublish).toBe(false);
    expect(health.errors).toEqual(['Its destination is published']);
  });

  it('blocks an empty collection', () => {
    expect(
      collectionHealth({ intro: 'An intro that is long enough.', publishedItemCount: 0, hasCover: false }).canPublish
    ).toBe(false);
  });
});
