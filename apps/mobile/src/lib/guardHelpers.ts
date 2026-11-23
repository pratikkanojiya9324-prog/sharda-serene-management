/** Search by code prefix (all-digit query) or by name (case-insensitive contains); empty shows everyone. */
export function matchHelpers<T extends { name: string; entry_code: string }>(list: T[], query: string): T[] {
  const q = query.trim();
  if (!q) return list;
  if (/^\d+$/.test(q)) return list.filter((h) => h.entry_code.startsWith(q));
  const needle = q.toLowerCase();
  return list.filter((h) => h.name.toLowerCase().includes(needle));
}

/**
 * The card to show big for a full 6-digit code. A reissued code can match an
 * inactive and an active helper: the active one wins. Null when ambiguous.
 */
export function exactHelper<T extends { entry_code: string; active: boolean }>(matches: T[], query: string): T | null {
  if (!/^[0-9]{6}$/.test(query.trim())) return null;
  if (matches.length === 1) return matches[0];
  const active = matches.filter((h) => h.active);
  return active.length === 1 ? active[0] : null;
}

/**
 * What the guard can do for a helper. Someone inside can always be checked out
 * (even if blocked or unlinked since); otherwise a blocked helper, or one no
 * flat employs, cannot be checked in.
 */
export function helperAction(
  h: { active: boolean; flatCount: number },
  open: boolean,
): 'check_in' | 'check_out' | 'blocked' | 'unlinked' {
  if (open) return 'check_out';
  if (!h.active) return 'blocked';
  return h.flatCount === 0 ? 'unlinked' : 'check_in';
}
