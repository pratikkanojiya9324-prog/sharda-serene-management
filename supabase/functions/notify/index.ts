// Webhook-style target for the notify triggers (visits, notices, complaints,
// complaint_comments, bills) -> Expo push. Payload: { type, table, record, old_record }.
// Auth: the trigger sends `Authorization: Bearer <NOTIFY_SECRET>` (gateway JWT check
// is off for this function, see supabase/config.toml). DB access uses the
// auto-provided SUPABASE_SERVICE_ROLE_KEY. Recipients are resolved server-side.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { isAuthorized } from "./auth.ts";
import { sendBatch } from "./expo.ts";
import {
  buildBillCreated,
  buildBillPaid,
  buildBookingDecided,
  buildBookingRequested,
  buildComplaintCreated,
  buildComplaintReply,
  buildComplaintStatus,
  buildEventCreated,
  buildHelperIn,
  buildHelperOut,
  buildParcelCollected,
  buildParcelLogged,
  buildPollCreated,
  buildPollReminder,
  buildSosRaised,
  buildSosUpdate,
  buildVisitInsert,
  buildNoticePosted,
  chunk,
  type BookingRow,
  type ExpoMessage,
  flatLabel,
  type ParcelRow,
  type RoundMessage,
  type SosRow,
  type VisitRow,
} from "./push.ts";

type Row = Record<string, any>;
type Tokens = { tokens: string[] } | { error: string };

// deno-lint-ignore no-explicit-any
async function tokensFor(supabase: SupabaseClient<any, any, any>, profileIds: string[]): Promise<Tokens> {
  if (profileIds.length === 0) return { tokens: [] };
  const { data, error } = await supabase.from("push_tokens").select("token").in("profile_id", profileIds);
  if (error) return { error: error.message };
  return { tokens: (data ?? []).map((t: Row) => t.token) };
}

/** Profiles with a membership of `role` in the society (optionally limited to `only`). */
async function memberProfiles(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  societyId: string,
  role: "resident" | "admin" | "guard",
  only?: string[],
): Promise<string[] | { error: string }> {
  if (only && only.length === 0) return [];
  let q = supabase.from("memberships").select("profile_id").eq("society_id", societyId).eq("role", role);
  if (only) q = q.in("profile_id", only);
  const { data, error } = await q;
  if (error) return { error: error.message };
  return (data ?? []).map((m: Row) => m.profile_id);
}

/** Resident members linked to the flat (and resident in the flat's society). */
// deno-lint-ignore no-explicit-any
async function flatTokens(supabase: SupabaseClient<any, any, any>, flatId: string, societyId: string): Promise<Tokens> {
  const { data: links, error } = await supabase.from("flat_residents").select("profile_id").eq("flat_id", flatId);
  if (error) return { error: error.message };
  const ids = await memberProfiles(supabase, societyId, "resident", (links ?? []).map((l: Row) => l.profile_id));
  if ("error" in ids) return ids;
  return tokensFor(supabase, ids);
}

// deno-lint-ignore no-explicit-any
async function societyTokens(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  societyId: string,
  ...roles: ("resident" | "admin" | "guard")[]
): Promise<Tokens> {
  const ids = new Set<string>();
  for (const role of roles) {
    const r = await memberProfiles(supabase, societyId, role);
    if ("error" in r) return r;
    r.forEach((id) => ids.add(id));
  }
  return tokensFor(supabase, [...ids]);
}

/** Tokens of residents in flats of the society that have no vote on the poll. */
async function nonVotingFlatTokens(
  // deno-lint-ignore no-explicit-any
  supabase: SupabaseClient<any, any, any>,
  pollId: string,
  societyId: string,
): Promise<Tokens> {
  const { data: flats, error: fErr } = await supabase.from("flats").select("id").eq("society_id", societyId);
  if (fErr) return { error: fErr.message };
  const { data: votes, error: vErr } = await supabase.from("poll_votes").select("flat_id").eq("poll_id", pollId);
  if (vErr) return { error: vErr.message };
  const voted = new Set((votes ?? []).map((v: Row) => v.flat_id));
  const open = (flats ?? []).map((f: Row) => f.id).filter((id: string) => !voted.has(id));
  if (open.length === 0) return { tokens: [] };
  const { data: links, error: lErr } = await supabase.from("flat_residents").select("profile_id").in("flat_id", open);
  if (lErr) return { error: lErr.message };
  const ids = await memberProfiles(supabase, societyId, "resident", [...new Set<string>((links ?? []).map((l: Row) => l.profile_id))]);
  if ("error" in ids) return ids;
  return tokensFor(supabase, ids);
}

