import { filterFlats, naturalCompare } from './flatPicker';

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

describe('filterFlats', () => {
  const flats = [{ number: 'A-110' }, { number: 'A-101' }, { number: 'A-12' }, { number: 'B-101' }];

  it('returns everything, naturally sorted, for an empty query', () => {
    expect(filterFlats(flats, '').map((f) => f.number)).toEqual(['A-12', 'A-101', 'A-110', 'B-101']);
  });

  it('matches digits anywhere in the number', () => {
    expect(filterFlats(flats, '101').map((f) => f.number)).toEqual(['A-101', 'B-101']);
  });

  it('ignores case, spaces and dashes', () => {
    expect(filterFlats(flats, 'b 101').map((f) => f.number)).toEqual(['B-101']);
    expect(filterFlats(flats, 'a1').map((f) => f.number)).toEqual(['A-12', 'A-101', 'A-110']);
  });

  it('does not mutate the input', () => {
    const copy = [...flats];
    filterFlats(flats, '');
    expect(flats).toEqual(copy);
  });
});
