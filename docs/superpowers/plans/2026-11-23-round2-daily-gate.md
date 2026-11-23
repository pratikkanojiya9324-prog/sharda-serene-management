# Round 2 — Daily Help, Expected Deliveries, Parcels, Error Handling — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the everyday gate traffic (daily help, deliveries/cabs, parcels) one-tap or zero-tap for residents and guards, and make every app screen fail gracefully.

**Architecture:** New Postgres tables + RLS + security-definer RPCs (migrations 0014–0016), `create_visit` replaced to auto-approve expected entries, new notify cases in the existing Edge Function. App gets an error-handling foundation first (crash screen, offline banner, shared screen states, session-expiry handling), then resident and guard screens built on it. Admin website gets two read/manage pages.

**Tech Stack:** Supabase (Postgres 17, RLS, Storage, pg_net, Edge Functions/Deno), Expo SDK 58 + Expo Router, `@react-native-community/netinfo` (new, native), Vite + React + Tailwind v4, Vitest, jest-expo, pgTAP.

**Spec:** `docs/superpowers/specs/2026-11-23-round2-daily-gate-design.md` (section 7 is binding).

## Global Constraints

- Never edit migrations 0001–0013. New migrations: `0014_daily_help.sql`, `0015_expected_parcels.sql`, `0016_notify_round2.sql`.
- Every new table: `society_id`, RLS enabled, composite FK `(flat_id, society_id)` → `flats(id, society_id)` where a flat is referenced. Writes are RPC-only (revoke insert/update/delete from authenticated).
- Security-definer functions: `set search_path = ''`, qualified names, unknown ids → `not_authorized`, EXECUTE revoked from public/anon, granted to authenticated. Role checks via existing `public.has_role(society, role)` and `public.is_flat_resident(flat)`.
- Phones stored E.164 `+91XXXXXXXXXX` (client normalises with `normalizePhone` from `@society-gate/shared`; DB checks `^\+91[6-9][0-9]{9}$` → `invalid_phone`).
- Names: trimmed, 1–60 chars → else `invalid_name`. Actor name params: `p_actor_name text default null`, same rules as Round 1 (`invalid_actor_name` > 60).
- `helper_type` enum values: `maid, cook, driver, nanny, car_cleaner, tutor, other`. Labels: Maid, Cook, Driver, Nanny, Car cleaner, Tutor, Other.
- Entry code: 6 digits, unique per society among active helpers, permanent for the helper.
- Expected entry windows: 1, 2, 4, 8 hours only. Purposes allowed: `delivery, cab, service, guest`. Companies: Swiggy, Zomato, Amazon, Flipkart, Blinkit, Zepto, Uber, Ola, Rapido, Other (free text ≤ 40 chars accepted).
- Couriers (parcel chips): Amazon, Flipkart, Myntra, Meesho, Delhivery, Blue Dart, DTDC, India Post, Other (free text ≤ 40).
- `parcel_status` enum: `at_gate, collected, returned`.
- New error codes and app copy (add to `apps/mobile/src/lib/errors.ts`):
  `invalid_name` "Enter a name" · `helper_already_linked` "This person is already added to your flat" · `helper_inactive` "This person has been blocked by the society office" · `already_inside` "Already checked in" · `not_inside` "Not checked in yet" · `invalid_hours` "Choose how long" · `invalid_purpose` "Choose what you are expecting" · `invalid_company` "Company name is too long" · `already_cancelled` "Already cancelled" · `invalid_courier` "Enter the courier name" · `already_collected` "This parcel was already handed over".
- UI: existing theme (`@/theme/components`, `@/components/resident`), teal/amber, Ionicons, cards, pills, empty states, pull-to-refresh. Guard daily-help check-in ≤ 3 taps from Today.
- Expo Router: never put non-route files inside `apps/mobile/src/app/`. Hide non-tab resident routes with `tabBarItemStyle: { display: 'none' }` (add to `HIDDEN` in `(resident)/_layout.tsx`), never `href: null`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No secrets committed.
- Local checks need Docker + `npx supabase start`. DB test command: `npx supabase db reset && npm run dev:secrets && npx supabase test db`; then `npm run gen:types`.

