import { formatDate, formatPeriod, formatPhone, formatRupees, localDateString, timeAgo } from './format';

describe('formatRupees', () => {
  it('formats whole rupees with a rupee sign and separators', () => {
    expect(formatRupees(2500)).toBe('₹2,500');
  });

  it.each([
    [0, '₹0'],
    [999, '₹999'],
    [100000, '₹1,00,000'],
    [1234567, '₹12,34,567'],
    [2500.5, '₹2,500.50'],
    [-1500, '-₹1,500'],
  ])('%p -> %p (Indian grouping, paise only when present)', (n, out) => {
    expect(formatRupees(n)).toBe(out);
  });
});

describe('dates', () => {
  it('names a bill period by month', () => {
    expect(formatPeriod('2026-11-01')).toBe('November 2026');
  });

  it('formats a date-only value without timezone drift', () => {
    expect(formatDate('2026-11-05')).toBe('5 Nov 2026');
  });

  it('formats a timestamp in local time', () => {
    expect(formatDate(new Date(2026, 0, 31, 23, 30).toISOString())).toBe('31 Jan 2026');
  });

  it('gives the local calendar date', () => {
    expect(localDateString(new Date(2026, 1, 3, 23, 59))).toBe('2026-02-03');
  });
});

describe('timeAgo', () => {
  const now = new Date(2026, 10, 20, 12, 0);
  it.each([
    [new Date(2026, 10, 20, 11, 59, 40), 'Just now'],
    [new Date(2026, 10, 20, 11, 15), '45 min ago'],
    [new Date(2026, 10, 20, 9, 0), '3 h ago'],
    [new Date(2026, 10, 19, 12, 0), 'Yesterday'],
    [new Date(2026, 10, 16, 12, 0), '4 days ago'],
    [new Date(2026, 9, 1, 12, 0), '1 Oct 2026'],
  ])('%p -> %p', (d, out) => {
    expect(timeAgo(d.toISOString(), now)).toBe(out);
  });
});

describe('formatPhone', () => {
  it('spaces an Indian E.164 number', () => {
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
  });

  it('leaves anything else as it is', () => {
    expect(formatPhone('022 2345 6789')).toBe('022 2345 6789');
    expect(formatPhone('+14155550100')).toBe('+14155550100');
  });
});
