import { groupFlats, naturalCompare } from './flatPicker';

const sorted = (xs: string[]) => [...xs].sort(naturalCompare);

describe('naturalCompare', () => {
  it('orders numbers by value, not text', () => {
    expect(sorted(['101', '1001', '11', '2', '110'])).toEqual(['2', '11', '101', '110', '1001']);
  });

  it('orders tower-prefixed numbers naturally', () => {
    expect(sorted(['A-110', 'A-12', 'B-1', 'A-101', 'A-2'])).toEqual(['A-2', 'A-12', 'A-101', 'A-110', 'B-1']);
  });

  it('ignores case and treats equal strings as equal', () => {
    expect(naturalCompare('a-1', 'A-1')).toBe(0);
    expect(naturalCompare('G1', 'g2')).toBeLessThan(0);
  });

  it('puts a shorter prefix first', () => {
    expect(sorted(['101A', '101'])).toEqual(['101', '101A']);
  });
});

describe('groupFlats', () => {
  const row = (id: string, building: string, wing: string, number: string) => ({
    id,
    number,
    towers: { building, name: wing },
  });
  const rows = [
    row('f1', 'Building 2', 'A', '101'),
    row('f2', 'Building 1', 'B', '102'),
    row('f3', 'Building 1', 'A', '110'),
    row('f4', 'Building 1', 'A', '12'),
    row('f5', 'Building 10', 'A', '101'),
    row('f6', 'Building 1', 'A', '101'),
    { id: 'orphan', number: '999', towers: null },
  ];

  it('groups flats by building, then wing, all in natural order', () => {
    expect(groupFlats(rows)).toEqual([
      {
        building: 'Building 1',
        wings: [
          {
            wing: 'A',
            flats: [
              { id: 'f4', number: '12' },
              { id: 'f6', number: '101' },
              { id: 'f3', number: '110' },
            ],
          },
          { wing: 'B', flats: [{ id: 'f2', number: '102' }] },
        ],
      },
      { building: 'Building 2', wings: [{ wing: 'A', flats: [{ id: 'f1', number: '101' }] }] },
      { building: 'Building 10', wings: [{ wing: 'A', flats: [{ id: 'f5', number: '101' }] }] },
    ]);
  });

  it('skips flats without a building/wing and returns [] for no flats', () => {
    expect(groupFlats([{ id: 'x', number: '1', towers: null }])).toEqual([]);
    expect(groupFlats([])).toEqual([]);
  });
});
