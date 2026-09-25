import { describe, expect, it } from 'vitest';

import {
  formatIndianRegistration,
  isValidIndianRegistration,
  normalizeIndianRegistration
} from './india-registration.util';

describe('india registration utilities', () => {
  it('validates common Indian RTO formats', () => {
    expect(isValidIndianRegistration('DL 01 AB 1234')).toBe(true);
    expect(isValidIndianRegistration('22 BH 1234 AA')).toBe(true);
    expect(isValidIndianRegistration('DL 123')).toBe(false);
  });

  it('normalizes and formats registration numbers', () => {
    expect(normalizeIndianRegistration('ka-05-mq-1234')).toBe('KA05MQ1234');
    expect(formatIndianRegistration('ka05mq1234')).toBe('KA 05 MQ 1234');
    expect(formatIndianRegistration('22bh1234aa')).toBe('22 BH 1234 AA');
  });
});
