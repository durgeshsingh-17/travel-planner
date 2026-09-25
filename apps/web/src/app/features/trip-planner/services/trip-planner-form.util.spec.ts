import { describe, expect, it } from 'vitest';

import {
  isTravellerDraftValid,
  normalizePassengerCount
} from './trip-planner-form.util';

describe('trip planner traveller helpers', () => {
  it('keeps passenger count dynamic but never below one', () => {
    expect(normalizePassengerCount(3)).toBe(3);
    expect(normalizePassengerCount(0)).toBe(1);
    expect(normalizePassengerCount(-4)).toBe(1);
  });

  it('validates traveller name, age and gender', () => {
    expect(
      isTravellerDraftValid({
        fullName: '',
        age: null,
        gender: ''
      })
    ).toBe(false);

    expect(
      isTravellerDraftValid({
        fullName: 'Asha Singh',
        age: 29,
        gender: 'FEMALE'
      })
    ).toBe(true);
  });
});
