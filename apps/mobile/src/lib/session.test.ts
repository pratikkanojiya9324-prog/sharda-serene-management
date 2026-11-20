import { firstStop, pickHome } from './session';

describe('pickHome', () => {
  it('sends an admin to the admin home', () => {
    expect(pickHome([{ role: 'admin' }])).toBe('/(admin)');
  });
  it('sends an admin who is also a guard to the admin home', () => {
    expect(pickHome([{ role: 'guard' }, { role: 'admin' }])).toBe('/(admin)');
  });
  it('sends a guard (even with resident role) to the guard home', () => {
    expect(pickHome([{ role: 'guard' }, { role: 'resident' }])).toBe('/(guard)');
  });
  it('sends a resident to the resident home', () => {
    expect(pickHome([{ role: 'resident' }])).toBe('/(resident)');
  });
  it('sends a user with no memberships to no-access', () => {
    expect(pickHome([])).toBe('/no-access');
  });
});

describe('firstStop', () => {
  it('goes to the who screen first, carrying where to go next', () => {
    expect(firstStop({ home: '/(resident)', needsActorName: true, showBatteryGuide: true })).toEqual({
      pathname: '/who',
      params: { next: '/(resident)', battery: '1' },
    });
  });
  it('then the battery guide', () => {
    expect(firstStop({ home: '/(guard)', needsActorName: false, showBatteryGuide: true })).toEqual({
      pathname: '/battery-guide',
      params: { next: '/(guard)' },
    });
  });
  it('else straight home', () => {
    expect(firstStop({ home: '/(admin)', needsActorName: false, showBatteryGuide: false })).toBe('/(admin)');
  });
});
