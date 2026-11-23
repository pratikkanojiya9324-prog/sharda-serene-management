import type { Role } from './session';

type DetailPath =
  | '/(resident)/request/[id]'
  | '/(resident)/notices/[id]'
  | '/(resident)/complaints/[id]'
  | '/(resident)/bills/[id]'
  | '/(resident)/polls/[id]'
  | '/(admin)/complaints/[id]';

export type NotificationTarget =
  | { pathname: DetailPath; params: { id: string } }
  | '/(resident)/history'
  | '/(resident)/daily-help'
  | '/(resident)/parcels'
  | null;

/** Round 1 pushes (and visit_auto_approved, whose id is the visit) carry `{ type, id }`; visitor pushes carry `{ type, visitId }`. */
const RESIDENT_BY_ID = new Map<unknown, DetailPath>([
  ['notice_posted', '/(resident)/notices/[id]'],
  ['complaint_updated', '/(resident)/complaints/[id]'],
  ['bill_created', '/(resident)/bills/[id]'],
  ['bill_paid', '/(resident)/bills/[id]'],
  ['poll_created', '/(resident)/polls/[id]'],
  ['poll_reminder', '/(resident)/polls/[id]'],
  ['visit_auto_approved', '/(resident)/request/[id]'],
]);

/** Pushes that go to the society's admins. */
const ADMIN_BY_ID = new Map<unknown, DetailPath>([['complaint_created', '/(admin)/complaints/[id]']]);

/**
 * Where a tapped push should take the user. Admin pushes open the admin
 * screens for a user with an admin role. Flat pushes open the resident screens
 * whenever the user has a resident role (also for someone who is both guard
 * and resident, whose home is the guard screen).
 */
export function notificationTarget(data: unknown, roles: Role[]): NotificationTarget {
  if (!data || typeof data !== 'object') return null;
  const { type, visitId, id } = data as { type?: unknown; visitId?: unknown; id?: unknown };
  const hasId = typeof id === 'string' && id !== '';

  if (roles.includes('admin')) {
    const pathname = ADMIN_BY_ID.get(type);
    if (pathname) return hasId ? { pathname, params: { id: id as string } } : null;
  }

  if (!roles.includes('resident')) return null;
  if (type === 'visit_request' && typeof visitId === 'string' && visitId) {
    return { pathname: '/(resident)/request/[id]', params: { id: visitId } };
  }
  if (type === 'pass_used') return '/(resident)/history';
  if (type === 'helper_in' || type === 'helper_out') return '/(resident)/daily-help';
  if (type === 'parcel_logged' || type === 'parcel_collected') return '/(resident)/parcels';
  const pathname = RESIDENT_BY_ID.get(type);
  if (pathname && hasId) return { pathname, params: { id: id as string } };
  return null;
}
