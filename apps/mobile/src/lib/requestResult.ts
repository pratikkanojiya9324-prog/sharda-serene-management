import { actorLabel } from './attribution';
import type { Visit } from './visitMerge';

type Answered = Pick<Visit, 'status' | 'responded_by_name' | 'manual_outcome'>;

/**
 * What the resident sees once a request is no longer open, naming who answered:
 * "Approved by Rahul (B1-A-101)". All family members share the flat account, so
 * the name comes from `responded_by_name` (the "who's using this phone" name).
 * Returns null while the request is still open.
 */
export function requestResultText(visit: Answered, flat: string | null): string | null {
  if (visit.manual_outcome && (visit.status === 'pending' || visit.status === 'expired')) {
    return visit.manual_outcome === 'allowed' ? 'The guard let this visitor in' : 'The guard sent this visitor back';
  }
  const who = actorLabel(visit.responded_by_name, flat);
  switch (visit.status) {
    case 'pending':
      return null;
    case 'approved':
      return `Approved by ${who}`;
    case 'denied':
      return `Denied by ${who}`;
    case 'leave_at_gate':
      return `${who} asked to leave it at the gate`;
    case 'expired':
      return 'This request expired — the guard will call you';
  }
}
