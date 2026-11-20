import type { Visit } from './visitMerge';

type Answered = Pick<Visit, 'status' | 'responded_by' | 'manual_outcome'>;

/**
 * What the resident sees once a request is no longer open. Says "You ..." only
 * when the current user is the one who answered (responded_by); otherwise the
 * wording is neutral, because another family member (or the guard) decided.
 * Returns null while the request is still open.
 */
export function requestResultText(visit: Answered, myId: string | null): string | null {
  if (visit.manual_outcome && (visit.status === 'pending' || visit.status === 'expired')) {
    return visit.manual_outcome === 'allowed' ? 'The guard let this visitor in' : 'The guard sent this visitor back';
  }
  const mine = myId !== null && visit.responded_by === myId;
  switch (visit.status) {
    case 'pending':
      return null;
    case 'approved':
      return mine ? 'You approved this visitor' : 'Approved by another family member';
    case 'denied':
      return mine ? 'You denied this visitor' : 'Denied by another family member';
    case 'leave_at_gate':
      return mine ? 'You asked to leave it at the gate' : 'Another family member asked to leave it at the gate';
    case 'expired':
      return 'This request expired — the guard will call you';
  }
}
