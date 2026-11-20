import { assertEquals } from "jsr:@std/assert@1";
import { isAuthorized, safeEqual } from "./auth.ts";
import { sendBatch } from "./expo.ts";
import type { ExpoMessage } from "./push.ts";

Deno.test("safeEqual compares exactly", () => {
  assertEquals(safeEqual("abc", "abc"), true);
  assertEquals(safeEqual("abc", "abd"), false);
  assertEquals(safeEqual("abc", "abcd"), false);
  assertEquals(safeEqual("", ""), true);
});

Deno.test("isAuthorized needs a configured secret and a matching Bearer", () => {
  assertEquals(isAuthorized("Bearer s3cret", "s3cret"), true);
  assertEquals(isAuthorized("bearer s3cret", "s3cret"), true);
  assertEquals(isAuthorized("Bearer wrong", "s3cret"), false);
  assertEquals(isAuthorized(null, "s3cret"), false);
  assertEquals(isAuthorized("Bearer ", undefined), false);
  assertEquals(isAuthorized("Bearer ", ""), false);
});

const batch: ExpoMessage[] = [{
  to: "ExponentPushToken[a]",
  title: "t",
  body: "b",
  data: { visitId: "v1", type: "visit_request" },
  priority: "high",
  channelId: "visitor",
  sound: "default",
}];
const quiet = () => {};
const okBody = JSON.stringify({ data: [{ status: "ok" }] });

Deno.test("sendBatch returns tickets on success without retry", async () => {
  let calls = 0;
  const r = await sendBatch(batch, () => {
    calls++;
    return Promise.resolve(new Response(okBody, { status: 200 }));
  }, quiet);
  assertEquals(calls, 1);
  assertEquals(r, { ok: true, tickets: [{ status: "ok" }] });
});

Deno.test("sendBatch retries once after a network error", async () => {
  let calls = 0;
  const r = await sendBatch(batch, () => {
    calls++;
    return calls === 1 ? Promise.reject(new Error("boom")) : Promise.resolve(new Response(okBody, { status: 200 }));
  }, quiet);
  assertEquals(calls, 2);
  assertEquals(r.ok, true);
});

Deno.test("sendBatch retries once after non-ok and logs the body", async () => {
  let calls = 0;
  const logs: unknown[][] = [];
  const r = await sendBatch(batch, () => {
    calls++;
    return Promise.resolve(new Response("upstream down", { status: 503 }));
  }, (...a) => logs.push(a));
  assertEquals(calls, 2);
  assertEquals(r, { ok: false, tickets: [] });
  assertEquals(logs.length, 2);
  assertEquals(logs[0][1], "upstream down");
});
