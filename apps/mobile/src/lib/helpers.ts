import { HELPER_TYPES, type HelperType } from '@society-gate/shared';
import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Attendance = { entry_at: string; exit_at: string | null };

export function helperTypeLabel(t: HelperType): string {
  return HELPER_TYPES.find((h) => h.value === t)?.label ?? 'Other';
}

const ICONS: Record<HelperType, IconName> = {
  maid: 'sparkles',
  cook: 'restaurant',
  driver: 'car',
  nanny: 'happy',
  car_cleaner: 'water',
  tutor: 'school',
  other: 'person',
};

export function helperTypeIcon(t: HelperType): IconName {
  return ICONS[t] ?? 'person';
}

/** Distinct local calendar days with an entry in the month of `monthStart`, and the latest entry in that month. */
export function attendanceSummary(
  rows: Attendance[],
  monthStart: Date,
): { daysPresent: number; lastEntry: string | null } {
  const days = new Set<number>();
  let lastEntry: string | null = null;
  for (const r of rows) {
    const t = new Date(r.entry_at);
    if (t.getFullYear() !== monthStart.getFullYear() || t.getMonth() !== monthStart.getMonth()) continue;
    days.add(t.getDate());
    if (!lastEntry || t.getTime() > new Date(lastEntry).getTime()) lastEntry = r.entry_at;
  }
  return { daysPresent: days.size, lastEntry };
}

/** The helper has an open attendance row (checked in, not out). */
export function insideNow(rows: Attendance[]): boolean {
  return rows.some((r) => r.exit_at === null);
}

/** First day of the month containing `d`, local midnight. */
export function monthStartOf(d: Date = new Date()): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Rows whose entry falls on the same local calendar day as `day`. */
export function rowsOnDay<T extends Attendance>(rows: T[], day: Date): T[] {
  return rows.filter((r) => {
    const t = new Date(r.entry_at);
    return t.getFullYear() === day.getFullYear() && t.getMonth() === day.getMonth() && t.getDate() === day.getDate();
  });
}
