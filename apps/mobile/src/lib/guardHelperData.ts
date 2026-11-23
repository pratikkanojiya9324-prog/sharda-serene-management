import { flatLabel, HELPER_GUARD_SELECT, type HelperType } from '@society-gate/shared';

import { supabase } from './supabase';

export type GuardHelper = {
  id: string;
  name: string;
  phone: string;
  type: HelperType;
  photo_path: string | null;
  entry_code: string;
  active: boolean;
  helper_flats: { flat_id: string; flats: { number: string; towers: { building: string; name: string } | null } | null }[];
  /** Only open rows (exit_at is null) are fetched, so non-empty means inside. */
  helper_attendance: { id: string; entry_at: string; exit_at: string | null }[];
};

export const isInside = (h: GuardHelper) => h.helper_attendance.some((a) => a.exit_at === null);

export function helperFlatLabels(h: GuardHelper): string {
  const labels = h.helper_flats.map((l) =>
    l.flats ? (l.flats.towers ? flatLabel(l.flats.towers.building, l.flats.towers.name, l.flats.number) : l.flats.number) : '—',
  );
  return labels.length ? labels.join(', ') : 'No flat linked';
}

/**
 * Helpers of the guard's society. The attendance embed is limited to open rows
 * so the list stays small; `onlyInside` also drops helpers without one.
 */
export async function loadGuardHelpers(
  societyId: string,
  onlyInside: boolean,
): Promise<{ data: GuardHelper[]; error: { message: string } | null }> {
  const select: string = onlyInside
    ? HELPER_GUARD_SELECT.replace('helper_attendance(', 'helper_attendance!inner(')
    : HELPER_GUARD_SELECT;
  const { data, error } = await supabase
    .from('helpers')
    .select(select)
    .eq('society_id', societyId)
    .is('helper_attendance.exit_at', null)
    .order('name');
  return { data: (data ?? []) as unknown as GuardHelper[], error };
}
