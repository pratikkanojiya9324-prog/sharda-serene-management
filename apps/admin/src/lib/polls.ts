// Pure helpers for the polls page. Times are Asia/Kolkata (UTC+5:30, no DST).

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

export type PollOption = { id: string; label: string };
export type ResultRow = { label: string; count: number; pct: number };

/** `total` is the number of flats that voted, so a multi-choice row reads as "% of voting flats". */
export function resultRows(options: PollOption[], counts: Record<string, number> | null, total: number): ResultRow[] {
  return options.map((o) => {
    const count = counts?.[o.id] ?? 0;
    return { label: o.label, count, pct: total ? Math.round((count / total) * 100) : 0 };
  });
}

/** "12 of 40 flats voted (30%)" - same copy as the mobile app. */
export function turnoutText(voted: number, total: number): string {
  const pct = total ? Math.round((voted / total) * 100) : 0;
  return `${voted} of ${total} flats voted (${pct}%)`;
}

/** 7 days ahead at 21:00 IST, as a `datetime-local` value ("2026-11-30T21:00"). */
export function defaultClosesAt(now: Date): string {
  const d = new Date(now.getTime() + IST_OFFSET_MS + 7 * DAY);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T21:00`;
}

/** A `datetime-local` value read as IST, as an ISO instant; null when empty or invalid. */
export function istLocalToIso(value: string): string | null {
  if (!value) return null;
  const t = new Date(`${value}:00+05:30`);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}
