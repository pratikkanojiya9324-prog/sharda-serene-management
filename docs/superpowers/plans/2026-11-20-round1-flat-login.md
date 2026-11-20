# Round 1 — Flat Login, Family, Notices, Complaints, Bills — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace phone-OTP login with per-flat password login (plus staff username login), and add Family, Notice board, Complaints and track-only Bills, with a modern UI on app and admin website.

**Architecture:** Each flat and each staff member is a Supabase Auth email/password account with a hidden synthetic email; all existing RLS keyed on `auth.uid()` keeps working. New features are Postgres tables + RLS + security-definer RPCs, with push via the existing notify Edge Function. A service-role `accounts` Edge Function and Node scripts manage accounts and demo data. App and admin get new theme layers.

**Tech Stack:** Supabase (Postgres 17, Auth, Storage, Realtime, Edge Functions/Deno, pg_net), Expo SDK 58 + Expo Router, `@expo/vector-icons`, `expo-linear-gradient`, Vite + React + Tailwind CSS v4, Vitest, jest-expo, pgTAP.

**Spec:** `docs/superpowers/specs/2026-11-20-flat-login-round1-design.md` (sections 7–9 are binding).

## Global Constraints

- Never edit applied migrations 0001–0010. New migrations start at `0011_`.
- Every new table: `society_id` column, RLS enabled, composite FK `(flat_id, society_id)` where a flat is referenced.
- Security-definer functions: `set search_path = ''`, qualified names, unknown ids → `not_authorized`, EXECUTE revoked from public/anon and granted to authenticated (except `login_directory`, granted to anon too).
- Synthetic emails: flats `flat-<flat_id>@login.societygate.app`; staff `<username>@staff.<society_id>.societygate.app`. Never displayed.
- Usernames: lowercase `^[a-z0-9_.-]{3,30}$`, unique per society. Passwords: min 6 chars.
- Flat numbers 101–106 … 701–706; buildings "Building 1", "Building 2"; wings "A", "B"; label format `B1-A-101`.
- Actor name: optional `p_actor_name text`, trimmed, max 60 chars, stored in `*_name` columns.
- Complaint categories: plumbing, electrical, lift, cleaning, security, parking, other. Status: open, in_progress, resolved. Bill status: unpaid, paid. Payment modes: cash, cheque, upi, other.
- Receipt number `SS-YYYY-MM-NNNN` (payment month, per society, counter table under row lock).
- Demo passwords: flats `Sharda@<b><wing><flat>` (e.g. `Sharda@1A101`); staff `admin`/`Admin@123`, `guard1`/`Guard@123`.
- UI: teal `#0F766E` primary, amber `#F59E0B` accent, radius 16, Ionicons, card layouts, status pills with colour + icon, empty states, pull-to-refresh. Admin: Tailwind, sidebar layout.
- No secrets committed (service role key only from env). Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Expo Router: never put non-route files (tests, helpers) inside `apps/mobile/src/app/`.

## Review Focus

1. **Flat A reads flat B's bills/complaints/family/visits** → zero rows. Test: Tasks 1–2 pgTAP cross-flat tests.
2. **Anon `login_directory` leaks more than building/wing/flat id/number + society name** → it must not. Test: Task 1.
3. **Two admins mark bills paid at the same moment** → distinct sequential receipt numbers. Test: Task 2 (sequential calls + uniqueness constraint).
4. **Non-admin calls `accounts` function or bill/notice/status RPCs** → 403 / `not_authorized`. Tests: Tasks 2 and 4.
5. **Signed-out launch / wrong password / staff on resident form** → login screen with a clear error, never "Unmatched Route". Test: Task 5 router + login tests.

---

### Task 1: Account model, family, login directory (DB)

**Files:** Create `supabase/migrations/0011_flat_accounts.sql`, `supabase/tests/flat_accounts.test.sql`. Regenerate `packages/shared/src/database.types.ts`.

