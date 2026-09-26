import { dayRange, durationRange, inrRange, monthRanges, paragraphs } from './content-format.util';

describe('content formatting', () => {
  it('collapses month lists into ranges, wrapping over the new year', () => {
    expect(monthRanges([10, 11, 12, 1, 2, 3, 4])).toBe('Oct–Apr');
    expect(monthRanges([3, 4, 5, 6, 10, 11])).toBe('Mar–Jun, Oct–Nov');
    expect(monthRanges([7])).toBe('Jul');
    expect(monthRanges(Array.from({ length: 12 }, (_, index) => index + 1))).toBe('All year');
    expect(monthRanges([])).toBeNull();
  });

  it('formats ranges and hides unknown values', () => {
    expect(inrRange(1500, 4500)).toBe('₹1,500–₹4,500');
    expect(inrRange(null, null)).toBeNull();
    expect(durationRange(45, 90)).toBe('45 min – 1 h 30 min');
    expect(durationRange(null, null)).toBeNull();
    expect(dayRange(2, 4)).toBe('2–4 days');
    expect(dayRange(1, null)).toBe('1 day');
  });

  it('splits text into paragraphs', () => {
    expect(paragraphs('One.\n\nTwo\nlines.\n\n  \n')).toEqual(['One.', 'Two\nlines.']);
  });
});
