import {
  bookingPill,
  dateChips,
  filterDirectory,
  groupDocuments,
  isUpcomingEvent,
  rsvpText,
  slotLabel,
  slotLengthText,
  timeText,
} from './community';

describe('dateChips', () => {
  const chips = dateChips(new Date('2026-11-23T20:00:00Z'));
  it('starts from the IST date with Today and Tomorrow', () => {
    expect(chips[0]).toEqual({ date: '2026-11-24', label: 'Today' });
    expect(chips[1]).toEqual({ date: '2026-11-25', label: 'Tomorrow' });
    expect(chips[2]).toEqual({ date: '2026-11-26', label: 'Thu 26' });
  });
  it('has 15 chips by default and crosses month ends', () => {
    expect(chips).toHaveLength(15);
    expect(chips[14]).toEqual({ date: '2026-12-08', label: 'Tue 8' });
  });
  it('honours days', () => expect(dateChips(new Date('2026-11-23T10:00:00Z'), 3)).toHaveLength(3));
});

describe('slotLabel', () => {
  it('shares the meridiem when both ends match', () => {
    expect(slotLabel('2026-11-23T12:30:00Z', '2026-11-23T13:30:00Z')).toBe('6:00 – 7:00 PM');
  });
  it('shows both meridiems when they differ', () => {
    expect(slotLabel('2026-11-23T06:00:00Z', '2026-11-23T07:00:00Z')).toBe('11:30 AM – 12:30 PM');
  });
  it('says Full day for 24 hours', () => {
    expect(slotLabel('2026-11-23T02:30:00Z', '2026-11-23T16:30:00Z', 1440)).toBe('Full day');
    expect(slotLabel('2026-11-22T18:30:00Z', '2026-11-23T18:30:00Z')).toBe('Full day');
  });
  it('shows a long window as a range', () => {
    expect(slotLabel('2026-11-23T02:30:00Z', '2026-11-23T16:30:00Z')).toBe('8:00 AM – 10:00 PM');
  });
});

describe('bookingPill', () => {
  it.each([
    ['pending', 'Waiting for approval', 'warning'],
    ['confirmed', 'Confirmed', 'success'],
    ['rejected', 'Rejected', 'danger'],
    ['cancelled', 'Cancelled', 'neutral'],
  ] as const)('%s', (status, label, tone) => {
    expect(bookingPill(status)).toEqual({ label, tone });
  });
});

describe('rsvpText', () => {
  it('pluralises', () => {
    expect(rsvpText({ going_flats: 12, going_heads: 31 })).toBe('12 flats going · 31 people');
  });
  it('uses singular', () => {
    expect(rsvpText({ going_flats: 1, going_heads: 1 })).toBe('1 flat going · 1 person');
  });
  it('handles none', () => {
    expect(rsvpText({ going_flats: 0, going_heads: 0 })).toBe('0 flats going · 0 people');
  });
});

describe('filterDirectory', () => {
  const rows = [
    { name: 'Asha Rao', flat_label: 'B1-A-101' },
    { name: 'Vikram', flat_label: 'B2-B-704' },
  ];
  it('matches name or flat label, case-insensitively', () => {
    expect(filterDirectory(rows, 'asha')).toEqual([rows[0]]);
    expect(filterDirectory(rows, 'b2-b')).toEqual([rows[1]]);
  });
  it('returns everything for a blank query', () => {
    expect(filterDirectory(rows, '  ')).toEqual(rows);
  });
});

describe('groupDocuments', () => {
  it('orders groups and drops empty ones', () => {
    const docs = [
      { id: 1, category: 'other' as const },
      { id: 2, category: 'bylaws' as const },
      { id: 3, category: 'other' as const },
      { id: 4, category: 'form' as const },
    ];
    const groups = groupDocuments(docs);
    expect(groups.map((g) => g.category)).toEqual(['bylaws', 'form', 'other']);
    expect(groups.map((g) => g.label)).toEqual(['Bylaws', 'Forms', 'Other']);
    expect(groups[2].items.map((d) => d.id)).toEqual([1, 3]);
  });
});

describe('timeText / slotLengthText', () => {
  it('formats times of day', () => {
    expect(timeText('06:00:00')).toBe('6:00 AM');
    expect(timeText('22:30:00')).toBe('10:30 PM');
    expect(timeText('00:00:00')).toBe('12:00 AM');
  });
  it('describes slot lengths', () => {
    expect(slotLengthText(30)).toBe('30 min slots');
    expect(slotLengthText(120)).toBe('2 hr slots');
    expect(slotLengthText(1440)).toBe('Full day');
  });
});

describe('isUpcomingEvent', () => {
  const now = new Date('2026-11-23T10:00:00Z');
  const e = (starts_at: string, ends_at: string | null = null, cancelled_at: string | null = null) => ({ starts_at, ends_at, cancelled_at });
  it('is upcoming before start, or before the end when there is one', () => {
    expect(isUpcomingEvent(e('2026-11-24T10:00:00Z'), now)).toBe(true);
    expect(isUpcomingEvent(e('2026-11-23T09:00:00Z', '2026-11-23T11:00:00Z'), now)).toBe(true);
  });
  it('is over after it ends, and never when cancelled', () => {
    expect(isUpcomingEvent(e('2026-11-23T09:00:00Z'), now)).toBe(false);
    expect(isUpcomingEvent(e('2026-11-24T10:00:00Z', null, '2026-11-23T00:00:00Z'), now)).toBe(false);
  });
});
