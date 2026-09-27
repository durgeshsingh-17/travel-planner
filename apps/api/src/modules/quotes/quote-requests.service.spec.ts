import { describe, expect, it } from 'vitest';

import { QuoteRequestsService, indiaToday } from './quote-requests.service';

describe('QuoteRequestsService.compare', () => {
  const service = new QuoteRequestsService({} as never, {} as never);

  it('finds the cheapest live quote and which quotes cover each inclusion', () => {
    const comparison = service.compare([
      { id: 'q1', status: 'SENT', pricePerPerson: 14000, inclusions: ['Hotel stay', 'Rafting session'] },
      { id: 'q2', status: 'SENT', pricePerPerson: 13000, inclusions: ['hotel stay', 'Breakfast'] },
      { id: 'q3', status: 'REJECTED', pricePerPerson: 9000, inclusions: ['Everything'] }
    ]);

    expect(comparison.cheapestQuoteId).toBe('q2');
    expect(comparison.inclusions[0]).toEqual({ item: 'Hotel stay', coveredBy: ['q1', 'q2'] });
    expect(comparison.inclusions.map((row) => row.item)).not.toContain('Everything');
  });
});

describe('indiaToday', () => {
  it('uses the Indian calendar date, not UTC', () => {
    // 20:00 UTC on 30 Sep is 01:30 IST on 1 Oct.
    expect(indiaToday(new Date('2026-09-30T20:00:00Z'))).toBe('2026-10-01');
  });
});
