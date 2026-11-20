import { describe, expect, it } from 'vitest';
import { normalizeBuilding, parseBillsCsv, parseMembersCsv, toCsv } from './csv';

describe('normalizeBuilding', () => {
  it('turns numbers and short forms into "Building <n>"', () => {
    expect(normalizeBuilding('1')).toBe('Building 1');
    expect(normalizeBuilding('B2')).toBe('Building 2');
    expect(normalizeBuilding('b 2')).toBe('Building 2');
    expect(normalizeBuilding('building   1')).toBe('Building 1');
    expect(normalizeBuilding('BUILDING1')).toBe('Building 1');
    expect(normalizeBuilding(' Building 12 ')).toBe('Building 12');
  });

  it('keeps other names, with whitespace collapsed', () => {
    expect(normalizeBuilding('  Rose   Tower ')).toBe('Rose Tower');
  });
});

describe('parseMembersCsv', () => {
  it('skips the header and blank lines and keeps line numbers', () => {
    const text = [
      'building,wing,flat,password,member_name,member_phone,relation',
      'Building 1,A,101,Secret1,Rahul Shah,9876543210,Self',
      '',
      'Building 1,A,101,,Priya Shah,,Spouse',
    ].join('\n');
    expect(parseMembersCsv(text)).toEqual([
      {
        line: 2,
        building: 'Building 1',
        wing: 'A',
        flat: '101',
        password: 'Secret1',
        member_name: 'Rahul Shah',
        member_phone: '9876543210',
        relation: 'Self',
      },
      {
        line: 4,
        building: 'Building 1',
        wing: 'A',
        flat: '101',
        password: '',
        member_name: 'Priya Shah',
        member_phone: '',
        relation: 'Spouse',
      },
    ]);
  });

  it('normalises building and upper-cases the wing', () => {
    const [row] = parseMembersCsv('b1, a ,101');
    expect(row).toMatchObject({ building: 'Building 1', wing: 'A', flat: '101', password: '', member_name: '' });
  });

  it('accepts quoted fields with commas and CRLF line endings', () => {
    const [row] = parseMembersCsv('2,B,704,,"Shah, Rahul",,"Son"\r\n');
    expect(row).toMatchObject({ building: 'Building 2', wing: 'B', flat: '704', member_name: 'Shah, Rahul', relation: 'Son' });
  });

  it('throws bad_row:<n> for missing building, wing or flat, or too many fields', () => {
    expect(() => parseMembersCsv('Building 1,A,101\nBuilding 1,,102')).toThrow('bad_row:2');
    expect(() => parseMembersCsv('Building 1,A')).toThrow('bad_row:1');
    expect(() => parseMembersCsv('header?\n1,A,101,p,n,1,r,extra')).toThrow('bad_row:1');
    expect(() => parseMembersCsv('1,A,101,p,n,1,r,extra')).toThrow('bad_row:1');
  });

  it('throws bad_row for an unterminated quote', () => {
    expect(() => parseMembersCsv('1,A,"101')).toThrow('bad_row:1');
  });
});

describe('parseBillsCsv', () => {
  it('parses building,wing,flat,amount rows and skips the header', () => {
    expect(parseBillsCsv('building,wing,flat,amount\n1,a,101,2500\nBuilding 2,B,704, 3000.50 ')).toEqual([
      { line: 2, building: 'Building 1', wing: 'A', flat: '101', amount: 2500 },
      { line: 3, building: 'Building 2', wing: 'B', flat: '704', amount: 3000.5 },
    ]);
  });

  it('throws bad_row:<n> for bad amounts or field counts', () => {
    expect(() => parseBillsCsv('1,A,101,abc')).toThrow('bad_row:1');
    expect(() => parseBillsCsv('1,A,101,2500\n1,A,102,0')).toThrow('bad_row:2');
    expect(() => parseBillsCsv('1,A,101,-5')).toThrow('bad_row:1');
    expect(() => parseBillsCsv('1,A,101')).toThrow('bad_row:1');
    expect(() => parseBillsCsv('1,A,101,100,extra')).toThrow('bad_row:1');
    expect(() => parseBillsCsv('1,,101,100')).toThrow('bad_row:1');
  });
});

describe('toCsv', () => {
  it('quotes fields that need it', () => {
    expect(toCsv([['a', 'b,c'], ['say "hi"', 'x']])).toBe('a,"b,c"\r\n"say ""hi""",x\r\n');
  });
});
