import { describe, expect, it } from 'vitest';
import { parseFlatsCsv } from './csv';

describe('parseFlatsCsv', () => {
  it('skips header and blank lines', () => {
    expect(parseFlatsCsv('tower,flat\nA,101\nA,102\n\nB,201')).toEqual([
      { tower: 'A', flat: '101' },
      { tower: 'A', flat: '102' },
      { tower: 'B', flat: '201' },
    ]);
  });

  it('trims whitespace', () => {
    expect(parseFlatsCsv('  A , 101 \r\n')).toEqual([{ tower: 'A', flat: '101' }]);
  });

  it('throws bad_row with the line number', () => {
    expect(() => parseFlatsCsv('A,101\nA')).toThrow('bad_row:2');
    expect(() => parseFlatsCsv('A,1,2')).toThrow('bad_row:1');
  });
});