## Review Focus

1. **Auto-approval misfires** — wrong flat, different purpose, window over, entry cancelled → visit stays `pending`. Test: Task 2 pgTAP.
2. **Flat sees an unlinked helper's attendance** — after `remove_helper_from_flat` the flat loses access to that helper and attendance. Test: Task 1 pgTAP.
3. **Guard double-taps Check in / two guards at once** → exactly one open attendance row, second call `already_inside`. Test: Task 1 (partial unique index + test).
4. **Same maid added by two flats with differently formatted numbers** → one helper, one code, two links. Test: Task 1 (DB) + Task 5 (client normalises before RPC).
5. **No internet / expired login / account without flat** → offline banner, "log in again" and sign-out, no-flat state with Retry — never an endless spinner or raw error. Test: Task 4 (`screenState`, `isSessionExpired`, `reportError`).

---

### Task 1: Daily help (DB)

**Files:** Create `supabase/migrations/0014_daily_help.sql`, `supabase/tests/daily_help.test.sql`. Regenerate `packages/shared/src/database.types.ts`. Modify `packages/shared/src/constants.ts` (+ `HELPER_TYPES`), `packages/shared/src/selects.ts` (+ selects below).

**Interfaces — Produces:**
- `helpers(id, created_at, society_id, name, phone, type helper_type, photo_path, entry_code, active bool default true)`; unique `(society_id, phone)`; partial unique `(society_id, entry_code) where active`.
- `helper_flats(helper_id, flat_id, society_id, added_at, added_by_name)` PK `(helper_id, flat_id)`.
- `helper_attendance(id, society_id, helper_id, entry_at default now(), exit_at, entry_by, exit_by)`; partial unique `(helper_id) where exit_at is null`.
- RLS select: guards/admins of the society see all three tables; a resident sees `helpers`/`helper_flats`/`helper_attendance` only for helpers linked to a flat they reside in (helper_flats rows only for their own flats).
- RPCs:
  - `add_helper(p_flat_id uuid, p_name text, p_phone text, p_type helper_type, p_photo_path text default null, p_actor_name text default null) returns helpers` — resident of flat; existing phone in society → link (keeps existing code/name; `helper_inactive` if deactivated; `helper_already_linked` if already linked); else create with new code (advisory lock per society as in `create_pass`).
  - `remove_helper_from_flat(p_helper_id uuid, p_flat_id uuid) returns void` — resident of flat.
  - `helper_check_in(p_helper_id uuid) returns helper_attendance` — guard; `helper_inactive`, `already_inside`.
  - `helper_check_out(p_helper_id uuid) returns helper_attendance` — guard; `not_inside`.
  - `set_helper_active(p_helper_id uuid, p_active boolean) returns helpers` — admin; deactivating also closes an open attendance row.
