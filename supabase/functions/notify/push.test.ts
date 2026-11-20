import { assertEquals } from "jsr:@std/assert@1";
import { buildMessages, type VisitRow } from "./push.ts";

const pending: VisitRow = {
  id: "v1",
  name: "Ravi",
  purpose: "delivery",
  status: "pending",
  pass_id: null,
};

Deno.test("pending visit builds one visit_request message per token", () => {
  const msgs = buildMessages(pending, ["ExponentPushToken[a]", "ExponentPushToken[b]"]);
  assertEquals(msgs.length, 2);
  assertEquals(msgs[0], {
    to: "ExponentPushToken[a]",
    title: "Visitor at gate",
    body: "Ravi (delivery) is at the gate",
    data: { visitId: "v1", type: "visit_request" },
    priority: "high",
    channelId: "visitor",
    sound: "default",
  });
  assertEquals(msgs[1].to, "ExponentPushToken[b]");
});

Deno.test("pass visit builds pass_used message", () => {
  const msgs = buildMessages(
    { ...pending, name: "Aunty", status: "approved", pass_id: "p1" },
    ["ExponentPushToken[a]"],
  );
  assertEquals(msgs.length, 1);
  assertEquals(msgs[0].title, "Guest arrived");
  assertEquals(msgs[0].body, "Aunty entered using your pass");
  assertEquals(msgs[0].data, { visitId: "v1", type: "pass_used" });
  assertEquals(msgs[0].priority, "high");
  assertEquals(msgs[0].channelId, "visitor");
  assertEquals(msgs[0].sound, "default");
});

Deno.test("no tokens yields no messages", () => {
  assertEquals(buildMessages(pending, []), []);
});
