import { attendanceSummary, helperTypeIcon, helperTypeLabel, insideNow, rowsOnDay } from './helpers';

const d = (y: number, m: number, day: number, h = 9, min = 0) => new Date(y, m - 1, day, h, min).toISOString();

describe('attendanceSummary', () => {
  const monthStart = new Date(2026, 10, 1);

  it('counts two entries on the same day as one day', () => {
    const rows = [
      { entry_at: d(2026, 11, 5, 8), exit_at: d(2026, 11, 5, 9) },
      { entry_at: d(2026, 11, 5, 17), exit_at: null },
      { entry_at: d(2026, 11, 6, 8), exit_at: d(2026, 11, 6, 9) },
    ];
    expect(attendanceSummary(rows, monthStart).daysPresent).toBe(2);
  });

  it('excludes entries from other months and reports the latest entry', () => {
    const rows = [
      { entry_at: d(2026, 10, 31, 23, 30), exit_at: null },
      { entry_at: d(2026, 11, 3, 8), exit_at: null },
      { entry_at: d(2026, 11, 9, 8), exit_at: null },
      { entry_at: d(2026, 12, 1, 8), exit_at: null },
    ];
    expect(attendanceSummary(rows, monthStart)).toEqual({ daysPresent: 2, lastEntry: d(2026, 11, 9, 8) });
  });

  it('is empty without rows', () => {
    expect(attendanceSummary([], monthStart)).toEqual({ daysPresent: 0, lastEntry: null });
  });
});

describe('insideNow', () => {
  it('is true only when a row has no exit', () => {
    expect(insideNow([{ entry_at: d(2026, 11, 5), exit_at: d(2026, 11, 5, 10) }])).toBe(false);
    expect(insideNow([{ entry_at: d(2026, 11, 5), exit_at: d(2026, 11, 5, 10) }, { entry_at: d(2026, 11, 5, 15), exit_at: null }])).toBe(true);
    expect(insideNow([])).toBe(false);
  });
});

describe('helper type', () => {
  it('has labels and icons for every type', () => {
    expect(helperTypeLabel('car_cleaner')).toBe('Car cleaner');
    expect(helperTypeLabel('maid')).toBe('Maid');
    expect(typeof helperTypeIcon('cook')).toBe('string');
  });
});

describe('rowsOnDay', () => {
  it('keeps only entries from that local day', () => {
    const rows = [
      { entry_at: d(2026, 11, 5, 8), exit_at: null },
      { entry_at: d(2026, 11, 6, 8), exit_at: null },
    ];
    expect(rowsOnDay(rows, new Date(2026, 10, 5, 22))).toHaveLength(1);
  });
});
