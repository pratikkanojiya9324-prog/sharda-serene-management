import {
  closesAtForDays,
  closesLabel,
  parseOptions,
  parseResults,
  pollIsOpen,
  resultBars,
  selectionError,
  turnoutText,
} from './polls';

const now = new Date('2026-11-23T10:00:00Z');
const at = (ms: number) => new Date(now.getTime() + ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('pollIsOpen', () => {
  it('is closed once closed_at is set', () => {
    expect(pollIsOpen({ closes_at: at(DAY), closed_at: at(-MIN) }, now)).toBe(false);
  });
  it('is closed when closes_at has passed', () => {
    expect(pollIsOpen({ closes_at: at(-MIN), closed_at: null }, now)).toBe(false);
    expect(pollIsOpen({ closes_at: now.toISOString(), closed_at: null }, now)).toBe(false);
  });
  it('is open before closes_at', () => {
    expect(pollIsOpen({ closes_at: at(MIN), closed_at: null }, now)).toBe(true);
  });
});

describe('closesLabel', () => {
  const label = (ms: number, closed_at: string | null = null) => closesLabel({ closes_at: at(ms), closed_at }, now);
  it('counts days, hours and minutes', () => {
    expect(label(3 * DAY + 2 * HOUR)).toBe('Closes in 3 days');
    expect(label(DAY)).toBe('Closes in 1 day');
    expect(label(5 * HOUR + 10 * MIN)).toBe('Closes in 5 hours');
    expect(label(20 * MIN + 30_000)).toBe('Closes in 20 min');
    expect(label(10_000)).toBe('Closes in 1 min');
  });
  it('says Closed when over', () => {
    expect(label(-MIN)).toBe('Closed');
    expect(label(DAY, at(-MIN))).toBe('Closed');
  });
});

describe('selectionError', () => {
  it('needs a choice', () => {
    expect(selectionError({ multi: false, max_choices: 1 }, [])).toBe('Choose an option');
  });
  it('limits multi choice', () => {
    expect(selectionError({ multi: true, max_choices: 2 }, ['a', 'b', 'c'])).toBe('You can pick up to 2');
  });
  it('accepts a valid choice', () => {
    expect(selectionError({ multi: true, max_choices: 2 }, ['a', 'b'])).toBeNull();
    expect(selectionError({ multi: false, max_choices: 1 }, ['a'])).toBeNull();
  });
});

describe('resultBars', () => {
  const options = [
    { id: 'a', label: 'Yes' },
    { id: 'b', label: 'No' },
  ];
  it('is all zero without counts', () => {
    expect(resultBars(options, null, [])).toEqual([
      { id: 'a', label: 'Yes', count: 0, pct: 0, mine: false },
      { id: 'b', label: 'No', count: 0, pct: 0, mine: false },
    ]);
  });
  it('computes whole-number percentages and flags mine', () => {
    expect(resultBars(options, { a: 3, b: 1 }, ['a'])).toEqual([
      { id: 'a', label: 'Yes', count: 3, pct: 75, mine: true },
      { id: 'b', label: 'No', count: 1, pct: 25, mine: false },
    ]);
  });
  it('is 0 when nobody voted', () => {
    expect(resultBars(options, { a: 0, b: 0 }, []).map((b) => b.pct)).toEqual([0, 0]);
  });
});

describe('turnoutText', () => {
  it('formats turnout', () => {
    expect(turnoutText(12, 40)).toBe('12 of 40 flats voted (30%)');
    expect(turnoutText(0, 0)).toBe('0 of 0 flats voted (0%)');
  });
});

describe('closesAtForDays', () => {
  it('closes at 9 PM IST that many days from today (IST)', () => {
    // 2026-11-23 10:00Z is 15:30 IST on the 23rd
    expect(closesAtForDays(7, now).toISOString()).toBe('2026-11-30T15:30:00.000Z');
  });
  it('uses the IST date, not the UTC date', () => {
    // 2026-11-23 20:00Z is already 01:30 IST on the 24th
    expect(closesAtForDays(1, new Date('2026-11-23T20:00:00Z')).toISOString()).toBe('2026-11-25T15:30:00.000Z');
  });
});

describe('parsers', () => {
  it('parseOptions drops malformed entries', () => {
    expect(parseOptions([{ id: 'a', label: 'Yes' }, { id: 1 }, null])).toEqual([{ id: 'a', label: 'Yes' }]);
    expect(parseOptions('x')).toEqual([]);
  });
  it('parseResults reads the RPC json', () => {
    expect(
      parseResults({
        counts: { a: 2 },
        voted_flats: 2,
        total_flats: 5,
        my_vote: { option_ids: ['a'], voted_by_name: 'Asha', voted_at: '2026-11-23T10:00:00Z' },
        not_voted: ['B1-A-101'],
        is_open: true,
      }),
    ).toEqual({
      counts: { a: 2 },
      votedFlats: 2,
      totalFlats: 5,
      myVote: { optionIds: ['a'], by: 'Asha', at: '2026-11-23T10:00:00Z' },
      notVoted: ['B1-A-101'],
      isOpen: true,
    });
    expect(parseResults(null)).toBeNull();
  });
});
