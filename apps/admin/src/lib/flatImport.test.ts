import { describe, expect, it } from 'vitest';
import type { MemberRow } from './csv';
import { chunkByFlat, generatedPasswords, mergeResults } from './flatImport';

const row = (line: number, building: string, wing: string, flat: string, extra: Partial<MemberRow> = {}): MemberRow => ({
  line,
  building,
  wing,
  flat,
  password: '',
  member_name: '',
  member_phone: '',
  relation: '',
  ...extra,
});

describe('chunkByFlat', () => {
  it('keeps all rows of one flat in the same chunk, even when they are not adjacent', () => {
    const rows = [row(2, 'Building 1', 'A', '101'), row(3, 'Building 1', 'A', '102'), row(4, 'Building 1', 'A', '101')];
    const chunks = chunkByFlat(rows, 2);
    expect(chunks.map((c) => c.map((r) => r.line))).toEqual([[2, 4], [3]]);
  });

  it('packs flats into chunks of at most max rows', () => {
    const rows = Array.from({ length: 450 }, (_, i) => row(i + 2, 'Building 1', 'A', String(100 + i)));
    const chunks = chunkByFlat(rows, 200);
    expect(chunks.map((c) => c.length)).toEqual([200, 200, 50]);
  });

  it('starts a new chunk rather than splitting a flat', () => {
    const rows = [
      row(2, 'Building 1', 'A', '101'),
      row(3, 'Building 1', 'A', '102'),
      row(4, 'Building 1', 'A', '102'),
    ];
    expect(chunkByFlat(rows, 2).map((c) => c.map((r) => r.line))).toEqual([[2], [3, 4]]);
  });

  it('throws when one flat has more rows than fit in a chunk', () => {
    const rows = [row(2, 'Building 1', 'A', '101'), row(3, 'Building 1', 'A', '101'), row(4, 'Building 1', 'A', '101')];
    expect(() => chunkByFlat(rows, 2)).toThrow('flat_too_many_rows:Building 1 A 101');
  });
});

describe('mergeResults', () => {
  it('maps chunk-relative row numbers back to CSV lines', () => {
    const chunks = [[row(2, 'Building 1', 'A', '101'), row(5, 'Building 1', 'A', '101')], [row(3, 'Building 1', 'B', '201')]];
    const merged = mergeResults(chunks, [
      { results: [{ row: 1, ok: true, generated_password: 'abcdEFGH' }, { row: 2, ok: true }] },
      { results: [{ row: 1, ok: false, error: 'flat must be 1-10 letters' }] },
    ]);
    expect(merged).toEqual([
      { line: 2, building: 'Building 1', wing: 'A', flat: '101', ok: true, error: undefined, generatedPassword: 'abcdEFGH' },
      { line: 3, building: 'Building 1', wing: 'B', flat: '201', ok: false, error: 'flat must be 1-10 letters', generatedPassword: undefined },
      { line: 5, building: 'Building 1', wing: 'A', flat: '101', ok: true, error: undefined, generatedPassword: undefined },
    ]);
  });

  it('marks every row of a chunk failed when its call failed', () => {
    const chunks = [[row(2, 'Building 1', 'A', '101')]];
    expect(mergeResults(chunks, [{ error: 'network down' }])).toEqual([
      { line: 2, building: 'Building 1', wing: 'A', flat: '101', ok: false, error: 'network down', generatedPassword: undefined },
    ]);
  });
});

describe('generatedPasswords', () => {
  it('lists only rows with a generated password', () => {
    const list = generatedPasswords([
      { line: 2, building: 'Building 1', wing: 'A', flat: '101', ok: true, generatedPassword: 'abcdEFGH' },
      { line: 3, building: 'Building 1', wing: 'A', flat: '102', ok: true },
    ]);
    expect(list).toEqual([['building', 'wing', 'flat', 'password'], ['Building 1', 'A', '101', 'abcdEFGH']]);
  });
});
