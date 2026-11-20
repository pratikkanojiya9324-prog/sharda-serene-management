export type Role = 'admin' | 'guard' | 'resident';
export type Home = '/(admin)' | '/(guard)' | '/(resident)' | '/no-access';

/** Admin wins, then guard, then resident; no memberships -> no-access. */
export function pickHome(memberships: { role: Role }[]): Home {
  if (memberships.some((m) => m.role === 'admin')) return '/(admin)';
  if (memberships.some((m) => m.role === 'guard')) return '/(guard)';
  if (memberships.some((m) => m.role === 'resident')) return '/(resident)';
  return '/no-access';
}

export type FirstStop =
  | Home
  | { pathname: '/who'; params: { next: Home; battery: '1' | '0' } }
  | { pathname: '/battery-guide'; params: { next: Home } };

/**
 * Where to go right after sign-in: "Who's using this phone?" first (it carries
 * on to the battery guide / home), then the battery guide, else home.
 */
export function firstStop(r: { home: Home; needsActorName: boolean; showBatteryGuide: boolean }): FirstStop {
  if (r.needsActorName) {
    return { pathname: '/who', params: { next: r.home, battery: r.showBatteryGuide ? '1' : '0' } };
  }
  if (r.showBatteryGuide) return { pathname: '/battery-guide', params: { next: r.home } };
  return r.home;
}
