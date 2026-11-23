// Pure helpers for building Expo push messages (no network, no Deno APIs).

export type VisitRow = {
  id: string;
  name: string;
  purpose: string;
  status: string;
  pass_id: string | null;
  expected_entry_id?: string | null;
};

export type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: { visitId: string; type: "visit_request" | "pass_used" };
  priority: "high";
  channelId: "visitor";
  sound: "default";
};

export function buildMessages(visit: VisitRow, tokens: string[]): ExpoMessage[] {
  const viaPass = visit.pass_id !== null;
  return tokens.map((to) => ({
    to,
    title: viaPass ? "Guest arrived" : "Visitor at gate",
    body: viaPass
      ? `${visit.name} entered using your pass`
      : `${visit.name} (${visit.purpose}) is at the gate`,
    data: { visitId: visit.id, type: viaPass ? "pass_used" : "visit_request" },
    priority: "high",
    channelId: "visitor",
    sound: "default",
  }));
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// Round 1: notices, complaints, bills
// ---------------------------------------------------------------------------

export type RoundType =
  | "notice_posted"
  | "complaint_created"
  | "complaint_updated"
  | "bill_created"
  | "bill_paid"
  | "helper_in"
  | "helper_out"
  | "parcel_logged"
  | "parcel_collected"
  | "visit_auto_approved"
  | "poll_created"
  | "poll_reminder"
  | "event_created"
  | "booking_requested"
  | "booking_decided"
  | "sos_raised"
  | "sos_update";

export type RoundMessage = {
  to: string;
  title: string;
  body: string;
  data: { type: RoundType; id: string };
  priority: "high";
  sound: "default";
};

export type NoticeRow = { id: string; title: string };
export type ComplaintRow = { id: string; category: string; status: string };
export type BillRow = {
  id: string;
  amount: number | string;
  due_date: string;
  receipt_no: string | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `in_progress` -> `In progress`, `plumbing` -> `Plumbing`. */
export function titleCase(value: string): string {
  const s = value.replace(/_/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** 2500 -> `₹2,500` (en-IN grouping); fractional amounts keep two decimals. */
export function formatRupees(amount: number | string): string {
  const n = Number(amount);
  const whole = Number.isInteger(n);
  return "₹" + n.toLocaleString("en-IN", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
}

/** `2026-12-10` -> `10 Dec` (string-based, no timezone shifts). */
export function formatDueDate(isoDate: string): string {
  const [, m, d] = isoDate.slice(0, 10).split("-");
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** ISO timestamp -> IST `Sat 30 Nov, 6:00 PM` (fixed +05:30 offset, no Intl). */
export function formatIstDateTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 330 * 60_000);
  const h = d.getUTCHours();
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${h % 12 || 12}:${mm} ${h < 12 ? "AM" : "PM"}`;
}

/** Building 1 / A / 101 -> `B1-A-101`. */
export function flatLabel(building: string, wing: string, number: string): string {
  const digits = building.match(/(\d+)\s*$/)?.[1];
  return `${digits ? `B${digits}` : building}-${wing}-${number}`;
}

function toMessages(
  tokens: string[],
  type: RoundType,
  id: string,
  title: string,
  body: string,
): RoundMessage[] {
  return tokens.map((to) => ({
    to,
    title,
    body,
    data: { type, id },
    priority: "high",
    sound: "default",
  }));
}

export const buildNoticePosted = (n: NoticeRow, tokens: string[]) =>
  toMessages(tokens, "notice_posted", n.id, "New notice", n.title);

export const buildComplaintCreated = (c: ComplaintRow, label: string, tokens: string[]) =>
  toMessages(tokens, "complaint_created", c.id, "New complaint", `${label} · ${titleCase(c.category)}`);

export const buildComplaintStatus = (c: ComplaintRow, tokens: string[]) =>
  toMessages(
    tokens,
    "complaint_updated",
    c.id,
    "Complaint update",
    `Your ${c.category.replace(/_/g, " ")} complaint is now ${titleCase(c.status)}`,
  );

export const buildComplaintReply = (complaintId: string, tokens: string[]) =>
  toMessages(tokens, "complaint_updated", complaintId, "Complaint update", "New reply on your complaint");

export const buildBillCreated = (b: BillRow, tokens: string[]) =>
  toMessages(
    tokens,
    "bill_created",
    b.id,
    "Maintenance bill",
    `${formatRupees(b.amount)} due by ${formatDueDate(b.due_date)}`,
  );

export const buildBillPaid = (b: BillRow, tokens: string[]) =>
  toMessages(tokens, "bill_paid", b.id, "Payment received", `Receipt ${b.receipt_no}`);

// ---------------------------------------------------------------------------
// Round 2: daily help, parcels, auto-approved visits
// ---------------------------------------------------------------------------

export type HelperRow = { name: string; type: string };
export type ParcelRow = { id: string; courier: string; collected_by_name: string | null };

const helperLabel = (h: HelperRow) => `${h.name} (${titleCase(h.type)})`;

export const buildHelperIn = (attendanceId: string, h: HelperRow, tokens: string[]) =>
  toMessages(tokens, "helper_in", attendanceId, "Daily help arrived", `${helperLabel(h)} has entered`);

export const buildHelperOut = (attendanceId: string, h: HelperRow, tokens: string[]) =>
  toMessages(tokens, "helper_out", attendanceId, "Daily help left", `${helperLabel(h)} has left`);

export const buildParcelLogged = (p: ParcelRow, tokens: string[]) =>
  toMessages(tokens, "parcel_logged", p.id, "Parcel at the gate", `${p.courier} parcel is waiting at the gate`);

export const buildParcelCollected = (p: ParcelRow, tokens: string[]) =>
  toMessages(
    tokens,
    "parcel_collected",
    p.id,
    "Parcel collected",
    `${p.courier} parcel collected by ${p.collected_by_name}`,
  );

export const buildVisitAutoApproved = (v: VisitRow, tokens: string[]) =>
  toMessages(
    tokens,
    "visit_auto_approved",
    v.id,
    "Visitor let in",
    `${v.name} (${titleCase(v.purpose)}) entered — you were expecting it`,
  );

/** Messages for a visits INSERT, or null when the visit is not notifiable. */
export function buildVisitInsert(v: VisitRow, tokens: string[]): (ExpoMessage | RoundMessage)[] | null {
  if (v.status === "approved" && v.expected_entry_id) return buildVisitAutoApproved(v, tokens);
  if (v.pass_id !== null || v.status === "pending") return buildMessages(v, tokens);
  return null;
}

// ---------------------------------------------------------------------------
// Round 3: polls, events, amenity bookings, SOS
// ---------------------------------------------------------------------------

export type PollRow = { id: string; question: string };
export type EventRow = { id: string; title: string; place: string | null; starts_at: string };
export type BookingRow = { id: string; status?: string; start_at: string; reject_reason?: string | null };
export type SosRow = {
  id: string;
  type?: string;
  status?: string;
  acknowledged_by_name?: string | null;
  resolved_by_name?: string | null;
};

const SOS_LABELS: Record<string, string> = {
  medical: "Medical",
  fire: "Fire",
  security: "Security",
  lift: "Lift stuck",
  other: "Other",
};

const truncate = (s: string, max: number) => (s.length > max ? s.slice(0, max - 1) + "…" : s);

export const buildPollCreated = (p: PollRow, tokens: string[]) =>
  toMessages(tokens, "poll_created", p.id, "New poll", truncate(p.question, 120));

export const buildPollReminder = (p: PollRow, tokens: string[]) =>
  toMessages(tokens, "poll_reminder", p.id, "Your vote is needed", `Your flat hasn't voted yet: ${p.question}`);

export const buildEventCreated = (e: EventRow, tokens: string[]) => {
  const when = formatIstDateTime(e.starts_at);
  const place = e.place?.trim();
  return toMessages(tokens, "event_created", e.id, `New event: ${e.title}`, place ? `${when} · ${place}` : when);
};

export const buildBookingRequested = (b: BookingRow, label: string, amenity: string, tokens: string[]) =>
  toMessages(
    tokens,
    "booking_requested",
    b.id,
    "Booking request",
    `${label} wants ${amenity} on ${formatIstDateTime(b.start_at)}`,
  );

export const buildBookingDecided = (b: BookingRow, amenity: string, tokens: string[]) => {
  const confirmed = b.status === "confirmed";
  const reason = b.reject_reason?.trim();
  const body = `${amenity} · ${formatIstDateTime(b.start_at)}${!confirmed && reason ? ` — ${reason}` : ""}`;
  return toMessages(tokens, "booking_decided", b.id, confirmed ? "Booking confirmed" : "Booking rejected", body);
};

export const buildSosRaised = (a: SosRow, label: string, tokens: string[]) =>
  toMessages(
    tokens,
    "sos_raised",
    a.id,
    `🚨 SOS — ${SOS_LABELS[a.type ?? ""] ?? "Other"}`,
    `${label} needs help now`,
  );

/** Acknowledged / resolved updates for the flat; open and cancelled send nothing. */
export function buildSosUpdate(a: SosRow, tokens: string[]): RoundMessage[] {
  if (a.status === "acknowledged") {
    const who = a.acknowledged_by_name?.trim();
    return toMessages(tokens, "sos_update", a.id, "Help is on the way", who ? `${who} is coming` : "The guard is coming");
  }
  if (a.status === "resolved") {
    const who = a.resolved_by_name?.trim();
    return toMessages(tokens, "sos_update", a.id, "SOS resolved", `Marked resolved by ${who || "the guard"}`);
  }
  return [];
}
