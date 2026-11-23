import {
  billStatusPill,
  complaintCategory,
  complaintStatus,
  COMPLAINT_CATEGORIES,
  parcelStatus,
  visitPill,
  visitStatus,
} from './status';

describe('billStatusPill', () => {
  const today = new Date(2026, 10, 20);

  it('is Overdue (danger) when unpaid past the due date', () => {
    expect(billStatusPill('unpaid', '2026-11-10', today)).toMatchObject({ label: 'Overdue', tone: 'danger' });
  });

  it('is Unpaid (warning) up to and including the due date', () => {
    expect(billStatusPill('unpaid', '2026-11-20', today)).toMatchObject({ label: 'Unpaid', tone: 'warning' });
    expect(billStatusPill('unpaid', '2026-12-10', today)).toMatchObject({ label: 'Unpaid', tone: 'warning' });
  });

  it('is Paid (success) whatever the due date', () => {
    expect(billStatusPill('paid', '2026-11-01', today)).toMatchObject({ label: 'Paid', tone: 'success' });
  });

  it('always carries an icon', () => {
    for (const s of ['paid', 'unpaid'] as const) {
      expect(billStatusPill(s, '2026-11-01', today).icon).toBeTruthy();
    }
  });
});

describe('complaintStatus', () => {
  it.each([
    ['open', 'Open', 'warning', 'alert-circle'],
    ['in_progress', 'In progress', 'info', 'construct'],
    ['resolved', 'Resolved', 'success', 'checkmark-circle'],
  ] as const)('%s -> %s / %s / %s', (s, label, tone, icon) => {
    expect(complaintStatus(s)).toEqual({ label, tone, icon });
  });
});

describe('complaint categories', () => {
  it('lists every category in the agreed order', () => {
    expect(COMPLAINT_CATEGORIES.map((c) => c.value)).toEqual([
      'plumbing',
      'electrical',
      'lift',
      'cleaning',
      'security',
      'parking',
      'other',
    ]);
  });

  it('labels a category', () => {
    expect(complaintCategory('lift')).toMatchObject({ label: 'Lift', icon: 'swap-vertical' });
  });
});

describe('visitPill', () => {
  it('shows the guard decision over the request status', () => {
    expect(visitPill({ status: 'pending', manual_outcome: 'allowed' })).toMatchObject({ label: 'Let in by guard', tone: 'success' });
    expect(visitPill({ status: 'expired', manual_outcome: 'sent_back' })).toMatchObject({ label: 'Sent back', tone: 'danger' });
    expect(visitPill({ status: 'approved', manual_outcome: null })).toEqual(visitStatus('approved'));
  });

  it('marks an approved visit from an expected entry as auto-approved', () => {
    expect(visitPill({ status: 'approved', manual_outcome: null, expected_entry_id: 'e1' })).toEqual({
      label: 'Auto-approved',
      tone: 'success',
      icon: 'flash',
    });
  });

  it('does not mark pending visits or visits without an expected entry as auto-approved', () => {
    expect(visitPill({ status: 'pending', manual_outcome: null, expected_entry_id: 'e1' })).toEqual(visitStatus('pending'));
    expect(visitPill({ status: 'approved', manual_outcome: null, expected_entry_id: null })).toEqual(visitStatus('approved'));
  });

  it('keeps the guard decision over auto-approval', () => {
    expect(visitPill({ status: 'approved', manual_outcome: 'allowed', expected_entry_id: 'e1' })).toMatchObject({ label: 'Let in by guard' });
    expect(visitPill({ status: 'approved', manual_outcome: 'sent_back', expected_entry_id: 'e1' })).toMatchObject({ label: 'Sent back' });
  });
});

describe('visitStatus', () => {
  it.each([
    ['pending', 'Waiting', 'accent'],
    ['approved', 'Approved', 'success'],
    ['denied', 'Denied', 'danger'],
    ['leave_at_gate', 'Leave at gate', 'info'],
    ['expired', 'Expired', 'neutral'],
  ] as const)('%s -> %s (%s)', (s, label, tone) => {
    expect(visitStatus(s)).toMatchObject({ label, tone });
  });
});

describe('parcelStatus', () => {
  it('labels returned parcels by status', () => {
    expect(parcelStatus('returned').label).toBe('Returned to courier');
    expect(parcelStatus('at_gate').label).toBe('At the gate');
    expect(parcelStatus('collected').label).toBe('Collected');
  });
});
