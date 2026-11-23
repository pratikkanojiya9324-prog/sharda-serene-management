import { SOS_HOLD_MS, sosSendState, sosStatusText, sosTypeIcon, sosTypeLabel } from './sos';

describe('sosStatusText', () => {
  it('says the guards are being alerted while open', () => {
    expect(sosStatusText({ status: 'open', acknowledged_by_name: null })).toBe('Sent — alerting the guards');
  });
  it('names the guard who is on the way', () => {
    expect(sosStatusText({ status: 'acknowledged', acknowledged_by_name: 'Ravi' })).toBe('Ravi is on the way');
  });
  it('falls back to "A guard" without a name', () => {
    expect(sosStatusText({ status: 'acknowledged', acknowledged_by_name: null })).toBe('A guard is on the way');
    expect(sosStatusText({ status: 'acknowledged', acknowledged_by_name: '  ' })).toBe('A guard is on the way');
  });
  it('covers resolved and cancelled', () => {
    expect(sosStatusText({ status: 'resolved', acknowledged_by_name: 'Ravi' })).toBe('Resolved');
    expect(sosStatusText({ status: 'cancelled', acknowledged_by_name: null })).toBe('Cancelled');
  });
});

describe('sosSendState', () => {
  const base = { busy: false, error: null, alert: null };
  it('is sending while busy, even with an error or alert', () => {
    expect(sosSendState({ ...base, busy: true })).toBe('sending');
    expect(sosSendState({ busy: true, error: 'x', alert: { status: 'open' } })).toBe('sending');
  });
  it('is failed with an error and no alert', () => {
    expect(sosSendState({ ...base, error: 'No internet' })).toBe('failed');
  });
  it('is active for open or acknowledged', () => {
    expect(sosSendState({ ...base, alert: { status: 'open' } })).toBe('active');
    expect(sosSendState({ ...base, alert: { status: 'acknowledged' } })).toBe('active');
    expect(sosSendState({ busy: false, error: 'x', alert: { status: 'open' } })).toBe('active');
  });
  it('is done for resolved or cancelled', () => {
    expect(sosSendState({ ...base, alert: { status: 'resolved' } })).toBe('done');
    expect(sosSendState({ ...base, alert: { status: 'cancelled' } })).toBe('done');
  });
  it('is idle otherwise', () => {
    expect(sosSendState(base)).toBe('idle');
  });
});

describe('sos types', () => {
  it('holds for 2 seconds', () => expect(SOS_HOLD_MS).toBe(2000));
  it.each([
    ['medical', 'Medical', 'medkit'],
    ['fire', 'Fire', 'flame'],
    ['security', 'Security', 'shield'],
    ['lift', 'Lift stuck', 'swap-vertical'],
    ['other', 'Other', 'alert-circle'],
  ] as const)('%s', (t, label, icon) => {
    expect(sosTypeLabel(t)).toBe(label);
    expect(sosTypeIcon(t)).toBe(icon);
  });
});
