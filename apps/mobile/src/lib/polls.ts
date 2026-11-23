// Pure helpers for polls (resident + office app). Date maths use Asia/Kolkata
// (UTC+5:30, no daylight saving) by hand so phones and tests agree.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export type PollTimes = { closes_at: string; closed_at: string | null };
export type PollOption = { id: string; label: string };
export type ResultBar = { id: string; label: string; count: number; pct: number; mine: boolean };

/** Open means not closed early and before closes_at (same rule as the database). */
export function pollIsOpen(p: PollTimes, now: Date): boolean {
  return p.closed_at === null && now.getTime() < new Date(p.closes_at).getTime();
}

const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`;

/** "Closes in 3 days" / "Closes in 5 hours" / "Closes in 20 min" / "Closed". */
export function closesLabel(p: PollTimes, now: Date): string {
  if (!pollIsOpen(p, now)) return 'Closed';
  const left = new Date(p.closes_at).getTime() - now.getTime();
  if (left >= DAY) return `Closes in ${plural(Math.floor(left / DAY), 'day')}`;
  if (left >= HOUR) return `Closes in ${plural(Math.floor(left / HOUR), 'hour')}`;
  return `Closes in ${Math.max(1, Math.floor(left / MIN))} min`;
}

/** null when the selection can be submitted, otherwise text to show. */
export function selectionError(p: { multi: boolean; max_choices: number }, selected: string[]): string | null {
  if (selected.length < 1) return 'Choose an option';
  if (selected.length > p.max_choices) return `You can pick up to ${p.max_choices}`;
  return null;
}

export function resultBars(
  options: PollOption[],
  counts: Record<string, number> | null,
  myOptionIds: string[],
): ResultBar[] {
  const total = options.reduce((sum, o) => sum + (counts?.[o.id] ?? 0), 0);
  return options.map((o) => {
    const count = counts?.[o.id] ?? 0;
    return {
      id: o.id,
      label: o.label,
      count,
      // Share of all choices made (multi-choice polls can pass 100% in sum).
      pct: total ? Math.round((count / total) * 100) : 0,
      mine: myOptionIds.includes(o.id),
    };
  });
}

/** "12 of 40 flats voted (30%)" */
export function turnoutText(voted: number, total: number): string {
  const pct = total ? Math.round((voted / total) * 100) : 0;
  return `${voted} of ${total} flats voted (${pct}%)`;
}

/** The moment polls close: 9:00 PM IST, `days` days after today's IST date. */
export function closesAtForDays(days: number, now: Date): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const utc21Ist = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + days, 21, 0);
  return new Date(utc21Ist - IST_OFFSET_MS);
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Sat 30 Nov, 6:00 PM" in IST. */
export function formatIst(value: string): string {
  const d = new Date(new Date(value).getTime() + IST_OFFSET_MS);
  const h = d.getUTCHours() % 12 || 12;
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${h}:${mm} ${d.getUTCHours() < 12 ? 'AM' : 'PM'}`;
}

/** polls.options is jsonb: keep only well-formed {id, label} entries, in order. */
export function parseOptions(value: unknown): PollOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((o) => {
    const { id, label } = (o ?? {}) as { id?: unknown; label?: unknown };
    return typeof id === 'string' && typeof label === 'string' ? [{ id, label }] : [];
  });
}

export type PollResults = {
  counts: Record<string, number> | null;
  votedFlats: number;
  totalFlats: number;
  myVote: { optionIds: string[]; by: string | null; at: string } | null;
  notVoted: string[] | null;
  isOpen: boolean;
};

/** Reads the `poll_results` jsonb. */
export function parseResults(value: unknown): PollResults | null {
  if (!value || typeof value !== 'object') return null;
  const r = value as Record<string, unknown>;
  const my = r.my_vote as { option_ids?: string[]; voted_by_name?: string | null; voted_at?: string } | null | undefined;
  return {
    counts: r.counts && typeof r.counts === 'object' ? (r.counts as Record<string, number>) : null,
    votedFlats: Number(r.voted_flats ?? 0),
    totalFlats: Number(r.total_flats ?? 0),
    myVote: my ? { optionIds: my.option_ids ?? [], by: my.voted_by_name ?? null, at: my.voted_at ?? '' } : null,
    notVoted: Array.isArray(r.not_voted) ? (r.not_voted as string[]) : null,
    isOpen: r.is_open === true,
  };
}