- Private storage bucket `helper-photos`, path `{society_id}/...`; insert by residents/guards of that society, read by anyone allowed to read the helper (CASE form as in 0009).
- Shared: `HELPER_TYPES: { value: HelperType; label: string }[]` (labels from Global Constraints); `HELPER_RESIDENT_SELECT` (helper + today's/month attendance embed), `HELPER_GUARD_SELECT` (helper + `helper_flats(flats(number, towers!flats_tower_id_fkey(building,name)))` + open attendance).

- [ ] Write failing pgTAP tests: two flats add `+919876543210` → one helper, same code, two links; second add from same flat → `helper_already_linked`; bad phone → `invalid_phone`; blank name → `invalid_name`; flat C (unlinked) sees 0 helpers/attendance; after `remove_helper_from_flat` flat A sees 0; guard check-in twice → `already_inside`, one open row; check-out without open row → `not_inside`; resident calling check-in → `not_authorized`; deactivated helper check-in → `helper_inactive`, add by phone → `helper_inactive`; guard of another society sees nothing.
- [ ] Run DB test command → FAIL.
- [ ] Implement migration; shared constants/selects.
- [ ] Run DB test command → PASS; `npm run gen:types`; `npm test -w packages/shared` → PASS.
- [ ] Commit `feat(db): daily help with entry codes and attendance`.

### Task 2: Expected entries, parcels, auto-approving create_visit (DB)

**Files:** Create `supabase/migrations/0015_expected_parcels.sql`, `supabase/tests/expected_parcels.test.sql`. Regenerate types. Modify `packages/shared/src/constants.ts` (+ `EXPECTED_COMPANIES`, `COURIERS`, `EXPECTED_HOURS = [1,2,4,8]`), `selects.ts` (+ `PARCEL_SELECT` with flat label embed).

**Interfaces — Produces:**
- `expected_entries(id, created_at, society_id, flat_id, purpose visit_purpose, company, valid_from, valid_to, created_by, created_by_name, cancelled_at, used_count int default 0)`; check purpose <> 'other'.
- `visits.expected_entry_id uuid null references expected_entries on delete set null`.
- `create_expected_entry(p_flat_id uuid, p_purpose visit_purpose, p_company text, p_hours int, p_actor_name text default null) returns expected_entries` — resident; valid_from now(), valid_to now()+hours; `invalid_hours`, `invalid_purpose`, `invalid_company`.
- `cancel_expected_entry(p_id uuid) returns expected_entries` — resident of that flat; `already_cancelled`.
- `create_visit` — `create or replace` with the **same signature and behaviour as 0003** plus: lock and pick the active entry for (flat, purpose) (`cancelled_at is null and now() between valid_from and valid_to`, latest valid_to first); if found insert with `status='approved'`, `responded_at=now()`, `responded_by_name = coalesce(entry.created_by_name, 'Resident') || ' (expected)'`, `expected_entry_id`, and increment `used_count`. Entries are reusable inside their window.
- `parcels(id, created_at, society_id, flat_id, courier, note, photo_path, status parcel_status default 'at_gate', logged_by, collected_at, collected_by_name, handed_by, visit_id null references visits)`.
- `log_parcel(p_flat_id uuid, p_courier text, p_note text, p_photo_path text, p_visit_id uuid default null) returns parcels` — guard; `invalid_courier`; visit of another flat → `not_authorized`.
- `collect_parcel(p_parcel_id uuid, p_collected_by_name text) returns parcels` — guard; `invalid_name`; not at_gate → `already_collected`.
- `return_parcel(p_parcel_id uuid) returns parcels` — guard; not at_gate → `already_collected`.
- RLS select: residents see own flat's expected_entries/parcels; guards/admins all in society. Bucket `parcel-photos` path `{society_id}/{flat_id}/...` (guard insert; that flat's residents + staff read).

- [ ] Failing pgTAP: expected delivery for flat A → guard creates delivery visit for A → `approved` with `expected_entry_id`, `used_count` 1; second delivery in window also approved (`used_count` 2); cab visit for A → `pending`; delivery for flat B → `pending`; after cancel → `pending`; after window (insert entry with past `valid_to` directly as postgres) → `pending`; `p_hours` 3 → `invalid_hours`; purpose other → `invalid_purpose`; plain visit behaviour unchanged (pending, 10-min expiry still applies); log_parcel by resident → `not_authorized`; collect twice → `already_collected`; flat B sees 0 of A's parcels/expectations.
- [ ] Run → FAIL. Implement. Run DB test command → PASS (incl. all older test files); gen:types.
- [ ] Commit `feat(db): expected deliveries auto-approve visits; parcels at the gate`.

### Task 3: Notifications for Round 2 events

**Files:** Create `supabase/migrations/0016_notify_round2.sql`, `supabase/functions/notify/round2.test.ts`; modify `supabase/functions/notify/push.ts`, `index.ts`; extend `supabase/tests/notify_round1.test.sql` pattern in a new `supabase/tests/notify_round2.test.sql`.

