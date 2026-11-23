import { describe, expect, it } from 'vitest';
import { istLocalToIso } from './ist';

describe('istLocalToIso', () => {
  it('reads a datetime-local value as IST', () => {
    expect(istLocalToIso('2026-11-30T21:00')).toBe('2026-11-30T15:30:00.000Z');
  });
  it('returns null for empty or invalid values', () => {
    expect(istLocalToIso('')).toBeNull();
    expect(istLocalToIso('nonsense')).toBeNull();
  });
});
