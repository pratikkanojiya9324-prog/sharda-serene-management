import { helperAction, matchHelpers } from './guardHelpers';

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
  it('blocks inactive helpers', () => {
    expect(helperAction({ active: false }, false)).toBe('blocked');
  });
  it('checks in when outside', () => {
    expect(helperAction({ active: true }, false)).toBe('check_in');
  });
  it('checks out when inside', () => {
    expect(helperAction({ active: true }, true)).toBe('check_out');
  });
});
