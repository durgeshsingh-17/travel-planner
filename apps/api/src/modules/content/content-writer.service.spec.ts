import { describe, expect, it } from 'vitest';

import { ContentWriterService } from './content-writer.service';

describe('ContentWriterService.changedFields', () => {
  const writer = new ContentWriterService();

  it('ignores fields the incoming row leaves out', () => {
    expect(writer.changedFields({ name: 'A', tagline: 'x' }, { name: 'A' })).toEqual([]);
  });

  it('reports scalar and nested changes', () => {
    expect(
      writer.changedFields(
        { name: 'A', months: [{ month: 1, rating: 'GOOD', notes: null }] },
        { name: 'B', months: [{ month: 1, rating: 'OK' }] }
      )
    ).toEqual(['name', 'months']);
  });

  it('treats null and missing nested fields as equal', () => {
    expect(
      writer.changedFields(
        { howToReach: [{ mode: 'AIR', hubName: 'X', distanceKm: null, summary: 'S' }] },
        { howToReach: [{ mode: 'AIR', hubName: 'X', summary: 'S' }] }
      )
    ).toEqual([]);
  });

  it('compares tags as a set and images by URL and cover flag', () => {
    expect(writer.changedFields({ tags: ['a', 'b'] }, { tags: ['b', 'a'] })).toEqual([]);
    expect(
      writer.changedFields(
        { media: [{ mediaId: 'm1', url: 'https://img/1.jpg', isCover: true }] },
        { media: [{ url: 'https://img/1.jpg' }] }
      )
    ).toEqual([]);
    expect(
      writer.changedFields(
        { media: [{ mediaId: 'm1', url: 'https://img/1.jpg', isCover: true }] },
        { media: [{ url: 'https://img/2.jpg' }] }
      )
    ).toEqual(['media']);
  });

  it('never reports the destination reference as a change', () => {
    expect(
      writer.changedFields({ destinationId: 'd1', destinationSlug: 'x' }, { destinationSlug: 'x', destinationId: undefined })
    ).toEqual([]);
  });
});
