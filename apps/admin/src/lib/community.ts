// Pure helpers for the amenities and SOS pages. Times are Asia/Kolkata (see ist.ts).
import { IST_OFFSET_MS } from './ist';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The IST wall clock of an instant, read through the UTC getters of a shifted date. */
const ist = (iso: string) => new Date(new Date(iso).getTime() + IST_OFFSET_MS);
const dayText = (d: Date) => `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

function clock(d: Date): { time: string; meridiem: 'AM' | 'PM' } {
  const h = d.getUTCHours();
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return { time: `${h % 12 === 0 ? 12 : h % 12}:${m}`, meridiem: h < 12 ? 'AM' : 'PM' };
}

/** "Sat 30 Nov · 6:00 – 8:00 PM" (IST). A slot spanning days names both days. */
export function formatSlot(startIso: string, endIso: string): string {
  const s = ist(startIso);
  const e = ist(endIso);
  const a = clock(s);
  const b = clock(e);
  if (dayKey(s) !== dayKey(e)) {
    return `${dayText(s)}, ${a.time} ${a.meridiem} – ${dayText(e)}, ${b.time} ${b.meridiem}`;
  }
  const start = a.meridiem === b.meridiem ? a.time : `${a.time} ${a.meridiem}`;
  return `${dayText(s)} · ${start} – ${b.time} ${b.meridiem}`;
}

export type BookingTab = 'pending' | 'upcoming' | 'past';

/**
 * pending = status pending and not ended; upcoming = confirmed and ending after now;
 * past = everything else (ended, rejected, cancelled).
 */
export function bookingTab<T extends { status: string; end_at: string }>(rows: T[], tab: BookingTab, now: Date): T[] {
  const live = (r: T) => new Date(r.end_at).getTime() > now.getTime();
  const pending = (r: T) => r.status === 'pending' && live(r);
  const upcoming = (r: T) => r.status === 'confirmed' && live(r);
  return rows.filter((r) => (tab === 'pending' ? pending(r) : tab === 'upcoming' ? upcoming(r) : !pending(r) && !upcoming(r)));
}

/** "12 min", "1 h 5 min", or "ongoing 3 min" while unresolved. */
export function sosDuration(createdIso: string, resolvedIso: string | null, now: Date): string {
  const end = resolvedIso ? new Date(resolvedIso).getTime() : now.getTime();
  const mins = Math.max(0, Math.floor((end - new Date(createdIso).getTime()) / 60000));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const text = h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
  return resolvedIso ? text : `ongoing ${text}`;
}
