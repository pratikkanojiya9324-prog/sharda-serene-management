import type { Database } from '@society-gate/shared';

import { localDateString } from './format';
import { naturalCompare } from './flatPicker';

type PaymentMode = Database['public']['Enums']['payment_mode'];

/** First of the month for a 'YYYY-MM-DD' date. */
const monthStart = (value: string) => `${value.slice(0, 7)}-01`;

/**
 * Every bill month from the newer to the older bound (inclusive), newest
 * first, as 'YYYY-MM-01' periods. The bounds may come in either order.
 */
export function monthsBetween(a: string, b: string): string[] {
  const [older, newer] = [monthStart(a), monthStart(b)].sort();
  const out: string[] = [];
  const d = new Date(Number(newer.slice(0, 4)), Number(newer.slice(5, 7)) - 1, 1);
  for (let p = localDateString(d); p >= older; p = localDateString(d)) {
    out.push(p);
    d.setMonth(d.getMonth() - 1);
  }
  return out;
}

export type BillSummary = {
  count: number;
  paid: number;
  unpaid: number;
  billed: number;
  collected: number;
  outstanding: number;
};

/** Counts and rupee totals for the month header. */
export function summarizeBills(bills: readonly { amount: number; status: 'paid' | 'unpaid' }[]): BillSummary {
  const s: BillSummary = { count: 0, paid: 0, unpaid: 0, billed: 0, collected: 0, outstanding: 0 };
  for (const b of bills) {
    const amount = Number(b.amount);
    s.count++;
    s.billed += amount;
    if (b.status === 'paid') {
      s.paid++;
      s.collected += amount;
    } else {
      s.unpaid++;
      s.outstanding += amount;
    }
  }
  // Sums of 2-decimal amounts: drop float noise (0.1 + 0.2).
  const round = (n: number) => Math.round(n * 100) / 100;
  return { ...s, billed: round(s.billed), collected: round(s.collected), outstanding: round(s.outstanding) };
}

export type BillFilter = 'all' | 'unpaid' | 'paid';

const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Bills with the given status whose flat label matches the search, in natural flat order. */
export function filterBills<T extends { label: string; status: 'paid' | 'unpaid' }>(
  bills: readonly T[],
  status: BillFilter,
  query: string,
): T[] {
  const q = normalize(query);
  return bills
    .filter((b) => (status === 'all' || b.status === status) && normalize(b.label).includes(q))
    .sort((a, b) => naturalCompare(a.label, b.label));
}

export const MAX_REFERENCE_LENGTH = 100;

export type PaymentCheck = { ok: true; mode: PaymentMode; reference: string | null } | { ok: false; error: string };

/** Mark-paid form: a mode is required; a cheque needs its number; the reference is otherwise optional. */
export function validatePayment(mode: PaymentMode | null, reference: string): PaymentCheck {
  if (!mode) return { ok: false, error: 'Choose how the bill was paid' };
  const ref = reference.trim();
  if (mode === 'cheque' && !ref) return { ok: false, error: 'Enter the cheque number' };
  if (ref.length > MAX_REFERENCE_LENGTH) return { ok: false, error: 'The reference is too long' };
  return { ok: true, mode, reference: ref || null };
}
