import { describe, expect, it } from 'vitest';
import { bookingTab, formatSlot, sosDuration } from './community';

describe('formatSlot', () => {
  it('formats an evening slot in IST', () => {
    // 12:30-14:30 UTC = 18:00-20:00 IST
    expect(formatSlot('2026-11-30T12:30:00Z', '2026-11-30T14:30:00Z')).toBe('Mon 30 Nov · 6:00 – 8:00 PM');
  });
  it('keeps both meridiems when the slot crosses noon', () => {
    expect(formatSlot('2026-11-30T05:30:00Z', '2026-11-30T07:30:00Z')).toBe('Mon 30 Nov · 11:00 AM – 1:00 PM');
  });
  it('uses the IST date, not the UTC date', () => {
    // 19:00 UTC on 30 Nov is 00:30 on 1 Dec in IST
    expect(formatSlot('2026-11-30T19:00:00Z', '2026-11-30T20:00:00Z')).toBe('Tue 1 Dec · 12:30 – 1:30 AM');
  });
  it('shows a full-day booking as open to close', () => {
    // party hall 9:00-23:00 IST: end_at is the close time, not start + 24 h
    expect(formatSlot('2026-11-30T03:30:00Z', '2026-11-30T17:30:00Z')).toBe('Mon 30 Nov · 9:00 AM – 11:00 PM');
  });
  it('names both days for a slot spanning midnight', () => {
    expect(formatSlot('2026-11-29T18:30:00Z', '2026-11-30T18:30:00Z')).toBe('Mon 30 Nov, 12:00 AM – Tue 1 Dec, 12:00 AM');
  });
});

describe('bookingTab', () => {
  const now = new Date('2026-11-30T10:00:00Z');
  const rows = [
    { id: 'p-future', status: 'pending', end_at: '2026-12-01T10:00:00Z' },
    { id: 'p-ended', status: 'pending', end_at: '2026-11-30T09:00:00Z' },
    { id: 'c-future', status: 'confirmed', end_at: '2026-11-30T11:00:00Z' },
    { id: 'c-ended', status: 'confirmed', end_at: '2026-11-30T10:00:00Z' },
    { id: 'rej', status: 'rejected', end_at: '2026-12-05T10:00:00Z' },
    { id: 'can', status: 'cancelled', end_at: '2026-12-05T10:00:00Z' },
  ];
  const ids = (tab: 'pending' | 'upcoming' | 'past') => bookingTab(rows, tab, now).map((r) => r.id);

  it('pending is status pending and not ended', () => expect(ids('pending')).toEqual(['p-future']));
  it('upcoming is confirmed and ends after now', () => expect(ids('upcoming')).toEqual(['c-future']));
  it('past is everything else', () => expect(ids('past')).toEqual(['p-ended', 'c-ended', 'rej', 'can']));
});

describe('sosDuration', () => {
  const now = new Date('2026-11-30T10:03:00Z');
  it('shows minutes for a resolved alert', () => {
    expect(sosDuration('2026-11-30T09:00:00Z', '2026-11-30T09:12:00Z', now)).toBe('12 min');
  });
  it('shows hours and minutes', () => {
    expect(sosDuration('2026-11-30T09:00:00Z', '2026-11-30T10:05:00Z', now)).toBe('1 h 5 min');
    expect(sosDuration('2026-11-30T08:00:00Z', '2026-11-30T10:00:00Z', now)).toBe('2 h');
  });
  it('says ongoing while unresolved', () => {
    expect(sosDuration('2026-11-30T10:00:00Z', null, now)).toBe('ongoing 3 min');
  });
});
