import { notificationTarget } from './notificationRoute';

describe('notificationTarget', () => {
  const request = { type: 'visit_request', visitId: 'v1' };

  it('opens the request screen for a resident', () => {
    expect(notificationTarget(request, ['resident'])).toEqual({
      pathname: '/(resident)/request/[id]',
      params: { id: 'v1' },
    });
  });

  it('opens the request screen for a guard who is also a resident', () => {
    expect(notificationTarget(request, ['guard', 'resident'])).toEqual({
      pathname: '/(resident)/request/[id]',
      params: { id: 'v1' },
    });
  });

  it('ignores visitor pushes for a user without a resident role', () => {
    expect(notificationTarget(request, ['guard'])).toBeNull();
  });

  it('opens history for pass_used', () => {
    expect(notificationTarget({ type: 'pass_used', visitId: 'v2' }, ['resident'])).toBe('/(resident)/history');
  });

  it('ignores unknown or malformed data', () => {
    expect(notificationTarget({ type: 'other' }, ['resident'])).toBeNull();
    expect(notificationTarget({ type: 'visit_request' }, ['resident'])).toBeNull();
    expect(notificationTarget(null, ['resident'])).toBeNull();
  });
});