**Interfaces — Produces:** triggers (same pg_net + Vault pattern as 0013, never blocking) on `helper_attendance` insert/update, `parcels` insert/update. Message builders (exact copy), `data: { type, id }`:
- `helper_attendance:INSERT` → type `helper_in`, every linked flat: title "Daily help arrived", body "Sunita (Maid) has entered".
- `helper_attendance:UPDATE` exit_at null → set → `helper_out`: "Daily help left", "Sunita (Maid) has left".
- `parcels:INSERT` → `parcel_logged` to the flat: "Parcel at the gate", "Amazon parcel is waiting at the gate".
- `parcels:UPDATE` → collected → `parcel_collected`: "Parcel collected", "Amazon parcel collected by Ravi".
- `visits:INSERT` with `status='approved'` and `expected_entry_id` → `visit_auto_approved` (instead of the waiting-visitor push): "Visitor let in", "Ramesh (Delivery) entered — you were expecting it".

- [ ] Failing Deno tests for each builder (exact strings above) and that an auto-approved visit insert does not produce the normal "visitor waiting" message. Run `npx -y deno test supabase/functions/notify` → FAIL.
- [ ] Implement; pgTAP: inserts into helper_attendance/parcels succeed with Vault secrets absent.
- [ ] Deno + DB tests → PASS. Commit `feat(notify): daily help, parcels and auto-approved visit notifications`.

### Task 4: Mobile — error-handling foundation + Round 1 backlog fixes

**Files:** `npx expo install @react-native-community/netinfo` (apps/mobile). Create `src/lib/network.ts`, `src/components/OfflineBanner.tsx`, `src/components/CrashScreen.tsx`, `src/lib/screenState.ts` (+ test), extend `src/lib/errors.ts` (+ test), `src/lib/guardErrors.ts` (+ test); add `ErrorState`, `NoFlatState` to `src/components/resident.tsx`; modify `src/app/_layout.tsx`; apply to every list screen: resident `index, notices/index, complaints/index, bills/index, family, history, passes`, guard `index`, admin `index, complaints/index, bills/index`.

**Interfaces — Produces:**
- `useIsOnline(): boolean` — false only when NetInfo says `isConnected === false` or `isInternetReachable === false`; pure `isOnline(state): boolean` tested.
- `OfflineBanner` — fixed strip "No internet — showing saved data" (warning tone) rendered in root layout when offline.
- Root `_layout.tsx` `export function ErrorBoundary({ error, retry })` → `CrashScreen`: title "Something went wrong", text "Please try again. If it keeps happening, tell the society office.", buttons "Try again" (retry) and "Go to home" (`router.replace('/')`).
- `screenState(i: { loaded: boolean; error: string | null; needsFlat?: boolean; flatLoading?: boolean; hasFlat?: boolean }): 'loading' | 'no_flat' | 'error' | 'ready'` — no_flat when needsFlat && !flatLoading && !hasFlat; error when error && !loaded; loading when !loaded; else ready (content shown with Banner if error after a successful load).
- `ErrorState({ message, onRetry })` (icon cloud-offline-outline, "Try again" button); `NoFlatState({ message?, onRetry })` (copy from current Home "No flat linked" + Try again + Log out) — Home switches to it too.
- `errors.ts`: all new codes (Global Constraints) + `'Failed to fetch'` → "No internet connection, try again"; `isSessionExpired(e: { message?: string; code?: string } | null): boolean` (code `PGRST301`, messages containing `JWT expired`, `Invalid Refresh Token`, `refresh_token_not_found`); `reportError(e): string` — if session expired: show Alert "Login expired" / "Please log in again." once and call `signOut()`, return "Please log in again"; else `friendlyError(e.message)`.
- `guardErrorText` falls back to `friendlyError` for codes not in its own table (new codes then read correctly for guards).
- Backlog fixes (from `docs/superpowers/round1-followups.md` Task 6/7): change-password `setBusy(false)` in `finally`; bill `already_paid` refreshes the row; complaint photo removed from storage when `create_complaint` fails; `FlatSwitcher` on every flat-scoped resident tab; guard flat picker auto-picks the only wing; remove dead `HOUSEHOLD_MEMBERS_SELECT`/`add_household_member` usages; every submit button uses `loading` and the handler resets busy in `finally`; failed submits keep typed form values.

