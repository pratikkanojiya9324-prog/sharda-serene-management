import { assertEquals } from "jsr:@std/assert@1";
import {
  buildBookingDecided,
  buildBookingRequested,
  buildEventCreated,
  buildPollCreated,
  buildPollReminder,
  buildSosRaised,
  buildSosUpdate,
  formatIstDateTime,
} from "./push.ts";

const T = ["ExponentPushToken[a]", "ExponentPushToken[b]"];
const base = { priority: "high", sound: "default" };
// 2024-11-30 12:30 UTC = Sat 30 Nov, 6:00 PM IST
const START = "2024-11-30T12:30:00+00:00";
const WHEN = "Sat 30 Nov, 6:00 PM";

Deno.test("formatIstDateTime", () => {
  assertEquals(formatIstDateTime(START), WHEN);
  assertEquals(formatIstDateTime("2024-12-01T18:45:00Z"), "Mon 2 Dec, 12:15 AM");
  assertEquals(formatIstDateTime("2024-12-03T06:30:00Z"), "Tue 3 Dec, 12:00 PM");
});

Deno.test("poll_created", () => {
  const m = buildPollCreated({ id: "p1", question: "Repaint the clubhouse?" }, T);
  assertEquals(m.length, 2);
  assertEquals(m[0], {
    to: T[0], title: "New poll", body: "Repaint the clubhouse?",
    data: { type: "poll_created", id: "p1" }, ...base,
  });
});

Deno.test("poll_created truncates long questions to 120 chars with ellipsis", () => {
  const [m] = buildPollCreated({ id: "p1", question: "x".repeat(150) }, [T[0]]);
  assertEquals(m.body, "x".repeat(119) + "…");
  assertEquals(m.body.length, 120);
  const [exact] = buildPollCreated({ id: "p1", question: "y".repeat(120) }, [T[0]]);
  assertEquals(exact.body, "y".repeat(120));
});

Deno.test("poll_reminder", () => {
  assertEquals(buildPollReminder({ id: "p1", question: "Repaint?" }, [T[0]]), [{
    to: T[0], title: "Your vote is needed", body: "Your flat hasn't voted yet: Repaint?",
    data: { type: "poll_reminder", id: "p1" }, ...base,
  }]);
});

Deno.test("event_created with and without place", () => {
  assertEquals(buildEventCreated({ id: "e1", title: "Diwali Mela", place: "Clubhouse", starts_at: START }, [T[0]]), [{
    to: T[0], title: "New event: Diwali Mela", body: `${WHEN} · Clubhouse`,
    data: { type: "event_created", id: "e1" }, ...base,
  }]);
  assertEquals(buildEventCreated({ id: "e1", title: "Diwali Mela", place: null, starts_at: START }, [T[0]])[0].body, WHEN);
  assertEquals(buildEventCreated({ id: "e1", title: "Diwali Mela", place: "  ", starts_at: START }, [T[0]])[0].body, WHEN);
});

Deno.test("booking_requested", () => {
  assertEquals(buildBookingRequested({ id: "b1", start_at: START }, "B1-A-101", "Party hall", [T[0]]), [{
    to: T[0], title: "Booking request", body: `B1-A-101 wants Party hall on ${WHEN}`,
    data: { type: "booking_requested", id: "b1" }, ...base,
  }]);
});

Deno.test("booking_decided confirmed", () => {
  const b = { id: "b1", status: "confirmed", start_at: START, reject_reason: null };
  assertEquals(buildBookingDecided(b, "Party hall", [T[0]]), [{
    to: T[0], title: "Booking confirmed", body: `Party hall · ${WHEN}`,
    data: { type: "booking_decided", id: "b1" }, ...base,
  }]);
});

Deno.test("booking_decided rejected with and without reason", () => {
  const b = { id: "b1", status: "rejected", start_at: START, reject_reason: "Maintenance day" };
  assertEquals(buildBookingDecided(b, "Party hall", [T[0]]), [{
    to: T[0], title: "Booking rejected", body: `Party hall · ${WHEN} — Maintenance day`,
    data: { type: "booking_decided", id: "b1" }, ...base,
  }]);
  assertEquals(buildBookingDecided({ ...b, reject_reason: null }, "Party hall", [T[0]])[0].body, `Party hall · ${WHEN}`);
  assertEquals(buildBookingDecided({ ...b, reject_reason: "" }, "Party hall", [T[0]])[0].body, `Party hall · ${WHEN}`);
});

Deno.test("sos_raised is high priority with type label", () => {
  assertEquals(buildSosRaised({ id: "s1", type: "medical" }, "B1-A-101", [T[0]]), [{
    to: T[0], title: "🚨 SOS — Medical", body: "B1-A-101 needs help now",
    data: { type: "sos_raised", id: "s1" }, ...base,
  }]);
  assertEquals(buildSosRaised({ id: "s1", type: "lift" }, "B1-A-101", [T[0]])[0].title, "🚨 SOS — Lift stuck");
  assertEquals(buildSosRaised({ id: "s1", type: "fire" }, "x", [T[0]])[0].title, "🚨 SOS — Fire");
  assertEquals(buildSosRaised({ id: "s1", type: "security" }, "x", [T[0]])[0].title, "🚨 SOS — Security");
  assertEquals(buildSosRaised({ id: "s1", type: "other" }, "x", [T[0]])[0].title, "🚨 SOS — Other");
});

Deno.test("sos_update acknowledged and resolved", () => {
  assertEquals(buildSosUpdate({ id: "s1", status: "acknowledged", acknowledged_by_name: "Ravi", resolved_by_name: null }, [T[0]]), [{
    to: T[0], title: "Help is on the way", body: "Ravi is coming",
    data: { type: "sos_update", id: "s1" }, ...base,
  }]);
  assertEquals(
    buildSosUpdate({ id: "s1", status: "acknowledged", acknowledged_by_name: null, resolved_by_name: null }, [T[0]])[0].body,
    "The guard is coming",
  );
  assertEquals(buildSosUpdate({ id: "s1", status: "resolved", acknowledged_by_name: "Ravi", resolved_by_name: "Ravi" }, [T[0]]), [{
    to: T[0], title: "SOS resolved", body: "Marked resolved by Ravi",
    data: { type: "sos_update", id: "s1" }, ...base,
  }]);
});

Deno.test("sos_update sends nothing for cancelled or open", () => {
  assertEquals(buildSosUpdate({ id: "s1", status: "cancelled", acknowledged_by_name: null, resolved_by_name: null }, T), []);
  assertEquals(buildSosUpdate({ id: "s1", status: "open", acknowledged_by_name: null, resolved_by_name: null }, T), []);
});
