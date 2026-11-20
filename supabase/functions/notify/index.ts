// Database Webhook target: INSERT on public.visits -> Expo push to the flat's residents.
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildMessages, chunk, type ExpoMessage, type VisitRow } from "./push.ts";

const EXPO_URL = "https://exp.host/--/api/v2/push/send";

type ExpoTicket = { status: "ok" | "error"; details?: { error?: string } };

Deno.serve(async (req) => {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const bearer = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!serviceKey || bearer !== serviceKey) {
    return new Response("unauthorized", { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  if (payload?.type !== "INSERT" || payload?.table !== "visits" || !payload.record) {
    return Response.json({ skipped: "not a visits insert" });
  }
  const visit = payload.record as VisitRow & { flat_id: string; society_id: string };
  const isPending = visit.status === "pending" && visit.pass_id === null;
  if (!isPending && visit.pass_id === null) {
    return Response.json({ skipped: "not notifiable" });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);

  // Current residents: flat link AND a resident membership in the flat's society.
  const { data: links, error: linkErr } = await supabase
    .from("flat_residents").select("profile_id").eq("flat_id", visit.flat_id);
  if (linkErr) return new Response(linkErr.message, { status: 500 });
  const { data: members, error: memErr } = await supabase
    .from("memberships").select("profile_id")
    .eq("society_id", visit.society_id).eq("role", "resident")
    .in("profile_id", (links ?? []).map((l) => l.profile_id));
  if (memErr) return new Response(memErr.message, { status: 500 });
  const profileIds = (members ?? []).map((m) => m.profile_id);
  if (profileIds.length === 0) return Response.json({ sent: 0 });

  const { data: tokenRows, error: tokErr } = await supabase
    .from("push_tokens").select("token").in("profile_id", profileIds);
  if (tokErr) return new Response(tokErr.message, { status: 500 });
  const messages = buildMessages(visit, (tokenRows ?? []).map((t) => t.token));

  const dead: string[] = [];
  for (const batch of chunk<ExpoMessage>(messages, 100)) {
    const res = await fetch(EXPO_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(batch),
    });
    const body = await res.json().catch(() => null);
    console.log("expo push", res.status, JSON.stringify(body));
    const tickets: ExpoTicket[] = body?.data ?? [];
    tickets.forEach((t, i) => {
      if (t.status === "error" && t.details?.error === "DeviceNotRegistered") dead.push(batch[i].to);
    });
  }
  if (dead.length > 0) await supabase.from("push_tokens").delete().in("token", dead);

  return Response.json({ sent: messages.length, removed: dead.length });
});
