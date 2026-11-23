import { EXPECTED_COMPANIES, type ExpectedPurpose } from '@society-gate/shared';

import { formatTime } from './format';

type Expectation = { purpose: ExpectedPurpose; company: string | null; valid_to: string };

export const PURPOSE_OPTIONS: { value: ExpectedPurpose; label: string }[] = [
  { value: 'delivery', label: 'Delivery' },
  { value: 'cab', label: 'Cab' },
  { value: 'service', label: 'Service' },
  { value: 'guest', label: 'Guest' },
];

const PURPOSE_LABEL = Object.fromEntries(PURPOSE_OPTIONS.map((p) => [p.value, p.label])) as Record<ExpectedPurpose, string>;

/** Company chips for a purpose; services and guests have none. */
export function companiesFor(purpose: ExpectedPurpose): string[] {
  if (purpose === 'delivery') return EXPECTED_COMPANIES.filter((c) => !['Uber', 'Ola', 'Rapido'].includes(c));
  if (purpose === 'cab') return ['Uber', 'Ola', 'Rapido', 'Other'];
  return [];
}

/** Not cancelled, not yet expired, soonest-ending first. */
export function activeExpectations<T extends { valid_to: string; cancelled_at: string | null }>(rows: T[], now: Date): T[] {
  return rows
    .filter((r) => !r.cancelled_at && new Date(r.valid_to).getTime() > now.getTime())
    .sort((a, b) => new Date(a.valid_to).getTime() - new Date(b.valid_to).getTime());
}

/** "Swiggy delivery · until 3:30 PM"; without a company "Delivery · until 3:30 PM". */
export function expectationLabel(row: Expectation): string {
  const purpose = PURPOSE_LABEL[row.purpose] ?? 'Visitor';
  const company = row.company?.trim();
  const what = company ? `${company} ${purpose.toLowerCase()}` : purpose;
  return `${what} · until ${formatTime(row.valid_to)}`;
}
