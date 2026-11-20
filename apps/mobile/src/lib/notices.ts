/** Pinned notices first, then newest first. Returns a new array. */
export function sortNotices<T extends { pinned: boolean; created_at: string }>(notices: readonly T[]): T[] {
  return [...notices].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.created_at.localeCompare(a.created_at);
  });
}
