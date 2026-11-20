import { filterBills, monthsBetween, summarizeBills, validatePayment } from './adminBills';

describe('monthsBetween', () => {
  it('lists every month from newest to oldest, inclusive', () => {
    expect(monthsBetween('2026-09-01', '2026-11-01')).toEqual(['2026-11-01', '2026-10-01', '2026-09-01']);
  });

  it('crosses year boundaries', () => {
    expect(monthsBetween('2025-12-01', '2026-02-01')).toEqual(['2026-02-01', '2026-01-01', '2025-12-01']);
  });

  it('accepts any day of the month and swapped bounds', () => {
    expect(monthsBetween('2026-11-15', '2026-10-03')).toEqual(['2026-11-01', '2026-10-01']);
  });

  it('returns one month when both ends are the same month', () => {
    expect(monthsBetween('2026-11-01', '2026-11-01')).toEqual(['2026-11-01']);
  });
});

const bill = (over: Partial<{ id: string; label: string; amount: number; status: 'paid' | 'unpaid' }>) => ({
  id: 'b',
  label: 'B1-A-101',
  amount: 2500,
  status: 'unpaid' as 'paid' | 'unpaid',
  ...over,
});

describe('summarizeBills', () => {
  it('totals billed, collected and outstanding amounts with counts', () => {
    const s = summarizeBills([
      bill({ id: '1', amount: 2500, status: 'paid' }),
      bill({ id: '2', amount: 2500 }),
      bill({ id: '3', amount: 3000.5 }),
    ]);
    expect(s).toEqual({ count: 3, paid: 1, unpaid: 2, billed: 8000.5, collected: 2500, outstanding: 5500.5 });
  });

  it('is all zeros for an empty month', () => {
    expect(summarizeBills([])).toEqual({ count: 0, paid: 0, unpaid: 0, billed: 0, collected: 0, outstanding: 0 });
  });
});

describe('filterBills', () => {
  const bills = [
    bill({ id: '1', label: 'B1-A-110', status: 'paid' }),
    bill({ id: '2', label: 'B2-A-101' }),
    bill({ id: '3', label: 'B1-A-12' }),
    bill({ id: '4', label: 'B1-B-101', status: 'paid' }),
  ];
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

  it('keeps every bill for "all", in natural flat order', () => {
    expect(ids(filterBills(bills, 'all', ''))).toEqual(['3', '1', '4', '2']);
  });

  it('filters by status', () => {
    expect(ids(filterBills(bills, 'unpaid', ''))).toEqual(['3', '2']);
    expect(ids(filterBills(bills, 'paid', ''))).toEqual(['1', '4']);
  });

  it('searches the flat label ignoring case, spaces and dashes', () => {
    expect(ids(filterBills(bills, 'all', 'b1 a1'))).toEqual(['3', '1']);
    expect(ids(filterBills(bills, 'all', '101'))).toEqual(['4', '2']);
  });

  it('does not mutate the input', () => {
    const copy = [...bills];
    filterBills(bills, 'all', '');
    expect(bills).toEqual(copy);
  });
});

describe('validatePayment', () => {
  it('needs a payment mode', () => {
    expect(validatePayment(null, '')).toEqual({ ok: false, error: 'Choose how the bill was paid' });
  });

  it('needs the cheque number for a cheque', () => {
    expect(validatePayment('cheque', '   ')).toEqual({ ok: false, error: 'Enter the cheque number' });
    expect(validatePayment('cheque', ' 004512 ')).toEqual({ ok: true, mode: 'cheque', reference: '004512' });
  });

  it('makes the reference optional for cash, UPI and other (blank → null)', () => {
    expect(validatePayment('cash', '  ')).toEqual({ ok: true, mode: 'cash', reference: null });
    expect(validatePayment('upi', 'UTR 1234')).toEqual({ ok: true, mode: 'upi', reference: 'UTR 1234' });
    expect(validatePayment('other', '')).toEqual({ ok: true, mode: 'other', reference: null });
  });

  it('caps the reference at 100 characters', () => {
    expect(validatePayment('upi', 'x'.repeat(101))).toEqual({ ok: false, error: 'The reference is too long' });
    expect(validatePayment('upi', 'x'.repeat(100)).ok).toBe(true);
  });
});
