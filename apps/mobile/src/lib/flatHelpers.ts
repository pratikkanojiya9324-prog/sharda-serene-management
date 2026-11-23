import { HELPER_RESIDENT_SELECT } from '@society-gate/shared';

import { reportError } from './errors';
import { supabase } from './supabase';

type Attendance = { id: string; entry_at: string; exit_at: string | null };
export type FlatHelper = {
  id: string;
  name: string;
  phone: string;
  type: import('@society-gate/shared').HelperType;
  photo_path: string | null;
  entry_code: string;
  active: boolean;
  helper_attendance: Attendance[];
};

/**
 * The daily help linked to one flat, with this month's attendance only (the
 * embed is filtered at query time, since the select would otherwise bring every
 * attendance row ever). `error` is user-facing text.
 */
export async function loadFlatHelpers(
  flatId: string,
  monthStart: Date,
): Promise<{ helpers: FlatHelper[]; error: null } | { helpers: null; error: string }> {
  const links = await supabase.from('helper_flats').select('helper_id').eq('flat_id', flatId);
  if (links.error) return { helpers: null, error: reportError(links.error) };
  const ids = (links.data ?? []).map((l) => l.helper_id);
  if (!ids.length) return { helpers: [], error: null };
  const { data, error } = await supabase
    .from('helpers')
    .select(HELPER_RESIDENT_SELECT)
    .in('id', ids)
    .gte('helper_attendance.entry_at', monthStart.toISOString())
    .order('name');
  if (error) return { helpers: null, error: reportError(error) };
  return { helpers: (data ?? []) as unknown as FlatHelper[], error: null };
}
