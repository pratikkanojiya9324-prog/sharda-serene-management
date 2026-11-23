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

  it.each(['poll_created', 'poll_reminder'])('opens the poll for %s', (type) => {
    expect(notificationTarget({ type, id: 'p1' }, ['resident'])).toEqual({
      pathname: '/(resident)/polls/[id]',
      params: { id: 'p1' },
    });
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

  it.each(['helper_in', 'helper_out'])('opens daily help for %s', (type) => {
    expect(notificationTarget({ type, id: 'h1' }, ['resident'])).toBe('/(resident)/daily-help');
  });

  it.each(['parcel_logged', 'parcel_collected'])('opens parcels for %s', (type) => {
    expect(notificationTarget({ type, id: 'p1' }, ['resident'])).toBe('/(resident)/parcels');
  });

  it('opens the request for visit_auto_approved (visit id in id)', () => {
    expect(notificationTarget({ type: 'visit_auto_approved', id: 'v9' }, ['resident'])).toEqual({
      pathname: '/(resident)/request/[id]',
      params: { id: 'v9' },
    });
    expect(notificationTarget({ type: 'visit_auto_approved' }, ['resident'])).toBeNull();
  });

  it('ignores the new flat pushes for users without a resident role', () => {
    expect(notificationTarget({ type: 'helper_in' }, ['guard'])).toBeNull();
  });
});

describe('round 3 community pushes', () => {
  it('opens my bookings for booking_decided', () => {
    expect(notificationTarget({ type: 'booking_decided', id: 'k1' }, ['resident'])).toBe(
      '/(resident)/amenities/bookings',
    );
  });
  it('opens the event for event_created', () => {
    expect(notificationTarget({ type: 'event_created', id: 'e1' }, ['resident'])).toEqual({
      pathname: '/(resident)/events/[id]',
      params: { id: 'e1' },
    });
    expect(notificationTarget({ type: 'event_created' }, ['resident'])).toBeNull();
  });
  it('ignores them for staff-only users', () => {
    expect(notificationTarget({ type: 'booking_decided', id: 'k1' }, ['admin'])).toBeNull();
  });
});
