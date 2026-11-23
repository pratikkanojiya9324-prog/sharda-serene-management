import { describe, expect, it } from 'vitest';
import { defaultClosesAt, resultRows, turnoutText } from './polls';

const options = [
  { id: 'a', label: 'Yes' },
  { id: 'b', label: 'No' },
];

describe('resultRows', () => {
  it('shows zeros when counts are hidden', () => {
    expect(resultRows(options, null, 0)).toEqual([
      { label: 'Yes', count: 0, pct: 0 },
      { label: 'No', count: 0, pct: 0 },
    ]);
  });
  it('computes the share of voting flats', () => {
    expect(resultRows(options, { a: 3, b: 1 }, 4)).toEqual([
      { label: 'Yes', count: 3, pct: 75 },
      { label: 'No', count: 1, pct: 25 },
    ]);
  });
  it('treats a missing count as 0 and rounds', () => {
    expect(resultRows(options, { a: 1 }, 3)).toEqual([
      { label: 'Yes', count: 1, pct: 33 },
      { label: 'No', count: 0, pct: 0 },
    ]);
  });
});

describe('turnoutText', () => {
  it('matches the mobile copy', () => {
    expect(turnoutText(12, 40)).toBe('12 of 40 flats voted (30%)');
    expect(turnoutText(0, 0)).toBe('0 of 0 flats voted (0%)');
  });
});

describe('defaultClosesAt', () => {
  it('is 7 days ahead at 21:00 IST', () => {
    expect(defaultClosesAt(new Date('2026-11-23T10:00:00Z'))).toBe('2026-11-30T21:00');
  });
  it('uses the IST date, not the UTC date', () => {
    // 20:00 UTC on 23 Nov is already 24 Nov in IST.
    expect(defaultClosesAt(new Date('2026-11-23T20:00:00Z'))).toBe('2026-12-01T21:00');
  });
});
