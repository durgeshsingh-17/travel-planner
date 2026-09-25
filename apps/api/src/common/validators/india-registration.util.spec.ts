import { describe, expect, it } from 'vitest';

import {
  isValidIndianRegistration,
  normalizeIndianRegistration
} from './india-registration.util';

describe('Indian registration validation', () => {
  it('accepts state RTO and Bharat series registration formats', () => {
    expect(isValidIndianRegistration('DL 01 AB 1234')).toBe(true);
    expect(isValidIndianRegistration('KA-05-MQ-1234')).toBe(true);
    expect(isValidIndianRegistration('22 BH 1234 AA')).toBe(true);
  });

  it('normalizes and rejects invalid registration numbers', () => {
    expect(normalizeIndianRegistration('dl 01 ab 1234')).toBe('DL01AB1234');
    expect(isValidIndianRegistration('ABC123')).toBe(false);
  });
});