- [ ] Failing Jest tests: `screenState` (each branch incl. no_flat beats loading once flat lookup finished; error after loaded → ready); `isSessionExpired` true for `{code:'PGRST301'}`, `{message:'JWT expired'}`, false for `{message:'already_paid'}`; `reportError` calls signOut once for expired and returns friendly text otherwise (mock signOut + Alert); `friendlyError` for every new code; `guardErrorText('already_inside')` → "Already checked in"; `isOnline` cases (`{isConnected:false}` → false, `{isConnected:true,isInternetReachable:null}` → true).
- [ ] `npx jest` → FAIL. Implement + apply to screens.
- [ ] `npx jest`, `npx tsc --noEmit`, `npx expo export --platform android` → PASS. Commit `feat(mobile): crash screen, offline banner, retryable screen states, session expiry`.

### Task 5: Mobile — resident daily help, expecting, parcels

**Files:** Create `src/app/(resident)/daily-help/{_layout.tsx,index.tsx,new.tsx,[id].tsx}`, `src/app/(resident)/expecting.tsx`, `src/app/(resident)/parcels.tsx`, `src/lib/helpers.ts` (+ test), `src/lib/expecting.ts` (+ test), `src/lib/photoUpload.ts` (generalised from `complaintPhoto.ts`, which then uses it); modify `(resident)/_layout.tsx` (HIDDEN += `daily-help`, `expecting`, `parcels`), `(resident)/index.tsx`, `(resident)/more.tsx`, `src/lib/notificationRoute.ts` (+ test), `src/lib/status.ts` (+ test).

**Interfaces — Consumes:** Tasks 1–2 RPCs/selects/constants; Task 4 `screenState`, `ErrorState`, `NoFlatState`, `reportError`.
**Produces:**
- `helperTypeLabel(t: HelperType): string`, `helperTypeIcon(t): IconName`; `attendanceSummary(rows: {entry_at: string; exit_at: string | null}[], monthStart: Date): { daysPresent: number; lastEntry: string | null }` (distinct local dates in that month); `insideNow(rows): boolean`.
- `activeExpectations(rows, now: Date)` (not cancelled, valid_to > now, sorted by valid_to); `expectationLabel(row): string` → e.g. "Swiggy delivery · until 3:30 PM" (no company → "Delivery · until …").
- `uploadSocietyPhoto(bucket: 'complaint-photos' | 'helper-photos' | 'parcel-photos', pathPrefix: string, uri: string): Promise<string>` (resize/compress like complaintPhoto).
- `visitPill` returns `{ label: 'Auto-approved', tone: 'success', icon: 'flash' }` when `expected_entry_id` set and status approved.
- `notificationRoute`: `helper_in`/`helper_out` → `/(resident)/daily-help`; `parcel_logged`/`parcel_collected` → `/(resident)/parcels`; `visit_auto_approved` → `/(resident)/request/[id]`.
- Screens: Home quick actions "Guest pass · Expecting · Daily help · Complaint"; card "n parcel(s) at the gate" (tap → parcels) when n > 0; section "Daily help inside now" (name, type, since time) when any. Daily help list (inside/left today pill, month days count), add form (name, phone, type Select, optional photo; client `normalizePhone`), detail (photo, code big with Share → "<Name>'s Sharda Serene gate code: 123456", today in/out, month list, Call, Remove with confirm). Expecting screen: purpose chips (Delivery/Cab/Service/Guest), company chips (by purpose: delivery → food/shop list, cab → Uber/Ola/Rapido), hours chips 1/2/4/8, Create; active list with Cancel. Parcels: At gate / Collected sections. More: Daily help, Expected deliveries, Parcels entries.

- [ ] Failing Jest tests: attendanceSummary (two entries same day = 1 day; entry in previous month excluded), insideNow, activeExpectations/expectationLabel ("Swiggy delivery · until 3:30 PM" with fixed TZ), visitPill auto-approved, notificationRoute new types.
- [ ] `npx jest` → FAIL. Implement.
- [ ] `npx jest`, `npx tsc --noEmit`, `npx expo export --platform android` → PASS. Commit `feat(mobile): resident daily help, expected deliveries and parcels`.

### Task 6: Mobile — guard daily help, parcels, auto-approved visits

