// Admin-only account management (service role inside). The gateway verifies the JWT
// (verify_jwt = true); this function re-checks that the caller is an admin of the
// society the target belongs to. POST { action, ... } -> JSON.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  adminOfEvery,
  type BulkRow,
  flatEmail,
  generatePassword,
  groupRows,
  isValidPassword,
  isValidUsername,
  staffEmail,
  usernameFromEmail,
} from "./logic.ts";

// deno-lint-ignore no-explicit-any
type Db = SupabaseClient<any, any, any>;
// deno-lint-ignore no-explicit-any
type Body = Record<string, any>;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/** Thrown to stop a handler with a JSON error. */
class Fail extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
const NOT_AUTHORIZED = () => new Fail(403, "not_authorized");

const isUuid = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

async function isAdmin(db: Db, userId: string, societyId: string): Promise<boolean> {
  const { data } = await db.from("memberships").select("id").eq("profile_id", userId)
    .eq("society_id", societyId).eq("role", "admin").limit(1);
  return (data?.length ?? 0) > 0;
}

async function requireAdmin(db: Db, userId: string, societyId: string | null | undefined) {
  if (!societyId || !(await isAdmin(db, userId, societyId))) throw NOT_AUTHORIZED();
}

/** Societies the user administers. */
async function adminSocieties(db: Db, userId: string): Promise<string[]> {
  const { data } = await db.from("memberships").select("society_id").eq("profile_id", userId).eq("role", "admin");
  return (data ?? []).map((m: Body) => m.society_id);
}

/** Society of a flat, or not_authorized (unknown ids look like missing rights). */
async function flatSociety(db: Db, flatId: unknown): Promise<string> {
  if (!isUuid(flatId)) throw NOT_AUTHORIZED();
  const { data } = await db.from("flats").select("society_id").eq("id", flatId).maybeSingle();
  if (!data) throw NOT_AUTHORIZED();
  return data.society_id;
}

/** Auth user id of the flat's account (resident link whose email is the flat's synthetic one). */
async function findFlatUser(db: Db, flatId: string): Promise<string | null> {
  const { data: links } = await db.from("flat_residents").select("profile_id").eq("flat_id", flatId);
  for (const l of links ?? []) {
    const { data } = await db.auth.admin.getUserById(l.profile_id);
    if (data?.user?.email === flatEmail(flatId)) return data.user.id;
  }
  return null;
}

/** "B1-A-101": same format as flatLabel() in packages/shared. */
async function flatLabelOf(db: Db, flatId: string): Promise<string> {
  const row = await must(db.from("flats").select("number, towers!flats_tower_same_society(name, building)").eq("id", flatId).single()) as Body;
  const t = row.towers;
  const m = String(t.building).match(/(\d+)\s*$/);
  return `${m ? `B${m[1]}` : t.building}-${t.name}-${row.number}`;
}

function checkPassword(p: unknown): string {
  if (!isValidPassword(p)) throw new Fail(400, "invalid_password");
  return p;
}

async function must<T>(p: PromiseLike<{ data?: T; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Fail(500, error.message);
  return data as T;
}

/** Creates auth user + profile + membership (+ flat link). Rolls the auth user back on failure. */
async function createAccount(
  db: Db,
  a: {
    email: string;
    password: string;
    name: string;
    societyId: string;
    role: "resident" | "guard" | "admin";
    flatId?: string;
    /** Staff only: kept in user_metadata so admins can see it (the email is synthetic). */
    username?: string;
  },
): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({
    email: a.email,
    password: a.password,
    email_confirm: true,
    ...(a.username ? { user_metadata: { username: a.username } } : {}),
  });
  if (error || !data.user) {
    if (error && /already|registered|exists/i.test(error.message)) throw new Fail(409, "account_exists");
    throw new Fail(500, error?.message ?? "create_user_failed");
  }
  const id = data.user.id;
  try {
    await must(db.from("profiles").insert({ id, name: a.name, phone: null }));
    await must(db.from("memberships").insert({ profile_id: id, society_id: a.societyId, role: a.role }));
    if (a.flatId) await must(db.from("flat_residents").insert({ flat_id: a.flatId, profile_id: id }));
  } catch (e) {
    await db.auth.admin.deleteUser(id); // cascades profile / membership / link
    throw e;
  }
  return id;
}

