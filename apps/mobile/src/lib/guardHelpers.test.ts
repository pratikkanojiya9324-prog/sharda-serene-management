import { exactHelper, helperAction, matchHelpers } from './guardHelpers';

const list = [
  { name: 'Sunita Devi', entry_code: '123456' },
  { name: 'Ramesh', entry_code: '123999' },
  { name: 'Anita', entry_code: '987654' },
];

describe('matchHelpers', () => {
  it('matches a digit query as a code prefix', () => {
    expect(matchHelpers(list, '123').map((h) => h.name)).toEqual(['Sunita Devi', 'Ramesh']);
    expect(matchHelpers(list, '123456').map((h) => h.name)).toEqual(['Sunita Devi']);
  });
  it('matches names case-insensitively by contains', () => {
    expect(matchHelpers(list, 'NITA').map((h) => h.name)).toEqual(['Sunita Devi', 'Anita']);
  });
  it('returns everyone for an empty query', () => {
    expect(matchHelpers(list, '  ')).toHaveLength(3);
  });
});

describe('helperAction', () => {
  const on = { active: true, flatCount: 1 };
  it('blocks inactive helpers', () => {
    expect(helperAction({ active: false, flatCount: 1 }, false)).toBe('blocked');
  });
  it('lets a blocked helper who is still inside check out', () => {
    expect(helperAction({ active: false, flatCount: 1 }, true)).toBe('check_out');
  });
  it('checks in when outside', () => {
    expect(helperAction(on, false)).toBe('check_in');
  });
  it('checks out when inside', () => {
    expect(helperAction(on, true)).toBe('check_out');
  });
  it('is unlinked when no flat employs the helper', () => {
    expect(helperAction({ active: true, flatCount: 0 }, false)).toBe('unlinked');
  });
  it('still checks out an unlinked helper who is inside', () => {
    expect(helperAction({ active: true, flatCount: 0 }, true)).toBe('check_out');
  });
  it('blocked wins over unlinked', () => {
    expect(helperAction({ active: false, flatCount: 0 }, false)).toBe('blocked');
  });
});

describe('exactHelper', () => {
  const h = (name: string, entry_code: string, active: boolean) => ({ name, entry_code, active });
  it('is the single match for a full 6-digit code', () => {
    expect(exactHelper([h('A', '123456', true)], '123456')?.name).toBe('A');
  });
  it('prefers the active helper when a reissued code matches several', () => {
    const list = [h('Old', '123456', false), h('New', '123456', true)];
    expect(exactHelper(list, '123456')?.name).toBe('New');
  });
  it('is null when several active helpers match, or for a partial code', () => {
    expect(exactHelper([h('A', '123456', true), h('B', '123456', true)], '123456')).toBeNull();
    expect(exactHelper([h('A', '123456', true)], '123')).toBeNull();
  });
});
