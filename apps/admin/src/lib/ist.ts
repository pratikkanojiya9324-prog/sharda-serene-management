// Asia/Kolkata (UTC+5:30, no DST) helpers shared by the admin pages.

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** A `datetime-local` value read as IST, as an ISO instant; null when empty or invalid. */
export function istLocalToIso(value: string): string | null {
  if (!value) return null;
  const t = new Date(`${value}:00+05:30`);
  return Number.isNaN(t.getTime()) ? null : t.toISOString();
}