async function setUserPassword(db: Db, userId: string, password: string) {
  const { error } = await db.auth.admin.updateUserById(userId, { password });
  if (error) throw new Fail(500, error.message);
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------
async function createFlatAccount(db: Db, caller: string, b: Body) {
  const societyId = await flatSociety(db, b.flat_id);
  await requireAdmin(db, caller, societyId);
  const password = checkPassword(b.password);
  if (await findFlatUser(db, b.flat_id)) throw new Fail(409, "account_exists");
  const user_id = await createAccount(db, {
    email: flatEmail(b.flat_id),
    password,
    name: await flatLabelOf(db, b.flat_id),
    societyId,
    role: "resident",
    flatId: b.flat_id,
  });
  return { user_id };
}

async function setPassword(db: Db, caller: string, b: Body) {
  let userId: string;
  if (b.flat_id !== undefined) {
    await requireAdmin(db, caller, await flatSociety(db, b.flat_id));
    const found = await findFlatUser(db, b.flat_id);
    if (!found) throw new Fail(404, "no_account");
    userId = found;
  } else {
    if (!isUuid(b.user_id)) throw NOT_AUTHORIZED();
    const { data } = await db.from("memberships").select("society_id").eq("profile_id", b.user_id);
    if (!adminOfEvery((data ?? []).map((m: Body) => m.society_id), await adminSocieties(db, caller))) {
      throw NOT_AUTHORIZED(); // must administer EVERY society the target belongs to
    }
    userId = b.user_id;
  }
  await setUserPassword(db, userId, checkPassword(b.password));
  return { ok: true };
}

async function createStaff(db: Db, caller: string, b: Body) {
  if (!isUuid(b.society_id)) throw NOT_AUTHORIZED();
  await requireAdmin(db, caller, b.society_id);
  const username = typeof b.username === "string" ? b.username : "";
  if (!isValidUsername(username)) throw new Fail(400, "invalid_username");
  if (b.role !== "guard" && b.role !== "admin") throw new Fail(400, "invalid_role");
  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name || name.length > 60) throw new Fail(400, "invalid_name");
  const password = checkPassword(b.password);
  try {
    const user_id = await createAccount(db, {
      email: staffEmail(username, b.society_id),
      password,
      name,
      societyId: b.society_id,
      role: b.role,
      username,
    });
    return { user_id, username };
  } catch (e) {
    if (e instanceof Fail && e.message === "account_exists") throw new Fail(409, "username_taken");
    throw e;
  }
}

async function listStaff(db: Db, caller: string, b: Body) {
  if (!isUuid(b.society_id)) throw NOT_AUTHORIZED();
  await requireAdmin(db, caller, b.society_id);
  const rows = await must(
    db.from("memberships").select("profile_id, role, profiles!memberships_profile_id_fkey(name)").eq("society_id", b.society_id)
      .in("role", ["guard", "admin"]),
  ) as Body[];
  return await Promise.all(rows.map(async (m) => {
    const { data } = await db.auth.admin.getUserById(m.profile_id);
    const u = data?.user;
    const banned = u?.banned_until ? new Date(u.banned_until).getTime() > Date.now() : false;
    return {
      user_id: m.profile_id as string,
      name: (m.profiles?.name ?? "") as string,
      role: m.role as string,
      username: (u?.user_metadata?.username as string | undefined) ?? usernameFromEmail(u?.email),
      disabled: banned,
    };
  }));
}

async function disableStaff(db: Db, caller: string, b: Body) {
  if (!isUuid(b.user_id)) throw NOT_AUTHORIZED();
  const { data } = await db.from("memberships").select("society_id").eq("profile_id", b.user_id)
    .in("role", ["guard", "admin"]);
  const mine = new Set(await adminSocieties(db, caller));
  const removable = (data ?? []).map((m: Body) => m.society_id).filter((s: string) => mine.has(s));
  if (removable.length === 0) throw NOT_AUTHORIZED();
  if (b.user_id === caller) throw new Fail(400, "cannot_disable_self");
  // Only staff memberships in societies the caller administers are removed.
  await must(
    db.from("memberships").delete().eq("profile_id", b.user_id).in("role", ["guard", "admin"])
      .in("society_id", removable),
  );
  const { data: left } = await db.from("memberships").select("id").eq("profile_id", b.user_id).limit(1);
  if ((left?.length ?? 0) > 0) throw new Fail(409, "still_member_elsewhere"); // login stays enabled
  const { error } = await db.auth.admin.updateUserById(b.user_id, { ban_duration: "876000h" });
  if (error) throw new Fail(500, error.message);
  return { ok: true };
}

