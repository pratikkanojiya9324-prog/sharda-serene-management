// Asia/Kolkata (UTC+5:30, no daylight saving) date helpers, done by hand so
// phones and tests agree regardless of the device time zone.

export const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** A Date whose UTC fields read as IST wall-clock time. */
export function istParts(value: Date | string): Date {
  return new Date(new Date(value).getTime() + IST_OFFSET_MS);
}

export function weekdayShort(ist: Date): string {
  return WEEKDAYS[ist.getUTCDay()];
}

export function monthShort(ist: Date): string {
  return MONTHS[ist.getUTCMonth()];
}

/** "6:00 PM" from IST wall-clock fields. */
export function clock12(ist: Date): string {
  const h = ist.getUTCHours() % 12 || 12;
  return `${h}:${String(ist.getUTCMinutes()).padStart(2, '0')} ${ist.getUTCHours() < 12 ? 'AM' : 'PM'}`;
}

/** "Sat 30 Nov, 6:00 PM" in IST. */
export function formatIst(value: string): string {
  const d = istParts(value);
  return `${weekdayShort(d)} ${d.getUTCDate()} ${monthShort(d)}, ${clock12(d)}`;
}

/** The IST calendar date as YYYY-MM-DD. */
export function istDateKey(d: Date): string {
  return istParts(d).toISOString().slice(0, 10);
}

/** Midnight IST at the start of a YYYY-MM-DD date. */
export function istDayStart(dateKey: string): Date {
  return new Date(new Date(`${dateKey}T00:00:00Z`).getTime() - IST_OFFSET_MS);
}
