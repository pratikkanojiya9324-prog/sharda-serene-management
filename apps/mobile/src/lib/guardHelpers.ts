/** Search by code prefix (all-digit query) or by name (case-insensitive contains); empty shows everyone. */
export function matchHelpers<T extends { name: string; entry_code: string }>(list: T[], query: string): T[] {
  const q = query.trim();
  if (!q) return list;
  if (/^\d+$/.test(q)) return list.filter((h) => h.entry_code.startsWith(q));
  const needle = q.toLowerCase();
  return list.filter((h) => h.name.toLowerCase().includes(needle));
}

/**
 * What the guard can do for a helper. Someone blocked while still inside can
 * be checked out (the DB allows it); a blocked helper cannot be checked in.
 */
export function helperAction(h: { active: boolean }, open: boolean): 'check_in' | 'check_out' | 'blocked' {
  if (open) return 'check_out';
  return h.active ? 'check_in' : 'blocked';
}