// Each flat costs several sequential round trips; the admin site sends chunks of <= 200 rows.
const MAX_BULK_ROWS = 200;

async function bulkImport(db: Db, caller: string, b: Body) {
  if (!isUuid(b.society_id)) throw NOT_AUTHORIZED();
  await requireAdmin(db, caller, b.society_id);
  const societyId: string = b.society_id;
  if (!Array.isArray(b.rows)) throw new Fail(400, "invalid_rows");
  if (b.rows.length > MAX_BULK_ROWS) throw new Fail(400, "too_many_rows: send at most 200 rows per call");

  const { groups, rowErrors } = groupRows(b.rows as BulkRow[]);
  const results: { row: number; ok: boolean; error?: string; generated_password?: string }[] = rowErrors.map((
    e,
  ) => ({ row: e.row, ok: false, error: e.error }));

  const towers = await must(db.from("towers").select("id, building, name").eq("society_id", societyId)) as {
    id: string;
    building: string;
    name: string;
  }[];
  const towerId = new Map(towers.map((t) => [`${t.building.toLowerCase()}|${t.name}`, t.id]));
  const flats = await must(db.from("flats").select("id, tower_id, number").eq("society_id", societyId)) as {
    id: string;
    tower_id: string;
    number: string;
  }[];
  const flatId = new Map(flats.map((f) => [`${f.tower_id}|${f.number}`, f.id]));

  for (const g of groups) {
    let generated: string | undefined; // reported even if a later step fails
    try {
      const tkey = `${g.building.toLowerCase()}|${g.wing}`; // building matched case-insensitively
      let tid = towerId.get(tkey);
      if (!tid) {
        const t = await must(
          db.from("towers").insert({ society_id: societyId, building: g.building, name: g.wing }).select("id")
            .single(),
        ) as { id: string };
        tid = t.id;
        towerId.set(tkey, tid);
      }
      const fkey = `${tid}|${g.flat}`;
      let fid = flatId.get(fkey);
      if (!fid) {
        const f = await must(
          db.from("flats").insert({ society_id: societyId, tower_id: tid, number: g.flat }).select("id").single(),
        ) as { id: string };
        fid = f.id;
        flatId.set(fkey, fid);
      }

      const existing = await findFlatUser(db, fid);
      if (existing) {
        if (g.password) await setUserPassword(db, existing, g.password);
      } else {
        const password = g.password ?? generatePassword();
        await createAccount(db, {
          email: flatEmail(fid),
          password,
          name: await flatLabelOf(db, fid),
          societyId,
          role: "resident",
          flatId: fid,
        });
        if (!g.password) generated = password; // account exists now: report it even if a later step fails
      }

      if (g.replaceFamily) {
        await must(db.from("family_members").delete().eq("flat_id", fid));
        await must(db.from("family_members").insert(g.members.map((m) => ({
          society_id: societyId,
          flat_id: fid,
          name: m.name,
          phone: m.phone ?? null,
          relation: m.relation ?? null,
        }))));
      }
      g.rows.forEach((row, i) =>
        results.push({ row, ok: true, ...(i === 0 && generated ? { generated_password: generated } : {}) })
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      g.rows.forEach((row, i) =>
        results.push({ row, ok: false, error: msg, ...(i === 0 && generated ? { generated_password: generated } : {}) })
      );
    }
  }
  results.sort((a, b) => a.row - b.row);
  return { results };
}

// ---------------------------------------------------------------------------
const HANDLERS: Record<string, (db: Db, caller: string, b: Body) => Promise<unknown>> = {
  create_flat_account: createFlatAccount,
  set_password: setPassword,
  create_staff: createStaff,
  list_staff: listStaff,
  disable_staff: disableStaff,
  bulk_import: bulkImport,
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const db: Db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data } = token ? await db.auth.getUser(token) : { data: { user: null } };
    if (!data.user) return json(401, { error: "unauthenticated" });

    let body: Body;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "invalid_json" });
    }
    const handler = typeof body?.action === "string" ? HANDLERS[body.action] : undefined;
    if (!handler) return json(400, { error: "unknown_action" });
    return json(200, await handler(db, data.user.id, body));
  } catch (e) {
    if (e instanceof Fail) return json(e.status, { error: e.message });
    console.error("accounts error", e);
    return json(500, { error: "internal_error" });
  }
});
