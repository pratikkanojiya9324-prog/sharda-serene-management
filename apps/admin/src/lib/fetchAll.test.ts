import { describe, expect, it } from 'vitest';
import { fetchAll } from './fetchAll';

/** Fake query: serves `total` numbered rows, never more than `cap` per request (like PostgREST max rows). */
function fakeTable(total: number, cap = 1000) {
  const calls: [number, number][] = [];
  const page = async (from: number, to: number) => {
    calls.push([from, to]);
    const end = Math.min(to + 1, from + cap, total);
    return { data: Array.from({ length: Math.max(0, end - from) }, (_, i) => from + i), error: null };
  };
  return { page, calls };
}

describe('fetchAll', () => {
  it('pages with range until a short page comes back', async () => {
    const t = fakeTable(2500);
    const { data, error } = await fetchAll(t.page, 1000);
    expect(error).toBeNull();
    expect(data).toHaveLength(2500);
    expect(data[2499]).toBe(2499);
    expect(t.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('asks once more when the last page is exactly full', async () => {
    const t = fakeTable(2000);
    const { data } = await fetchAll(t.page, 1000);
    expect(data).toHaveLength(2000);
    expect(t.calls).toHaveLength(3);
  });

  it('returns the first error and no rows', async () => {
    let n = 0;
    const { data, error } = await fetchAll(async () => {
      n++;
      return n === 1 ? { data: Array(10).fill(0), error: null } : { data: null, error: { message: 'boom' } };
    }, 10);
    expect(error).toEqual({ message: 'boom' });
    expect(data).toEqual([]);
  });
});
