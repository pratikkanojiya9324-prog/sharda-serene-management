// Pure helpers for amenities, events, documents and the directory (resident app).
import { DOC_CATEGORIES, type DocCategory } from '@society-gate/shared';

import { clock12, istDateKey, istParts, monthShort, weekdayShort } from './ist';
import type { Tone } from '@/theme/tokens';

const DAY_MS = 24 * 60 * 60 * 1000;

/** `days` booking dates from today (IST): "Today", "Tomorrow", then "Wed 26". */
export function dateChips(now: Date, days = 15): { date: string; label: string }[] {
  const todayMs = new Date(`${istDateKey(now)}T00:00:00Z`).getTime();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(todayMs + i * DAY_MS);
    return {
      date: d.toISOString().slice(0, 10),
      label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : `${weekdayShort(d)} ${d.getUTCDate()}`,
    };
  });
}

/** "6:00 – 7:00 PM" (meridiem shared when equal); "Full day" for a whole-day slot. */
export function slotLabel(startIso: string, endIso: string, slotMinutes?: number): string {
  const s = istParts(startIso);
  const e = istParts(endIso);
  if (slotMinutes === 1440 || e.getTime() - s.getTime() >= DAY_MS) return 'Full day';
  const start = clock12(s);
  const end = clock12(e);
  const sameHalf = start.slice(-2) === end.slice(-2);
  return `${sameHalf ? start.slice(0, -3) : start} – ${end}`;
}

export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled';

export function bookingPill(status: BookingStatus): { label: string; tone: Tone } {
  switch (status) {
    case 'pending':
      return { label: 'Waiting for approval', tone: 'warning' };
    case 'confirmed':
      return { label: 'Confirmed', tone: 'success' };
    case 'rejected':
      return { label: 'Rejected', tone: 'danger' };
    case 'cancelled':
      return { label: 'Cancelled', tone: 'neutral' };
  }
}

/** "12 flats going · 31 people" */
export function rsvpText(s: { going_flats: number; going_heads: number }): string {
  const flats = `${s.going_flats} flat${s.going_flats === 1 ? '' : 's'} going`;
  return `${flats} · ${s.going_heads} ${s.going_heads === 1 ? 'person' : 'people'}`;
}

/** Case-insensitive match on name or flat label; a blank query keeps everything. */
export function filterDirectory<T extends { name: string; flat_label: string }>(rows: T[], q: string): T[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((r) => r.name.toLowerCase().includes(needle) || r.flat_label.toLowerCase().includes(needle));
}

/** Documents grouped by category in the fixed category order; empty groups dropped. */
export function groupDocuments<T extends { category: DocCategory }>(
  docs: T[],
): { category: DocCategory; label: string; items: T[] }[] {
  return DOC_CATEGORIES.map((c) => ({
    category: c.value,
    label: c.label,
    items: docs.filter((d) => d.category === c.value),
  })).filter((g) => g.items.length);
}

/** Short date for a day heading: "Thu 26 Nov". */
export function dayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  return `${weekdayShort(d)} ${d.getUTCDate()} ${monthShort(d)}`;
}

/** A time-of-day column ("06:00:00") as "6:00 AM". */
export function timeText(t: string): string {
  const [h, m] = t.split(':').map(Number);
  return clock12(new Date(Date.UTC(2000, 0, 1, h, m)));
}

/** "1 hr slots", "30 min slots", "Full day". */
export function slotLengthText(minutes: number): string {
  if (minutes === 1440) return 'Full day';
  return minutes % 60 === 0 ? `${minutes / 60} hr slots` : `${minutes} min slots`;
}

/** Not cancelled and not over yet (an event without an end time lasts until it starts). */
export function isUpcomingEvent(e: { starts_at: string; ends_at: string | null; cancelled_at: string | null }, now: Date): boolean {
  return !e.cancelled_at && new Date(e.ends_at ?? e.starts_at).getTime() > now.getTime();
}