**Interfaces — Produces:**
- `profiles.phone` nullable; `towers.building text not null default 'Building 1'`; unique `(society_id, building, name)` on towers.
- `family_members(id, society_id, flat_id, name, phone, relation, created_at)` + RLS (read: the flat's residents, guards/admins of society; write: admins).
- Columns `visits.responded_by_name`, `passes.created_by_name` (text null).
- `login_directory(p_society_id uuid) returns table(society_name text, building text, wing text, flat_id uuid, flat_number text)` — anon + authenticated.
- `respond_to_visit(p_visit_id, p_response, p_actor_name text default null)`; `create_pass(..., p_actor_name text default null)` (create-or-replace keeping existing behaviour from 0003/0004/0010).
- `flat_contacts(p_flat_id)` now returns `family_members` with non-null phones (name, phone, relation).
- Shared: `packages/shared/src/flatLabel.ts` — `flatLabel(building: string, wing: string, number: string): string` → `B1-A-101`; `flatEmail(flatId: string): string`; `staffEmail(username: string, societyId: string): string`; `isValidUsername(u: string): boolean`. With Vitest tests.

- [ ] Write failing pgTAP tests: login_directory as anon returns exactly the 5 columns and only the given society's flats; resident of flat A cannot read family_members of flat B (0 rows); guard can read family of any flat in own society, not other society; respond_to_visit stores trimmed actor name (61+ chars → `invalid_actor_name`); flat_contacts returns family phones.
- [ ] Write failing Vitest tests for flatLabel/flatEmail/staffEmail/isValidUsername (`'Building 2','B','704'` → `B2-B-704`; `'Ab'` invalid; `'guard_1'` valid).
- [ ] Run `npx supabase test db` and `npm test -w packages/shared` → FAIL.
- [ ] Implement migration + shared helpers.
- [ ] `npx supabase db reset && npm run dev:secrets && npx supabase test db` → all PASS; `npm run gen:types`.
- [ ] Commit `feat(db): flat accounts, family members, login directory`.

### Task 2: Notices, complaints, bills (DB)

**Files:** Create `supabase/migrations/0012_notices_complaints_bills.sql`, `supabase/tests/notices_complaints_bills.test.sql`.

**Interfaces — Produces:**
- Tables per spec §7: `notices`, `complaints`, `complaint_comments`, `bills`, `receipt_counters(society_id, month date, last int)`, plus `societies.short_code text not null default 'SS'`; `complaints.created_by_name`, `complaint_comments.author_name`.
- Storage buckets (private) `notices`, `complaint-photos` with `{society_id}/...` policies (CASE form as in 0009).
- RPCs: `create_notice(p_title, p_body, p_attachment_path, p_attachment_kind, p_pinned) returns notices` (admin); `set_notice_pinned(p_id, p_pinned)`; `delete_notice(p_id)`; `create_complaint(p_flat_id, p_category, p_description, p_photo_path, p_actor_name) returns complaints` (resident of flat); `add_complaint_comment(p_complaint_id, p_body, p_actor_name) returns complaint_comments` (that flat's resident or admin); `set_complaint_status(p_complaint_id, p_status) returns complaints` (admin; updates updated_at); `generate_bills(p_period date, p_amount numeric, p_due_date date) returns int`; `generate_bills_custom(p_period, p_due_date, p_rows jsonb /* [{flat_id, amount}] */) returns int`; `mark_bill_paid(p_bill_id, p_mode, p_reference) returns bills` (admin; error `already_paid`).
- Direct insert/update/delete on these tables revoked from authenticated (RPC-only writes), except none.

- [ ] Failing pgTAP: flat A sees only own complaints/bills; resident cannot create_notice/set_complaint_status/generate_bills/mark_bill_paid (`not_authorized`); generate_bills twice for same period creates bills once (second returns 0); mark_bill_paid gives `SS-2026-11-0001` then `SS-2026-11-0002`, second call on same bill → `already_paid`; comment on another flat's complaint → `not_authorized`; storage: resident cannot upload to `notices`.
- [ ] Run → FAIL. Implement. Run reset + tests → PASS; gen:types.
- [ ] Commit `feat(db): notices, complaints and track-only bills`.

### Task 3: Notifications for new types

**Files:** Modify `supabase/functions/notify/push.ts`, `index.ts`, tests; create `supabase/migrations/0013_notify_round1.sql`.

**Interfaces — Produces:** triggers (pg_net, Vault `notify_url` + `notify_secret`, never blocking) posting `{type, record, old_record}`: `notices` insert → `notice_posted` (all resident devices of the society: title "New notice", body = notice title); `complaints` insert → `complaint_created` (admins: "New complaint", "B1-A-101 · Plumbing"); `complaints` status update → `complaint_updated` (the flat: "Complaint update", "Your plumbing complaint is now In progress"); `complaint_comments` insert by admin → `complaint_updated` ("New reply on your complaint"); `bills` insert → `bill_created` ("Maintenance bill", "₹2,500 due by 10 Dec"); `bills` status → paid → `bill_paid` ("Payment received", "Receipt SS-2026-11-0001"). `data: { type, id }`. Existing visit messages unchanged.

- [ ] Failing Deno tests for each message builder (exact title/body/data above). Run `npx -y deno test supabase/functions/notify` → FAIL.
- [ ] Implement; add pgTAP test that inserting a notice/complaint/bill succeeds with Vault secrets absent.
- [ ] Run Deno + db tests → PASS. Commit `feat(notify): notices, complaints and bills notifications`.

### Task 4: Accounts Edge Function, auth config, scripts, seeds

**Files:** Create `supabase/functions/accounts/{index.ts,logic.ts,logic.test.ts}`, `scripts/create-staff.mjs`, `scripts/seed-demo.mjs`; rewrite `supabase/seed.sql`; modify `supabase/config.toml`, `README.md`, root `package.json` (scripts `seed:demo`, `staff:create`).

**Interfaces — Produces:**
- `accounts` function (verify_jwt true; caller JWT must belong to an admin of the target society; uses service role inside). POST `{action, ...}`: `create_flat_account {flat_id, password}`, `set_password {user_id | flat_id, password}`, `create_staff {society_id, username, name, role, password}`, `disable_staff {user_id}`, `bulk_import {society_id, rows: [{building, wing, flat, password?, member_name?, member_phone?, relation?}]}` → `{results: [{row, ok, error?, generated_password?}]}`. Pure validation/grouping in `logic.ts`.
- config.toml: `[auth.sms] enabled=false`, test_otp removed, `[auth.email] enable_signup=false, enable_confirmations=false`.
- `create-staff.mjs`: args `--society <id> --username --name --role --password`, env `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- `seed-demo.mjs`: env as above; idempotent; creates everything listed in spec §8 "Demo data creation"; prints a summary (society id, counts, demo logins).
- Local `seed.sql`: only the society/towers/flats rows needed by pgTAP-free local dev? → replaced by running `npm run seed:demo` against local (README updated). `seed.sql` keeps just a comment.

- [ ] Failing Deno tests for logic.ts (row validation: bad wing/flat/username/password length; grouping rows by flat; replace-family semantics).
- [ ] Implement function + scripts. Run against local stack: `npm run seed:demo` (local URL + local service key from `npx supabase status -o env`) twice (idempotent), then a node check: signInWithPassword with `flat-<id>@login.societygate.app` / `Sharda@1A101` succeeds and reads only its own bills; `admin@staff.<society>...` / `Admin@123` succeeds; calling `accounts` as a flat → 403.
- [ ] Update README (new login model, scripts, wiping test project). Commit `feat: accounts function, demo seed and staff bootstrap`.

### Task 5: Mobile — theme, new login, identity picker, routing

**Files:** Create `apps/mobile/src/theme/{tokens.ts,components.tsx}` (Button, Card, Pill, Screen, Header, EmptyState, Input, Select), `src/app/(auth)/welcome.tsx`, `src/app/(auth)/staff-login.tsx`, `src/app/who.tsx`, `src/lib/actor.ts` (`getActorName(): Promise<string|null>`, `setActorName(n)`), `src/lib/flatLogin.ts`; delete `(auth)/login.tsx`, `(auth)/verify.tsx`; modify `_layout.tsx`, `index.tsx`, `postLogin.ts` (no claim_invites), `session.ts` (`pickHome` adds `/(admin)` for admin), tests in `src/__tests__/`.

**Interfaces — Produces:** welcome screen per spec §9 (gradient header "Welcome Sharda family members", society name from `login_directory`, Building/Wing/Flat selects, password with show/hide, Login, "Guard / Admin login →"); errors: wrong password → "Wrong password for B1-A-101"; network → "Can't reach the server". After resident login, if no actor name stored → `who` screen listing family members + "Someone else". `pickHome(roles)`: admin → `/(admin)`, guard → `/(guard)`, resident → `/(resident)`. `EXPO_PUBLIC_SOCIETY_ID` in `.env.example` and eas.json.

- [ ] Failing tests: router test (signed out → welcome, not Unmatched), `pickHome` admin case, flatLogin builds the right email and maps auth error to the copy above, actor name round-trip.
- [ ] Implement. `npx jest`, `npx tsc --noEmit`, `npx expo export --platform android` → PASS. Commit `feat(mobile): flat login, staff login and who's-using-this-phone`.

### Task 6: Mobile — resident tabs (Home, Notices, Complaints, Bills, Family, More)

**Files:** `src/app/(resident)/_layout.tsx` (Tabs with Ionicons), screens `index.tsx` (restyled visitors), `notices/index.tsx`, `notices/[id].tsx`, `complaints/index.tsx`, `complaints/new.tsx`, `complaints/[id].tsx`, `bills/index.tsx`, `bills/[id].tsx` (receipt), `family.tsx`, `more.tsx` (Passes, History, Change password, Change "who", Logout); move existing passes/history/request screens under the new layout; helpers in `src/lib/` with tests.

**Interfaces — Consumes:** Task 1–2 tables/RPCs; actor name from Task 5. Change password: `supabase.auth.updateUser({ password })`, min 6, confirm field.

- [ ] Failing tests for pure helpers: `formatRupees(2500)` → `₹2,500`; `billStatusPill('unpaid', dueDate, today)` → `{label:'Overdue', tone:'danger'}` when past due; complaint status → label/tone/icon; notice ordering (pinned first then newest).
- [ ] Implement screens. Tests, tsc, expo export → PASS. Commit `feat(mobile): resident tabs for notices, complaints, bills and family`.

### Task 7: Mobile — admin screens and guard updates

**Files:** `src/app/(admin)/_layout.tsx` (Tabs: Notices, Complaints, Bills, More), `notices/new.tsx`, `complaints/[id].tsx`, `bills/index.tsx` (month filter, mark paid modal with mode + reference); guard: flat picker → Building/Wing/Flat selects (natural sort), restyle guard screens with theme; `CallResident` shows relation.

- [ ] Failing tests for admin helpers (month filter grouping, mark-paid form validation) and guard flat-picker grouping by building/wing.
- [ ] Implement. Tests, tsc, expo export → PASS. Commit `feat(mobile): admin screens and guard flat picker`.

### Task 8: Admin website — Tailwind redesign and round-1 features

**Files:** `apps/admin` add Tailwind (`@tailwindcss/vite`), layout with sidebar (Dashboard, Flats & members, Staff, Notices, Complaints, Bills, Visitor log); login → username/password (staff); pages: Flats import (CSV `building,wing,flat,password,member_name,member_phone,relation` → `accounts` bulk_import, results table, download generated passwords CSV), reset flat password, Staff create/disable/reset, Notices CRUD, Complaints list/detail/status/comment, Bills generate (same amount or CSV `building,wing,flat,amount`) + list + mark paid; remove phone/OTP login and invite UI.

- [ ] Failing Vitest tests for CSV parsers (members CSV, custom bill CSV) incl. bad rows `bad_row:<n>`.
- [ ] Implement. `npm test -w apps/admin`, `npm run build -w apps/admin`, and `npm run smoke` (update `scripts/smoke-queries.mjs` to log in with the new demo accounts) → PASS. Commit `feat(admin): Tailwind redesign with flats import, staff, notices, complaints and bills`.

### Task 9: Deploy to the test project and build APKs (controller)

- [ ] Wipe old test data on `cwhhmqkanviioxtmwoce` (auth users, memberships, invites, visits, passes, societies) — test env only.
- [ ] `supabase db push --remote`, deploy `notify` and `accounts`, auth config (email/password on, signup off, phone off).
- [ ] Run `seed-demo.mjs` against the test project; record society id in eas.json/env.
- [ ] Build preview + development APKs; install on the connected phone via adb; push to GitHub.
