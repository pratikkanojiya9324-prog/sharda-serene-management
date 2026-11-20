import type { Role } from './session';

export type NotificationTarget =
  | { pathname: '/(resident)/request/[id]'; params: { id: string } }
  | '/(resident)/history'
  | null;

/**
 * Where a tapped push should take the user. Visitor pushes go only to residents,
 * so they open the resident screens whenever the user has a resident role (also
 * for someone who is both guard and resident, whose home is the guard screen).
 */
export function notificationTarget(data: unknown, roles: Role[]): NotificationTarget {
  if (!roles.includes('resident') || !data || typeof data !== 'object') return null;
  const { type, visitId } = data as { type?: unknown; visitId?: unknown };
  if (type === 'visit_request' && typeof visitId === 'string' && visitId) {
    return { pathname: '/(resident)/request/[id]', params: { id: visitId } };
  }
  if (type === 'pass_used') return '/(resident)/history';
  return null;
}
