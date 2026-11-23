import { assertEquals } from "jsr:@std/assert@1";
import {
  buildHelperIn,
  buildHelperOut,
  buildParcelCollected,
  buildParcelLogged,
  buildVisitAutoApproved,
  buildVisitInsert,
} from "./push.ts";

const T = ["ExponentPushToken[a]", "ExponentPushToken[b]"];
const base = { priority: "high", sound: "default" };
const helper = { name: "Sunita", type: "maid" };

Deno.test("helper_in", () => {
  const m = buildHelperIn("att1", helper, T);
  assertEquals(m.length, 2);
  assertEquals(m[0], {
    to: T[0], title: "Daily help arrived", body: "Sunita (Maid) has entered",
    data: { type: "helper_in", id: "att1" }, ...base,
  });
});

Deno.test("helper_out and multi-word type label", () => {
  assertEquals(buildHelperOut("att1", { name: "Raju", type: "car_cleaner" }, [T[0]]), [{
    to: T[0], title: "Daily help left", body: "Raju (Car cleaner) has left",
    data: { type: "helper_out", id: "att1" }, ...base,
  }]);
});

Deno.test("parcel_logged", () => {
  assertEquals(buildParcelLogged({ id: "p1", courier: "Amazon", collected_by_name: null }, [T[0]]), [{
    to: T[0], title: "Parcel at the gate", body: "Amazon parcel is waiting at the gate",
    data: { type: "parcel_logged", id: "p1" }, ...base,
  }]);
});

Deno.test("parcel_collected", () => {
  assertEquals(buildParcelCollected({ id: "p1", courier: "Amazon", collected_by_name: "Ravi" }, [T[0]]), [{
    to: T[0], title: "Parcel collected", body: "Amazon parcel collected by Ravi",
    data: { type: "parcel_collected", id: "p1" }, ...base,
  }]);
});

const visit = { id: "v1", name: "Ramesh", purpose: "delivery", status: "approved", pass_id: null, expected_entry_id: "e1" };

Deno.test("visit_auto_approved", () => {
  assertEquals(buildVisitAutoApproved(visit, [T[0]]), [{
    to: T[0], title: "Visitor let in", body: "Ramesh (Delivery) entered — you were expecting it",
    data: { type: "visit_auto_approved", id: "v1" }, ...base,
  }]);
});

Deno.test("auto-approved visit insert never yields the waiting-visitor message", () => {
  const m = buildVisitInsert(visit, T)!;
  assertEquals(m.length, 2);
  for (const x of m) {
    assertEquals(x.title, "Visitor let in");
    assertEquals(x.data.type, "visit_auto_approved");
  }
});

Deno.test("visit insert routing for pending, pass and plain approved", () => {
  const pending = buildVisitInsert({ ...visit, status: "pending", expected_entry_id: null }, [T[0]])!;
  assertEquals(pending[0].title, "Visitor at gate");
  const pass = buildVisitInsert({ ...visit, pass_id: "x", expected_entry_id: null }, [T[0]])!;
  assertEquals(pass[0].title, "Guest arrived");
  assertEquals(buildVisitInsert({ ...visit, expected_entry_id: null }, [T[0]]), null);
});
