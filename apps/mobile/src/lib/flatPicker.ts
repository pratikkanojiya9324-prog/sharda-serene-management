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

/** A flat row as read with FLAT_DIRECTORY_SELECT: towers.building = "Building 1", towers.name = wing. */
export type DirectoryRow = { id: string; number: string; towers: { building: string; name: string } | null };

export type FlatTree = { building: string; wings: { wing: string; flats: { id: string; number: string }[] }[] }[];

/**
 * Building → Wing → Flat for the guard's pickers, each level in natural order
 * ("Building 2" before "Building 10", 12 before 101). Flats without a
 * building/wing are left out.
 */
export function groupFlats(rows: readonly DirectoryRow[]): FlatTree {
  const buildings = new Map<string, Map<string, { id: string; number: string }[]>>();
  for (const r of rows) {
    if (!r.towers) continue;
    const wings = buildings.get(r.towers.building) ?? new Map();
    buildings.set(r.towers.building, wings);
    const flats = wings.get(r.towers.name) ?? [];
    wings.set(r.towers.name, flats);
    flats.push({ id: r.id, number: r.number });
  }
  return [...buildings.entries()]
    .sort(([a], [b]) => naturalCompare(a, b))
    .map(([building, wings]) => ({
      building,
      wings: [...wings.entries()]
        .sort(([a], [b]) => naturalCompare(a, b))
        .map(([wing, flats]) => ({ wing, flats: flats.sort((a, b) => naturalCompare(a.number, b.number)) })),
    }));
}
