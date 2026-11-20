// Pure helpers for the accounts function: validation and bulk-import grouping.
// The email/username formats mirror packages/shared/src/flatLabel.ts (kept in sync by
// hand: Edge Functions are deployed without the monorepo, so they cannot import it).

export function flatEmail(flatId: string): string {
  return `flat-${flatId}@login.societygate.app`;
}

export function staffEmail(username: string, societyId: string): string {
  return `${username}@staff.${societyId}.societygate.app`;
}

export function isValidUsername(u: string): boolean {
  return /^[a-z0-9_.-]{3,30}$/.test(u);
}

export function isValidPassword(p: unknown): p is string {
  return typeof p === "string" && p.length >= 6;
}

// No 0/O/1/I/l: generated passwords get read out or typed from a printed list.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

export function generatePassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** True when every target society is one the caller administers (and there is at least one). */
export function adminOfEvery(targetSocieties: string[], callerAdminSocieties: string[]): boolean {
  const mine = new Set(callerAdminSocieties);
  return targetSocieties.length > 0 && targetSocieties.every((s) => mine.has(s));
}

export type BulkRow = {
  building?: unknown;
  wing?: unknown;
  flat?: unknown;
  password?: unknown;
  member_name?: unknown;
  member_phone?: unknown;
  relation?: unknown;
};

export type Member = { name: string; phone?: string; relation?: string };
export type CleanRow = { building: string; wing: string; flat: string; password?: string; member?: Member };
export type RowCheck = { ok: true; value: CleanRow } | { ok: false; error: string };

const text = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

export function validateRow(r: BulkRow): RowCheck {
  const building = text(r.building).replace(/\s+/g, " ");
  const wing = text(r.wing).toUpperCase();
  const flat = text(r.flat);
  if (!building) return { ok: false, error: "building is required" };
  if (building.length > 40) return { ok: false, error: "building must be at most 40 characters" };
  if (!wing) return { ok: false, error: "wing is required" };
  if (!/^[A-Z0-9]{1,5}$/.test(wing)) return { ok: false, error: "wing must be 1-5 letters or digits" };
  if (!flat) return { ok: false, error: "flat is required" };
  if (!/^[A-Za-z0-9-]{1,10}$/.test(flat)) return { ok: false, error: "flat must be 1-10 letters, digits or dashes" };

  const password = text(r.password) || undefined;
  if (password !== undefined && !isValidPassword(password)) {
    return { ok: false, error: "password must be at least 6 characters" };
  }

  const name = text(r.member_name);
  const phoneRaw = text(r.member_phone);
  const relation = text(r.relation);
  let member: Member | undefined;
  if (name) {
    const phone = phoneRaw.replace(/[\s-]/g, "");
    if (phone && !/^\+?\d{7,15}$/.test(phone)) return { ok: false, error: "member_phone must be 7-15 digits" };
    if (name.length > 60) return { ok: false, error: "member_name must be at most 60 characters" };
    if (relation.length > 60) return { ok: false, error: "relation must be at most 60 characters" };
    member = { name, phone: phone || undefined, relation: relation || undefined };
  } else if (phoneRaw || relation) {
    return { ok: false, error: "member_name is required when member_phone or relation is given" };
  }
  return { ok: true, value: { building, wing, flat, password, member } };
}

export type FlatGroup = {
  building: string;
  wing: string;
  flat: string;
  /** 1-based row numbers that belong to this flat. */
  rows: number[];
  /** First non-blank password among the rows; undefined keeps the existing one. */
  password?: string;
  members: Member[];
  /** True when any row names a member: the flat's family is then replaced wholesale. */
  replaceFamily: boolean;
};

/**
 * Validates rows and groups them by (building, wing, flat). A flat with any invalid row
 * is skipped entirely, so its family list is never half-replaced.
 */
export function groupRows(rows: BulkRow[]): { groups: FlatGroup[]; rowErrors: { row: number; error: string }[] } {
  const errors = new Map<number, string>();
  const byKey = new Map<string, { rows: number[]; clean: CleanRow[]; bad: boolean }>();
  const order: string[] = [];

  rows.forEach((r, i) => {
    const row = i + 1;
    const v = validateRow(r ?? {});
    if (!v.ok) {
      errors.set(row, v.error);
      // The flat key may still be usable, so poison its group.
      const key = [text(r?.building).replace(/\s+/g, " "), text(r?.wing).toUpperCase(), text(r?.flat)].join("|");
      if (text(r?.building) && text(r?.wing) && text(r?.flat)) {
        const g = byKey.get(key) ?? (order.push(key), byKey.set(key, { rows: [], clean: [], bad: false }).get(key)!);
        g.rows.push(row);
        g.bad = true;
      }
      return;
    }
    const { building, wing, flat } = v.value;
    const key = [building, wing, flat].join("|");
    const g = byKey.get(key) ?? (order.push(key), byKey.set(key, { rows: [], clean: [], bad: false }).get(key)!);
    g.rows.push(row);
    g.clean.push(v.value);
  });

  const groups: FlatGroup[] = [];
  for (const key of order) {
    const g = byKey.get(key)!;
    if (g.bad) {
      for (const row of g.rows) if (!errors.has(row)) errors.set(row, "skipped: another row for this flat is invalid");
      continue;
    }
    const first = g.clean[0];
    const members = g.clean.flatMap((c) => (c.member ? [c.member] : []));
    groups.push({
      building: first.building,
      wing: first.wing,
      flat: first.flat,
      rows: g.rows,
      password: g.clean.find((c) => c.password)?.password,
      members,
      replaceFamily: members.length > 0,
    });
  }
  const rowErrors = [...errors].map(([row, error]) => ({ row, error })).sort((a, b) => a.row - b.row);
  return { groups, rowErrors };
}
