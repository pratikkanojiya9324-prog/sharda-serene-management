/** "Building 2", "B", "704" -> "B2-B-704". Falls back to the raw building text if it has no number. */
export function flatLabel(building: string, wing: string, number: string): string {
  const m = building.match(/(\d+)\s*$/);
  const b = m ? `B${m[1]}` : building;
  return `${b}-${wing}-${number}`;
}

/** Synthetic login email for a flat account. Never displayed to users. */
export function flatEmail(flatId: string): string {
  return `flat-${flatId}@login.societygate.app`;
}

/** Synthetic login email for a staff account. Never displayed to users. */
export function staffEmail(username: string, societyId: string): string {
  return `${username}@staff.${societyId}.societygate.app`;
}

export function isValidUsername(u: string): boolean {
  return /^[a-z0-9_.-]{3,30}$/.test(u);
}
