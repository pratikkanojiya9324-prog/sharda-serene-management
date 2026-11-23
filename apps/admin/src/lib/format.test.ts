import { describe, expect, it } from 'vitest';
import { dateTime, istDate } from './format';

describe('IST display', () => {
  it('shows a UTC instant in Asia/Kolkata whatever the browser zone', () => {
    // 19:00 UTC on 30 Nov is 12:30 AM on 1 Dec in IST.
    expect(dateTime('2026-11-30T19:00:00Z')).toMatch(/^1 Dec,? 12:30 am$/i);
    expect(istDate('2026-11-30T19:00:00Z')).toBe('1 Dec 2026');
  });
});
