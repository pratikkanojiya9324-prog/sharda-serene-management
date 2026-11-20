import type { Role } from './session';

type DetailPath =
  | '/(resident)/request/[id]'
  | '/(resident)/notices/[id]'
  | '/(resident)/complaints/[id]'
  | '/(resident)/bills/[id]';

export type NotificationTarget = { pathname: DetailPath; params: { id: string } } | '/(resident)/history' | null;

/** Round 1 pushes carry `{ type, id }`; visitor pushes carry `{ type, visitId }`. */
const BY_ID = new Map<unknown, DetailPath>([
  ['notice_posted', '/(resident)/notices/[id]'],
  ['complaint_updated', '/(resident)/complaints/[id]'],
  ['bill_created', '/(resident)/bills/[id]'],
  ['bill_paid', '/(resident)/bills/[id]'],
]);

/**
 * Where a tapped push should take the user. These pushes go only to flats, so
 * they open the resident screens whenever the user has a resident role (also
 * for someone who is both guard and resident, whose home is the guard screen).
 */
export function notificationTarget(data: unknown, roles: Role[]): NotificationTarget {
  if (!roles.includes('resident') || !data || typeof data !== 'object') return null;
  const { type, visitId, id } = data as { type?: unknown; visitId?: unknown; id?: unknown };
  if (type === 'visit_request' && typeof visitId === 'string' && visitId) {
    return { pathname: '/(resident)/request/[id]', params: { id: visitId } };
  }
  if (type === 'pass_used') return '/(resident)/history';
  const pathname = BY_ID.get(type);
  if (pathname && typeof id === 'string' && id) return { pathname, params: { id } };
  return null;
}
