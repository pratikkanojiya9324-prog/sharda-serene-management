import { requestResultText } from './requestResult';

const flat = 'B1-A-101';
const answered = (status: 'approved' | 'denied' | 'leave_at_gate', responded_by_name: string | null) => ({
  status,
  responded_by_name,
  manual_outcome: null,
});

describe('requestResultText', () => {
  it('is null while the request is open', () => {
    expect(requestResultText({ status: 'pending', responded_by_name: null, manual_outcome: null }, flat)).toBeNull();
  });

  it.each([
    ['approved', 'Approved by Rahul (B1-A-101)', 'Approved by B1-A-101'],
    ['denied', 'Denied by Rahul (B1-A-101)', 'Denied by B1-A-101'],
    ['leave_at_gate', 'Rahul (B1-A-101) asked to leave it at the gate', 'B1-A-101 asked to leave it at the gate'],
  ] as const)('%s names who answered', (status, named, unnamed) => {
    expect(requestResultText(answered(status, 'Rahul'), flat)).toBe(named);
    expect(requestResultText(answered(status, null), flat)).toBe(unnamed);
  });

  it('reports the guard decision', () => {
    expect(requestResultText({ status: 'pending', responded_by_name: null, manual_outcome: 'allowed' }, flat)).toBe(
      'The guard let this visitor in',
    );
    expect(requestResultText({ status: 'expired', responded_by_name: null, manual_outcome: 'sent_back' }, flat)).toBe(
      'The guard sent this visitor back',
    );
  });

  it('reports expiry', () => {
    expect(requestResultText({ status: 'expired', responded_by_name: null, manual_outcome: null }, flat)).toBe(
      'This request expired — the guard will call you',
    );
  });
});
