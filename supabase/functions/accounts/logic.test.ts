import { assertEquals } from "jsr:@std/assert@1";
import {
  adminOfEvery,
  flatEmail,
  generatePassword,
  groupRows,
  isValidPassword,
  isValidUsername,
  staffEmail,
  validateRow,
} from "./logic.ts";

const ok = { building: "Building 1", wing: "a", flat: "101" };

Deno.test("synthetic emails and username/password rules", () => {
  assertEquals(flatEmail("abc"), "flat-abc@login.societygate.app");
  assertEquals(staffEmail("guard1", "s1"), "guard1@staff.s1.societygate.app");
  assertEquals(isValidUsername("guard1"), true);
  assertEquals(isValidUsername("Guard1"), false);
  assertEquals(isValidUsername("ab"), false);
  assertEquals(isValidUsername("a".repeat(31)), false);
  assertEquals(isValidUsername("bad name"), false);
  assertEquals(isValidPassword("123456"), true);
  assertEquals(isValidPassword("12345"), false);
  assertEquals(isValidPassword(undefined), false);
});

Deno.test("generatePassword is 8 unambiguous chars", () => {
  for (let i = 0; i < 50; i++) assertEquals(/^[A-HJ-NP-Za-km-z2-9]{8}$/.test(generatePassword()), true);
});

Deno.test("validateRow normalises and accepts a good row", () => {
  assertEquals(validateRow({ ...ok, password: "secret1", member_name: " Rahul ", member_phone: "98765 43210", relation: "Son" }), {
    ok: true,
    value: { building: "Building 1", wing: "A", flat: "101", password: "secret1", member: { name: "Rahul", phone: "9876543210", relation: "Son" } },
  });
  assertEquals(validateRow(ok), { ok: true, value: { building: "Building 1", wing: "A", flat: "101", password: undefined, member: undefined } });
});

Deno.test("validateRow rejects bad building, wing, flat, password, member", () => {
  const err = (r: object) => {
    const v = validateRow(r);
    return v.ok ? null : v.error;
  };
  assertEquals(err({ ...ok, building: "  " }), "building is required");
  assertEquals(err({ ...ok, wing: "" }), "wing is required");
  assertEquals(err({ ...ok, wing: "A B" }), "wing must be 1-5 letters or digits");
  assertEquals(err({ ...ok, flat: "" }), "flat is required");
  assertEquals(err({ ...ok, flat: "10 1" }), "flat must be 1-10 letters, digits or dashes");
  assertEquals(err({ ...ok, password: "abc" }), "password must be at least 6 characters");
  assertEquals(err({ ...ok, member_phone: "9876543210" }), "member_name is required when member_phone or relation is given");
  assertEquals(err({ ...ok, member_name: "X", member_phone: "12ab" }), "member_phone must be 7-15 digits");
});

Deno.test("groupRows groups by flat, blank password keeps, first password wins", () => {
  const { groups, rowErrors } = groupRows([
    { ...ok, password: "", member_name: "A" },
    { ...ok, wing: "A", password: "pw1234", member_name: "B" },
    { building: "Building 2", wing: "B", flat: "702" },
  ]);
  assertEquals(rowErrors, []);
  assertEquals(groups.length, 2);
  assertEquals(groups[0].rows, [1, 2]);
  assertEquals(groups[0].password, "pw1234");
  assertEquals(groups[0].replaceFamily, true);
  assertEquals(groups[0].members.map((m) => m.name), ["A", "B"]);
  assertEquals(groups[1].rows, [3]);
  assertEquals(groups[1].replaceFamily, false);
  assertEquals(groups[1].password, undefined);
});

Deno.test("groupRows: invalid row fails its whole flat so family is never half-replaced", () => {
  const { groups, rowErrors } = groupRows([
    { ...ok, member_name: "A" },
    { ...ok, member_name: "B", member_phone: "x" },
    { building: "Building 1", wing: "B", flat: "101", member_name: "C" },
    { building: "", wing: "B", flat: "102" },
  ]);
  assertEquals(groups.map((g) => g.rows), [[3]]);
  assertEquals(rowErrors, [
    { row: 1, error: "skipped: another row for this flat is invalid" },
    { row: 2, error: "member_phone must be 7-15 digits" },
    { row: 4, error: "building is required" },
  ]);
});

Deno.test("adminOfEvery requires every target society", () => {
  assertEquals(adminOfEvery(["a"], ["a", "b"]), true);
  assertEquals(adminOfEvery(["a", "b"], ["b"]), false);
  assertEquals(adminOfEvery([], ["a"]), false);
});

Deno.test("validateRow rejects over-long relation", () => {
  const v = validateRow({ ...ok, member_name: "X", relation: "r".repeat(61) });
  assertEquals(v.ok ? null : v.error, "relation must be at most 60 characters");
});