**Files:** Create `src/app/(guard)/daily-help.tsx`, `src/app/(guard)/parcel.tsx`, `src/app/(guard)/parcels.tsx`, `src/lib/guardHelpers.ts` (+ test); modify `(guard)/index.tsx`, `(guard)/visit/[id].tsx`.

**Interfaces — Consumes:** Tasks 1–2, Task 4 (`reportError`/`guardErrorText`, states), Task 5 (`uploadSocietyPhoto`, `helperTypeLabel`, `visitPill`).
**Produces:**
- `matchHelpers<T extends { name: string; entry_code: string }>(list: T[], query: string): T[]` — all-digit query → code prefix match; else case-insensitive name contains; empty → all.
- `helperAction(h: { active: boolean }, open: boolean): 'check_in' | 'check_out' | 'blocked'`.
- Today: 2×2 tiles New visitor · Pass code · Daily help · Parcel; stats Waiting / Approved / Help inside / Parcels waiting (tap → parcels); section "Help inside now" with Check out per row.
- Daily help screen: numeric code field (autofocus) + search; exactly one match on a full 6-digit code shows its card at top; card: photo, name, type, flat labels, status; one big button Check in / Check out / "Blocked by office" (disabled). Realtime refresh on helper_attendance.
- Parcel screen: flat picker (existing flatPicker), courier chips + Other text, note, optional photo, Save; accepts params `flatId`, `visitId`, `courier` for prefill.
- Parcels screen: waiting list (flat, courier, time, photo thumb) with "Handed over" (prompt name, defaults to empty → `invalid_name` if blank) and "Returned".
- Visit detail: Auto-approved pill; button "Log as parcel" when `status === 'leave_at_gate'` and purpose delivery → parcel screen prefilled.

- [ ] Failing Jest tests: matchHelpers (digits prefix, name case-insensitive, empty), helperAction three cases.
- [ ] `npx jest` → FAIL. Implement.
- [ ] `npx jest`, `npx tsc --noEmit`, `npx expo export --platform android` → PASS. Commit `feat(mobile): guard daily help check-in, parcels and auto-approved visits`.

### Task 7: Admin website — Daily help and Parcels pages

**Files:** Create `apps/admin/src/pages/DailyHelp.tsx`, `apps/admin/src/pages/Parcels.tsx`, `apps/admin/src/lib/dailyHelp.ts` (+ `dailyHelp.test.ts`); modify `App.tsx` (routes), `components/Layout.tsx` (sidebar: "Daily help", "Parcels"), `scripts/smoke-queries.mjs` (select helpers/parcels as admin).

**Interfaces — Produces:** `todayStatus(rows: {entry_at: string; exit_at: string|null}[], today: Date): { label: 'Inside' | 'Left' | 'Not today'; time: string | null }`; `flatsText(labels: string[]): string` ("B1-A-101, B2-B-704"). DailyHelp: table name/type/phone/code/flats/today status/Active toggle (`set_helper_active`, confirm on deactivate), search box. Parcels: filter chips At gate / Collected / Returned / All, columns flat, courier, logged at, status, collected by/at.

- [ ] Failing Vitest tests for `todayStatus` (open row today → Inside with time; closed → Left; yesterday only → Not today) and `flatsText`.
- [ ] `npm test -w apps/admin` → FAIL. Implement. `npm test -w apps/admin`, `npm run build -w apps/admin` → PASS.
- [ ] Commit `feat(admin): daily help and parcels pages`.

### Task 8: Demo data, deploy to test, APKs (controller)

- [ ] Extend `scripts/seed-demo.mjs` (idempotent): helpers Sunita (maid, flats B1-A-101 & B1-A-102), Ramesh (driver, B1-A-101), Meena (cook, B2-A-301); one parcel at gate for B1-A-101; README demo section updated.
- [ ] Full local run: DB tests, Deno tests, `npm test`, mobile jest/tsc/export, admin build.
- [ ] `supabase db push` to `cwhhmqkanviioxtmwoce`, deploy `notify`, run seed against test project.
- [ ] Rebuild development + preview APKs (netinfo is native) from a clean worktree; install dev APK via adb; push branch, fast-forward `main`, Vercel auto-deploys admin.
