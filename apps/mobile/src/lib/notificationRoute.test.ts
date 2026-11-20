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

  it('opens the notice for notice_posted', () => {
    expect(notificationTarget({ type: 'notice_posted', id: 'n1' }, ['resident'])).toEqual({
      pathname: '/(resident)/notices/[id]',
      params: { id: 'n1' },
    });
  });

  it('opens the complaint for complaint_updated', () => {
    expect(notificationTarget({ type: 'complaint_updated', id: 'c1' }, ['resident'])).toEqual({
      pathname: '/(resident)/complaints/[id]',
      params: { id: 'c1' },
    });
  });

  it.each(['bill_created', 'bill_paid'])('opens the bill for %s', (type) => {
    expect(notificationTarget({ type, id: 'b1' }, ['resident'])).toEqual({
      pathname: '/(resident)/bills/[id]',
      params: { id: 'b1' },
    });
  });

  it('opens the admin complaint screen for complaint_created', () => {
    const target = { pathname: '/(admin)/complaints/[id]', params: { id: 'c9' } };
    expect(notificationTarget({ type: 'complaint_created', id: 'c9' }, ['admin'])).toEqual(target);
    expect(notificationTarget({ type: 'complaint_created', id: 'c9' }, ['admin', 'resident'])).toEqual(target);
  });

  it('ignores complaint_created for non-admins and without an id', () => {
    expect(notificationTarget({ type: 'complaint_created', id: 'c9' }, ['resident'])).toBeNull();
    expect(notificationTarget({ type: 'complaint_created', id: 'c9' }, ['guard'])).toBeNull();
    expect(notificationTarget({ type: 'complaint_created' }, ['admin'])).toBeNull();
  });

  it('ignores resident pushes for staff-only users and pushes without an id', () => {
    expect(notificationTarget({ type: 'notice_posted', id: 'n1' }, ['admin'])).toBeNull();
    expect(notificationTarget({ type: 'bill_paid' }, ['resident'])).toBeNull();
    expect(notificationTarget({ type: 'complaint_updated', id: '' }, ['resident'])).toBeNull();
  });

  it('ignores unknown or malformed data', () => {
    expect(notificationTarget({ type: 'other' }, ['resident'])).toBeNull();
    expect(notificationTarget({ type: 'toString', id: 'x' }, ['resident'])).toBeNull();
    expect(notificationTarget({ type: 'visit_request' }, ['resident'])).toBeNull();
    expect(notificationTarget(null, ['resident'])).toBeNull();
  });
});
