// Pure helpers for the polls page. Times are Asia/Kolkata (see ist.ts).

import { DAY_MS, IST_OFFSET_MS } from './ist';

export type PollOption = { id: string; label: string };
export type ResultRow = { label: string; count: number; pct: number };

/** `total` is the number of flats that voted, so a multi-choice row reads as "% of voting flats". */
export function resultRows(options: PollOption[], counts: Record<string, number> | null, total: number): ResultRow[] {
  return options.map((o) => {
    const count = counts?.[o.id] ?? 0;
    return { label: o.label, count, pct: total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0 };
  });
}

/** "12 of 40 flats voted (30%)" - same copy as the mobile app. */
export function turnoutText(voted: number, total: number): string {
  const pct = total ? Math.round((voted / total) * 100) : 0;
  return `${voted} of ${total} flats voted (${pct}%)`;
}

/** 7 days ahead at 21:00 IST, as a `datetime-local` value ("2026-11-30T21:00"). */
export function defaultClosesAt(now: Date): string {
  const d = new Date(now.getTime() + IST_OFFSET_MS + 7 * DAY_MS);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T21:00`;
}
