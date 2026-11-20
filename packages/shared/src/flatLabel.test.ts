import { describe, it, expect } from 'vitest';
import { flatLabel, flatEmail, staffEmail, isValidUsername } from './flatLabel';

describe('flatLabel', () => {
  it.each([
    ['Building 1', 'A', '101', 'B1-A-101'],
    ['Building 2', 'B', '704', 'B2-B-704'],
  ])('labels %s %s %s', (b, w, n, o) => expect(flatLabel(b, w, n)).toBe(o));
});

describe('synthetic emails', () => {
  it('builds flat email', () =>
    expect(flatEmail('abc-123')).toBe('flat-abc-123@login.societygate.app'));
  it('builds staff email', () =>
    expect(staffEmail('guard1', 'soc-1')).toBe('guard1@staff.soc-1.societygate.app'));
});

describe('isValidUsername', () => {
  it.each(['guard_1', 'admin', 'a.b-c', 'abc', 'a'.repeat(30)])('accepts %s', (u) =>
    expect(isValidUsername(u)).toBe(true));
  it.each(['Ab', 'ab', 'Guard1', 'has space', 'a'.repeat(31), '', 'bad!'])('rejects %s', (u) =>
    expect(isValidUsername(u)).toBe(false));
});
