import { CALL_BUTTON_AFTER_MS } from './constants';

export type VisitStatus = 'pending' | 'approved' | 'denied' | 'leave_at_gate' | 'expired';

export function shouldShowCallButton(
  v: { status: VisitStatus; created_at: string; no_app_users: boolean },
  now: Date,
): boolean {
  if (v.status === 'expired') return true;
  if (v.status !== 'pending') return false;
  if (v.no_app_users) return true;
  return now.getTime() - new Date(v.created_at).getTime() >= CALL_BUTTON_AFTER_MS;
}
