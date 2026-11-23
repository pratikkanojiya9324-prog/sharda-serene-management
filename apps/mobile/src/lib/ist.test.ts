import { IST_OFFSET_MS, formatIst, istDateKey, istDayStart } from './ist';

describe('formatIst', () => {
  it('formats like Sat 28 Nov, 9:00 PM', () => {
    expect(formatIst('2026-11-28T15:30:00Z')).toBe('Sat 28 Nov, 9:00 PM');
  });
  it('shows 12 AM / 12 PM', () => {
    expect(formatIst('2026-11-28T18:30:00Z')).toBe('Sun 29 Nov, 12:00 AM');
    expect(formatIst('2026-11-28T06:30:00Z')).toBe('Sat 28 Nov, 12:00 PM');
  });
});

describe('istDateKey', () => {
  it('uses the IST calendar date, not the UTC one', () => {
    expect(istDateKey(new Date('2026-11-23T20:00:00Z'))).toBe('2026-11-24');
    expect(istDateKey(new Date('2026-11-23T10:00:00Z'))).toBe('2026-11-23');
  });
});

describe('istDayStart', () => {
  it('is midnight IST of the given date key', () => {
    expect(istDayStart('2026-11-24').toISOString()).toBe('2026-11-23T18:30:00.000Z');
  });
  it('offset is 5h30', () => expect(IST_OFFSET_MS).toBe(19_800_000));
});