// deno-lint-ignore no-explicit-any
async function complaintFlatLabel(supabase: SupabaseClient<any, any, any>, flatId: string): Promise<string> {
  const { data, error } = await supabase
    .from("flats").select("number, towers!flats_tower_id_fkey(name, building)").eq("id", flatId).maybeSingle();
  if (error) console.error("complaintFlatLabel failed", error.message);
  // deno-lint-ignore no-explicit-any
  const tower = (data as any)?.towers;
  if (!data || !tower) return "Flat";
  return flatLabel(tower.building, tower.name, data.number);
}

// deno-lint-ignore no-explicit-any
async function amenityName(supabase: SupabaseClient<any, any, any>, amenityId: string): Promise<string> {
  const { data, error } = await supabase.from("amenities").select("name").eq("id", amenityId).maybeSingle();
  if (error) console.error("amenityName failed", error.message);
  return data?.name ?? "the amenity";
}

// deno-lint-ignore no-explicit-any
async function sendAll(supabase: SupabaseClient<any, any, any>, messages: (ExpoMessage | RoundMessage)[]) {
  const dead: string[] = [];
  let failedBatches = 0;
  for (const batch of chunk(messages, 100)) {
    const { ok, tickets } = await sendBatch(batch as ExpoMessage[]);
    if (!ok) failedBatches++;
    tickets.forEach((t, i) => {
      if (t.status === "error" && t.details?.error === "DeviceNotRegistered") dead.push(batch[i].to);
    });
  }
  if (dead.length > 0) await supabase.from("push_tokens").delete().in("token", dead);
  return Response.json({ sent: messages.length, failedBatches, removed: dead.length });
}

const skip = (why: string) => Response.json({ skipped: why });
const fail = (message: string) => new Response(message, { status: 500 });

