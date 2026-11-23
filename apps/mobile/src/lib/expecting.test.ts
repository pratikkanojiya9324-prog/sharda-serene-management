import { activeExpectations, companiesFor, expectationLabel } from './expecting';

const at = (h: number, m = 0) => new Date(2026, 10, 23, h, m).toISOString();
const row = (over: Partial<Parameters<typeof expectationLabel>[0]> & { id?: string; cancelled_at?: string | null }) => ({
  id: 'x',
  purpose: 'delivery' as const,
  company: 'Swiggy' as string | null,
  valid_to: at(15, 30),
  cancelled_at: null as string | null,
  ...over,
});

describe('expectationLabel', () => {
  it('shows company, purpose and end time', () => {
    expect(expectationLabel(row({}))).toBe('Swiggy delivery · until 3:30 PM');
    expect(expectationLabel(row({ purpose: 'cab', company: 'Uber', valid_to: at(9, 5) }))).toBe('Uber cab · until 9:05 AM');
  });
  it('falls back to the purpose alone without a company', () => {
    expect(expectationLabel(row({ company: null }))).toBe('Delivery · until 3:30 PM');
    expect(expectationLabel(row({ purpose: 'guest', company: '' }))).toBe('Guest · until 3:30 PM');
  });
});

describe('activeExpectations', () => {
  const now = new Date(2026, 10, 23, 14, 0);
  it('drops cancelled and expired rows and sorts by end time', () => {
    const rows = [
      row({ id: 'late', valid_to: at(18) }),
      row({ id: 'cancelled', cancelled_at: at(13) }),
      row({ id: 'expired', valid_to: at(13, 59) }),
      row({ id: 'soon', valid_to: at(15) }),
    ];
    expect(activeExpectations(rows, now).map((r) => r.id)).toEqual(['soon', 'late']);
  });
});

describe('companiesFor', () => {
  it('lists delivery and cab companies, none for guest/service', () => {
    expect(companiesFor('delivery')).toContain('Swiggy');
    expect(companiesFor('delivery')).not.toContain('Uber');
    expect(companiesFor('cab')).toEqual(['Uber', 'Ola', 'Rapido', 'Other']);
    expect(companiesFor('guest')).toEqual([]);
  });
});
