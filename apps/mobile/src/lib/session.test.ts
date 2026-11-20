import { pickHome } from './session';

describe('pickHome', () => {
  it('sends a guard (even with resident role) to the guard home', () => {
    expect(pickHome([{ role: 'guard' }, { role: 'resident' }])).toBe('/(guard)');
  });
  it('sends a resident to the resident home', () => {
    expect(pickHome([{ role: 'resident' }])).toBe('/(resident)');
  });
  it('sends an admin-only user to no-access', () => {
    expect(pickHome([{ role: 'admin' }])).toBe('/no-access');
  });
  it('sends a user with no memberships to no-access', () => {
    expect(pickHome([])).toBe('/no-access');
  });
});
