import { requestResultText } from './requestResult';

const me = 'me';
const other = 'other';

describe('requestResultText', () => {
  it('is null while the request is open', () => {
    expect(requestResultText({ status: 'pending', responded_by: null, manual_outcome: null }, me)).toBeNull();
  });

  it.each([
    ['approved', 'You approved this visitor', 'Approved by another family member'],
    ['denied', 'You denied this visitor', 'Denied by another family member'],
    ['leave_at_gate', 'You asked to leave it at the gate', 'Another family member asked to leave it at the gate'],
  ] as const)('%s: "You" only when I answered', (status, mine, theirs) => {
    expect(requestResultText({ status, responded_by: me, manual_outcome: null }, me)).toBe(mine);
    expect(requestResultText({ status, responded_by: other, manual_outcome: null }, me)).toBe(theirs);
    expect(requestResultText({ status, responded_by: null, manual_outcome: null }, me)).toBe(theirs);
    expect(requestResultText({ status, responded_by: me, manual_outcome: null }, null)).toBe(theirs);
  });

  it('reports the guard decision', () => {
    expect(requestResultText({ status: 'pending', responded_by: null, manual_outcome: 'allowed' }, me)).toBe(
      'The guard let this visitor in',
    );
    expect(requestResultText({ status: 'expired', responded_by: null, manual_outcome: 'sent_back' }, me)).toBe(
      'The guard sent this visitor back',
    );
  });

  it('reports expiry', () => {
    expect(requestResultText({ status: 'expired', responded_by: null, manual_outcome: null }, me)).toBe(
      'This request expired — the guard will call you',
    );
  });
});
