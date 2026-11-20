// Display formatting for rupees and dates. Done by hand (not Intl) so the output
// is the same on every phone and in tests.

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const SHORT = MONTHS.map((m) => m.slice(0, 3));

/** Indian grouping (12,34,567); paise only when the amount has them. ₹2,500 */
export function formatRupees(amount: number): string {
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);
  const [whole, paise] = abs.toFixed(2).split('.');
  const last3 = whole.slice(-3);
  const rest = whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const grouped = rest ? `${rest},${last3}` : last3;
  return `${sign}₹${grouped}${paise === '00' ? '' : `.${paise}`}`;
}

/** 'YYYY-MM-DD' values are calendar dates: read them as local, not UTC. */
function toDate(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
}

/** Bill period (first of the month) → "November 2026". */
export function formatPeriod(period: string): string {
  const d = toDate(period);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "5 Nov 2026" for a date or timestamp. */
export function formatDate(value: string): string {
  const d = toDate(value);
  return `${d.getDate()} ${SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** "5 Nov 2026, 4:05 PM" */
export function formatDateTime(value: string): string {
  const d = toDate(value);
  const h = d.getHours() % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${formatDate(value)}, ${h}:${mm} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** "4:05 PM" */
export function formatTime(value: string): string {
  return formatDateTime(value).split(', ')[1];
}

/** The local calendar date as 'YYYY-MM-DD' (comparable with DB `date` columns). */
export function localDateString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Short relative time for list rows; older than a week shows the date. */
export function timeAgo(value: string, now: Date = new Date()): string {
  const then = new Date(value);
  const mins = Math.floor((now.getTime() - then.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return formatDate(value);
}

/** "+91 98765 43210" for an Indian E.164 number; anything else unchanged. */
export function formatPhone(phone: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(phone);
  return m ? `+91 ${m[1]} ${m[2]}` : phone;
}
