import { describe, expect, it } from 'vitest';

import { parseCsv } from './csv.util';

describe('parseCsv', () => {
  it('handles quotes, escaped quotes, embedded commas and newlines', () => {
    const csv = 'slug,name,description\r\n"a","Ashram, old","Line one\nline ""two"""\nb,Ghat,Plain\n';

    expect(parseCsv(csv)).toEqual({
      header: ['slug', 'name', 'description'],
      rows: [
        { slug: 'a', name: 'Ashram, old', description: 'Line one\nline "two"' },
        { slug: 'b', name: 'Ghat', description: 'Plain' }
      ]
    });
  });

  it('ignores a byte-order mark and blank lines, and fills missing cells', () => {
    expect(parseCsv('﻿a,b\n\n1\n').rows).toEqual([{ a: '1', b: '' }]);
  });

  it('rejects unterminated quotes', () => {
    expect(() => parseCsv('a\n"oops')).toThrow(/unterminated/);
  });
});
