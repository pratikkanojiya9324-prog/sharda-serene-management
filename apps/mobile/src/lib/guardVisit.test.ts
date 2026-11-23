import { expectedLine, prefillCourier } from './guardVisit';

describe('prefillCourier', () => {
  it('returns the canonical courier for a matching name, case-insensitively', () => {
    expect(prefillCourier('amazon')).toBe('Amazon');
    expect(prefillCourier(' Blue Dart ')).toBe('Blue Dart');
  });
  it('does not prefill a person name', () => {
    expect(prefillCourier('Ramesh Kumar')).toBeUndefined();
    expect(prefillCourier('')).toBeUndefined();
  });
});

describe('expectedLine', () => {
  it('shows company, purpose and who expected it', () => {
    expect(expectedLine({ company: 'Swiggy', purpose: 'delivery', created_by_name: 'Rahul' })).toBe('Expected: Swiggy delivery · by Rahul');
  });
  it('capitalises the purpose when there is no company', () => {
    expect(expectedLine({ company: null, purpose: 'delivery', created_by_name: 'Rahul' })).toBe('Expected: Delivery · by Rahul');
  });
  it('omits the name when unknown', () => {
    expect(expectedLine({ company: null, purpose: 'cab', created_by_name: null })).toBe('Expected: Cab');
  });
});
