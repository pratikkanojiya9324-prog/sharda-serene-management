import { FLAT_DIRECTORY_SELECT, flatLabel } from '@society-gate/shared';

import { fetchAll } from './fetchAll';
import type { DirectoryRow } from './flatPicker';
import { supabase } from './supabase';

/** Every flat of the society with its building + wing (staff read; paged past the row cap). */
export async function loadFlatDirectory(
  societyId: string,
): Promise<{ data: DirectoryRow[]; error: { message: string } | null }> {
  return fetchAll((from, to) =>
    supabase.from('flats').select(FLAT_DIRECTORY_SELECT).eq('society_id', societyId).order('id').range(from, to),
  );
}

/** flat id → "B1-A-101" */
export function flatLabels(rows: readonly DirectoryRow[]): Map<string, string> {
  return new Map(rows.map((r) => [r.id, r.towers ? flatLabel(r.towers.building, r.towers.name, r.number) : r.number]));
}
