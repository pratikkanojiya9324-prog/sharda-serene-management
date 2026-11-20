export type Role = 'admin' | 'guard' | 'resident';
export type Home = '/(guard)' | '/(resident)' | '/no-access';

/** Guard wins if the user holds a guard role; else resident; admin-only or none -> no-access. */
export function pickHome(memberships: { role: Role }[]): Home {
  if (memberships.some((m) => m.role === 'guard')) return '/(guard)';
  if (memberships.some((m) => m.role === 'resident')) return '/(resident)';
  return '/no-access';
}