Deno.serve(async (req) => {
  if (!isAuthorized(req.headers.get("Authorization"), Deno.env.get("NOTIFY_SECRET"))) {
    return new Response("unauthorized", { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const record = payload?.record as Row | undefined;
  const old = payload?.old_record as Row | undefined;
  if (!payload || !record) return skip("no record");

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const kind = `${payload.table}:${payload.type}`;
  let built: { tokens: string[] } | { error: string };
  let make: (tokens: string[]) => (ExpoMessage | RoundMessage)[];

  switch (kind) {
    case "visits:INSERT": {
      const visit = record as VisitRow & { flat_id: string; society_id: string };
      if (buildVisitInsert(visit, []) === null) return skip("not notifiable");
      built = await flatTokens(supabase, visit.flat_id, visit.society_id);
      make = (t) => buildVisitInsert(visit, t) ?? [];
      break;
    }
    case "helper_attendance:INSERT":
    case "helper_attendance:UPDATE": {
      const isIn = payload.type === "INSERT";
      if (!isIn && (!old || old.exit_at !== null || record.exit_at === null)) return skip("not an exit");
      const { data: helper, error: hErr } = await supabase
        .from("helpers").select("name, type").eq("id", record.helper_id).maybeSingle();
      if (hErr) return fail(hErr.message);
      if (!helper) return skip("helper not found");
      const { data: links, error: lErr } = await supabase
        .from("helper_flats").select("flat_id").eq("helper_id", record.helper_id);
      if (lErr) return fail(lErr.message);
      const tokens = new Set<string>();
      for (const l of links ?? []) {
        const r = await flatTokens(supabase, l.flat_id, record.society_id);
        if ("error" in r) return fail(r.error);
        r.tokens.forEach((x) => tokens.add(x));
      }
      built = { tokens: [...tokens] };
      make = (t) => (isIn ? buildHelperIn : buildHelperOut)(record.id, helper, t);
      break;
    }
    case "parcels:INSERT":
      built = await flatTokens(supabase, record.flat_id, record.society_id);
      make = (t) => buildParcelLogged(record as ParcelRow, t);
      break;
    case "parcels:UPDATE":
      if (!old || old.status === "collected" || record.status !== "collected") return skip("not a collection");
      built = await flatTokens(supabase, record.flat_id, record.society_id);
      make = (t) => buildParcelCollected(record as ParcelRow, t);
      break;
    case "notices:INSERT":
      built = await societyTokens(supabase, record.society_id, "resident");
      make = (t) => buildNoticePosted({ id: record.id, title: record.title }, t);
      break;
    case "complaints:INSERT": {
      const label = await complaintFlatLabel(supabase, record.flat_id);
      built = await societyTokens(supabase, record.society_id, "admin");
      make = (t) => buildComplaintCreated({ id: record.id, category: record.category, status: record.status }, label, t);
      break;
    }
    case "complaints:UPDATE":
      if (!old || old.status === record.status) return skip("status unchanged");
      built = await flatTokens(supabase, record.flat_id, record.society_id);
      make = (t) => buildComplaintStatus({ id: record.id, category: record.category, status: record.status }, t);
      break;
    case "complaint_comments:INSERT": {
      const { data: c, error } = await supabase
        .from("complaints").select("flat_id").eq("id", record.complaint_id).maybeSingle();
      if (error) return fail(error.message);
      if (!c) return skip("complaint not found");
      built = await flatTokens(supabase, c.flat_id, record.society_id);
      make = (t) => buildComplaintReply(record.complaint_id, t);
      break;
    }
    case "bills:INSERT":
      built = await flatTokens(supabase, record.flat_id, record.society_id);
      make = (t) => buildBillCreated(
        { id: record.id, amount: record.amount, due_date: record.due_date, receipt_no: record.receipt_no }, t);
      break;
    case "bills:UPDATE":
      if (!old || old.status === "paid" || record.status !== "paid") return skip("not a payment");
      built = await flatTokens(supabase, record.flat_id, record.society_id);
      make = (t) => buildBillPaid(
        { id: record.id, amount: record.amount, due_date: record.due_date, receipt_no: record.receipt_no }, t);
      break;
    case "polls:INSERT":
      built = await societyTokens(supabase, record.society_id, "resident");
      make = (t) => buildPollCreated({ id: record.id, question: record.question }, t);
      break;
    case "polls:UPDATE":
      if (!old || !record.last_reminded_at || old.last_reminded_at === record.last_reminded_at) {
        return skip("not a reminder");
      }
      built = await nonVotingFlatTokens(supabase, record.id, record.society_id);
      make = (t) => buildPollReminder({ id: record.id, question: record.question }, t);
      break;
    case "events:INSERT":
      built = await societyTokens(supabase, record.society_id, "resident");
      make = (t) => buildEventCreated(
        { id: record.id, title: record.title, place: record.place, starts_at: record.starts_at }, t);
      break;
    case "amenity_bookings:INSERT": {
      if (record.status !== "pending") return skip("not pending");
      const [label, amenity] = await Promise.all([
        complaintFlatLabel(supabase, record.flat_id),
        amenityName(supabase, record.amenity_id),
      ]);
      built = await societyTokens(supabase, record.society_id, "admin");
      make = (t) => buildBookingRequested(record as BookingRow, label, amenity, t);
      break;
    }
    case "amenity_bookings:UPDATE": {
      if (!old || old.status !== "pending" || !["confirmed", "rejected"].includes(record.status)) {
        return skip("not a decision");
      }
      const amenity = await amenityName(supabase, record.amenity_id);
      built = await flatTokens(supabase, record.flat_id, record.society_id);
      make = (t) => buildBookingDecided(record as BookingRow, amenity, t);
      break;
    }
    case "sos_alerts:INSERT": {
      const label = await complaintFlatLabel(supabase, record.flat_id);
      built = await societyTokens(supabase, record.society_id, "guard", "admin");
      make = (t) => buildSosRaised(record as SosRow, label, t);
      break;
    }
    case "sos_alerts:UPDATE":
      // cancelled (and any other status) sends nothing
      if (!old || old.status === record.status || buildSosUpdate(record as SosRow, ["x"]).length === 0) {
        return skip("not an SOS update");
      }
      built = await flatTokens(supabase, record.flat_id, record.society_id);
      make = (t) => buildSosUpdate(record as SosRow, t);
      break;
    default:
      return skip(`unhandled ${kind}`);
  }

  if ("error" in built) return fail(built.error);
  if (built.tokens.length === 0) return Response.json({ sent: 0 });
  return sendAll(supabase, make(built.tokens));
});
