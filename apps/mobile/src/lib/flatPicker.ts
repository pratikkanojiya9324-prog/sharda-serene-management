/**
 * Natural ("human") order: digit runs compare as numbers, so A-2 < A-10 < A-101.
 * Letters compare case-insensitively.
 */
export function naturalCompare(a: string, b: string): number {
  const re = /(\d+)|(\D+)/g;
  const pa = a.toLowerCase().match(re) ?? [];
  const pb = b.toLowerCase().match(re) ?? [];
  for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
    const x = pa[i];
    const y = pb[i];
    if (x === y) continue;
    const nx = /^\d/.test(x);
    const ny = /^\d/.test(y);
    if (nx && ny) {
      const diff = Number(x) - Number(y);
      if (diff !== 0) return diff;
      // equal value, different zero padding: shorter first
      if (x.length !== y.length) return x.length - y.length;
    } else if (nx !== ny) {
      return nx ? -1 : 1; // digits before letters
    } else {
      return x < y ? -1 : 1;
    }
  }
  return pa.length - pb.length;
}

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Flats whose number contains what the guard typed (ignoring case, spaces and
 * dashes, so "a101" finds "A-101"), in natural order.
 */
export function filterFlats<T extends { number: string }>(flats: T[], query: string): T[] {
  const q = normalize(query);
  return flats.filter((f) => normalize(f.number).includes(q)).sort((a, b) => naturalCompare(a.number, b.number));
}
