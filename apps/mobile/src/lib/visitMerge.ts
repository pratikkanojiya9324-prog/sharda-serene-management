import type { Database } from '@society-gate/shared';

export type Visit = Database['public']['Tables']['visits']['Row'];

/**
 * Combines the row we have with a newer copy (Realtime event, poll or re-fetch),
 * which may arrive out of order. A visit only moves forward: it never returns to
 * `pending`, and fields that get set once (guard outcome, entry/exit, photo) are
 * never cleared, so a stale copy cannot undo what we already know.
 */
export function mergeVisit(cur: Visit | null, next: Visit): Visit {
  if (!cur || cur.id !== next.id) return next;
  const statusFrom = cur.status !== 'pending' && next.status === 'pending' ? cur : next;
  return {
    ...next,
    status: statusFrom.status,
    responded_by: statusFrom.responded_by,
    responded_at: statusFrom.responded_at,
    manual_outcome: next.manual_outcome ?? cur.manual_outcome,
    entry_at: next.entry_at ?? cur.entry_at,
    exit_at: next.exit_at ?? cur.exit_at,
    photo_path: next.photo_path ?? cur.photo_path,
  };
}
