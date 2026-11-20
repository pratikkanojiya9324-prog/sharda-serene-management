import { describe, it, expect } from 'vitest';
import { normalizePhone } from './phone';

describe('normalizePhone', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['+91 98765-43210', '+919876543210'],
    ['919876543210', '+919876543210'],
  ])('normalizes %s', (i, o) => expect(normalizePhone(i)).toBe(o));

  it.each(['12345', '5876543210', 'abc', ''])('rejects %s', (i) =>
    expect(() => normalizePhone(i)).toThrow('invalid_phone')); // Indian mobiles start 6-9
});
