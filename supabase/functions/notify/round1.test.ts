import { assertEquals } from "jsr:@std/assert@1";
import {
  buildBillCreated,
  buildBillPaid,
  buildComplaintCreated,
  buildComplaintReply,
  buildComplaintStatus,
  buildNoticePosted,
  flatLabel,
  formatDueDate,
  formatRupees,
  titleCase,
} from "./push.ts";

const T = ["ExponentPushToken[a]", "ExponentPushToken[b]"];
const base = { priority: "high", sound: "default" };

Deno.test("formatters", () => {
  assertEquals(formatRupees(2500), "₹2,500");
  assertEquals(formatRupees("2500.00"), "₹2,500");
  assertEquals(formatRupees(125000), "₹1,25,000");
  assertEquals(formatRupees(2500.5), "₹2,500.50");
  assertEquals(formatDueDate("2026-12-10"), "10 Dec");
  assertEquals(formatDueDate("2026-01-05"), "5 Jan");
  assertEquals(titleCase("in_progress"), "In progress");
  assertEquals(titleCase("plumbing"), "Plumbing");
  assertEquals(flatLabel("Building 1", "A", "101"), "B1-A-101");
});

Deno.test("flatLabel uses the trailing digits like packages/shared", () => {
  assertEquals(flatLabel("Building 2", "B", "704"), "B2-B-704");
  assertEquals(flatLabel("Block 12 East 3", "A", "1"), "B3-A-1");
  assertEquals(flatLabel("Tower 4  ", "C", "2"), "B4-C-2");
  assertEquals(flatLabel("Annexe", "A", "9"), "Annexe-A-9");
});

Deno.test("notice_posted", () => {
  const m = buildNoticePosted({ id: "n1", title: "Water cut" }, T);
  assertEquals(m.length, 2);
  assertEquals(m[0], {
    to: T[0], title: "New notice", body: "Water cut",
    data: { type: "notice_posted", id: "n1" }, ...base,
  });
});

Deno.test("complaint_created", () => {
  const m = buildComplaintCreated({ id: "c1", category: "plumbing", status: "open" }, "B1-A-101", T);
  assertEquals(m[1], {
    to: T[1], title: "New complaint", body: "B1-A-101 · Plumbing",
    data: { type: "complaint_created", id: "c1" }, ...base,
  });
});

Deno.test("complaint status update", () => {
  const m = buildComplaintStatus({ id: "c1", category: "plumbing", status: "in_progress" }, [T[0]]);
  assertEquals(m, [{
    to: T[0], title: "Complaint update", body: "Your plumbing complaint is now In progress",
    data: { type: "complaint_updated", id: "c1" }, ...base,
  }]);
});

Deno.test("complaint admin reply", () => {
  assertEquals(buildComplaintReply("c1", [T[0]]), [{
    to: T[0], title: "Complaint update", body: "New reply on your complaint",
    data: { type: "complaint_updated", id: "c1" }, ...base,
  }]);
});

Deno.test("bill_created", () => {
  const m = buildBillCreated({ id: "b1", amount: 2500, due_date: "2026-12-10", receipt_no: null }, [T[0]]);
  assertEquals(m[0].title, "Maintenance bill");
  assertEquals(m[0].body, "₹2,500 due by 10 Dec");
  assertEquals(m[0].data, { type: "bill_created", id: "b1" });
});

Deno.test("bill_paid", () => {
  const m = buildBillPaid(
    { id: "b1", amount: 2500, due_date: "2026-12-10", receipt_no: "SS-2026-11-0001" }, [T[0]]);
  assertEquals(m[0].title, "Payment received");
  assertEquals(m[0].body, "Receipt SS-2026-11-0001");
  assertEquals(m[0].data, { type: "bill_paid", id: "b1" });
});

Deno.test("no tokens yields no messages", () => {
  assertEquals(buildNoticePosted({ id: "n1", title: "x" }, []), []);
});
