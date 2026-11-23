import { COURIERS } from '@society-gate/shared';

/** The courier chip for a visitor name, only when the name is one of the known couriers. */
export function prefillCourier(name: string | null | undefined): string | undefined {
  const n = (name ?? '').trim().toLowerCase();
  if (!n) return undefined;
  return COURIERS.find((c) => c.toLowerCase() === n);
}

/** "Expected: Swiggy delivery · by Rahul" for the guard on an auto-approved visit. */
export function expectedLine(e: { company: string | null; purpose: string; created_by_name: string | null }): string {
  const what = e.company ? `${e.company} ${e.purpose}` : e.purpose.charAt(0).toUpperCase() + e.purpose.slice(1);
  return `Expected: ${what}${e.created_by_name ? ` · by ${e.created_by_name}` : ''}`;
}
