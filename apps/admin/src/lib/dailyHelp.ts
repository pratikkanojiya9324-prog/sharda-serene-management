// Pure helpers for the Daily help page.

export interface AttendanceRow {
  entry_at: string;
  exit_at: string | null;
}

export type TodayLabel = 'Inside' | 'Left' | 'Not today';

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const sameDay = (iso: string, day: Date) => {
  const d = new Date(iso);
  return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
};

/** Today's status from attendance rows: the latest entry of `today` decides (local calendar day). */
export function todayStatus(rows: AttendanceRow[], today: Date): { label: TodayLabel; time: string | null } {
  const todays = rows.filter((r) => sameDay(r.entry_at, today)).sort((a, b) => b.entry_at.localeCompare(a.entry_at));
  const last = todays[0];
  if (!last) return { label: 'Not today', time: null };
  if (!last.exit_at) return { label: 'Inside', time: clock(last.entry_at) };
  return { label: 'Left', time: clock(last.exit_at) };
}

/** "B1-A-101, B2-B-704" (natural order); a dash when there are none. */
export function flatsText(labels: string[]): string {
  if (labels.length === 0) return '—';
  return [...labels].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join(', ');
}
