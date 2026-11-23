# Round 3 — Community: Polls (priority), Amenities, SOS, Directory, Events, Documents — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the society's shared life into the app, with secret one-vote-per-flat polls first, then amenity booking, SOS with emergency contacts, an opt-in directory, events and documents.

**Architecture:** New Postgres tables, RLS and security-definer RPCs (migrations 0020–0024). Data that must stay private (poll choices, the directory, slot occupancy, RSVP lists) is read only through definer functions. Notifications go through the existing pg_net trigger → `notify` Edge Function. The app reuses Round 2's error-handling foundation (`useFocusLoad`, `screenState`, `ErrorState`, `NoFlatState`, `reportError`). Polls ship end-to-end first (DB → app → website); the other features follow.

**Tech Stack:** Supabase (Postgres 17, RLS, Storage, pg_net, Realtime, Deno Edge Functions), Expo SDK 58 + Expo Router, Vite + React + Tailwind v4, pgTAP, jest-expo, Vitest, Deno test.

**Spec:** `docs/superpowers/specs/2026-11-23-round3-community-design.md` (section 7 is binding).

## Global Constraints

- **Migrations:**
  - Never edit 0001–0019.
  - New files: `0020_polls.sql`, `0021_amenities.sql`, `0022_sos_contacts_directory.sql`, `0023_events_documents.sql`, `0024_notify_round3.sql`.
- **Every new table:**
  - Has `society_id` and RLS enabled.
  - References flats through the composite FK `(flat_id, society_id)` → `flats(id, society_id)`.
  - Is written only through RPCs: revoke insert/update/delete from authenticated and anon.
- **Security-definer functions:**
  - Use `set search_path = ''` and qualified names.
  - Raise `not_authorized` for unknown ids or another society's ids.
  - Revoke EXECUTE from public and anon; grant it to authenticated.
  - Check roles with `public.has_role(society, role)`, `public.is_flat_resident(flat)` and `public.admin_society()`.
- **Actor names:** take `p_actor_name text default null` and apply the Round 1 rules (`public.clean_actor_name`, `invalid_actor_name` over 60 characters).
- **Time zone:**
  - Use **Asia/Kolkata** for all date and slot maths, in both SQL (`at time zone 'Asia/Kolkata'`) and the app/website (`Intl` with `timeZone: 'Asia/Kolkata'`).
  - Display format: `Sat 30 Nov, 6:00 PM`.
- **Flat label format:** `B1-A-101`, built as building number, wing, flat. Use the existing `flatLabel` helpers; for SQL, compute it the same way the notify function does.
- **Polls:**
  - 2–6 options, each label 1–80 characters.
  - Question 1–200 characters; description up to 1000 or null.
  - `max_choices` is 1 when not multi, and 1..option count when multi.
  - `closes_at` must be after now() and no more than 90 days ahead; otherwise raise `invalid_time`.
  - "Open" means `closed_at is null and now() < closes_at`.
  - One vote per flat, no changes after voting, secret choices.
  - At most one reminder per 6 hours.
  - `total_flats` is the number of distinct flats in the society that have at least one `flat_residents` row.
- **Amenities:**
  - `slot_minutes` must be one of 30, 60, 120, 240 or 1440.
  - Bookings run from today up to 14 days ahead in IST.
  - `max_upcoming` is 1–10, default 2.
  - A 1440-minute slot covers the whole day, from open_time to close_time.
- **Enums:**
  - `booking_status`: `pending, confirmed, rejected, cancelled`.
  - `sos_type`: `medical, fire, security, lift, other`, labelled Medical, Fire, Security, Lift stuck, Other.
  - `sos_status`: `open, acknowledged, resolved, cancelled`.
  - `rsvp_response`: `going, maybe, no`.
  - `doc_category`: `bylaws, minutes, circular, form, other`, labelled Bylaws, AGM minutes, Circulars, Forms, Other.
- **Limits:**
  - RSVP heads 1–20 for going/maybe; stored as 0 for `no`.
  - Emergency contact phone must match `^\+?[0-9]{3,15}$`.
  - Booking reject reason up to 200 characters (`invalid_reason`); SOS resolve note up to 300 (`invalid_note`).
- **New error codes and copy:** add these to `apps/mobile/src/lib/errors.ts` and `apps/admin/src/lib/errors.ts` as each task needs them. Copy is exact:

  | Code | Copy |
  |---|---|
  | `invalid_question` | Enter the question |
  | `invalid_options` | Add 2 to 6 options |
  | `invalid_choice` | Choose an option |
  | `too_many_choices` | You picked too many options |
  | `poll_closed` | Voting has closed |
  | `already_voted` | Your flat has already voted |
  | `remind_too_soon` | A reminder was sent recently — try again later |
  | `invalid_time` | Check the date and time |
  | `in_past` | That time has already passed |
  | `too_far_ahead` | You can book up to 14 days ahead |
  | `outside_hours` | It's closed at that time |
  | `bad_slot` | Pick one of the listed slots |
  | `slot_taken` | Someone just booked this slot — pick another |
  | `booking_limit` | Your flat already has the maximum upcoming bookings for this |
  | `amenity_inactive` | This is not open for booking right now |
  | `already_started` | It has already started |
  | `not_pending` | This booking was already decided |
  | `invalid_slot` | Choose a slot length |
  | `invalid_limit` | Choose a number from 1 to 10 |
  | `invalid_reason` | Reason is too long |
  | `sos_closed` | This alert is already closed |
  | `invalid_note` | Note is too long |
  | `invalid_title` | Enter a title |
  | `event_over` | This event has already started |
  | `invalid_heads` | Enter how many people (1–20) |
  | `invalid_contact_phone` | Enter a valid phone number |
  | `invalid_file` | Choose a PDF or image |
- **UI:**
  - Use the existing theme (`@/theme/components`, `@/components/resident`), teal/amber, Ionicons, cards, pills, empty states and pull-to-refresh.
  - Every list screen uses `useFocusLoad`, where `load` resolves `false` on failure.
  - Feed `screenState({loaded, error, needsFlat, flatLoading, hasFlat})` into `ErrorState`/`NoFlatState`.
  - The ready-state Banner shows `error ?? loadFailure`.
  - Submit buttons use `loading`, reset busy in `finally`, and keep typed values on failure.
  - Errors go through `reportError` (resident/admin) or `guardErrorText` (guard).
- **Expo Router:**
  - Never put non-route files under `apps/mobile/src/app/`.
  - Hide non-tab resident routes by adding them to `HIDDEN` in `(resident)/_layout.tsx` (`tabBarItemStyle: {display:'none'}`), never with `href: null`.
  - PostgREST embeds of towers use `towers!flats_tower_id_fkey`.
- **Storage policies:**
  - Use the CASE form from 0009.
  - Qualify `objects.name` in subqueries, because a table alias column like `name` shadows it.
- **Commits:** messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. No secrets.
- **DB test command** (needs Docker running and `npx supabase start`): `npx supabase db reset && npm run dev:secrets && npx supabase test db`. Then run `npm run gen:types`.
- **Mobile checks** (in `apps/mobile`): `npx jest`, `npx tsc --noEmit`, `npx expo export --platform android`.
- **Admin checks:** `npm test -w apps/admin`, `npm run build -w apps/admin`.

## Review Focus

1. **Poll secrecy through the API.** An admin or another flat doing `select * from poll_votes`, or calling `poll_results` before voting, learns nothing about other flats' choices. Tested in Task 1 pgTAP: admin selecting `poll_votes` gets 0 rows; resident counts are null before voting.
2. **Double vote or late vote.** Two phones of the same flat vote at once, or a vote arrives after `closes_at`. The result must be exactly one row, the second call gets `already_voted`, and a late call gets `poll_closed`. Tested in Task 1 pgTAP, including a vote after `closes_at` is moved into the past as postgres.
3. **Slot race and grid edges.** Two flats book the same slot: the second gets `slot_taken`. A start not on the grid gets `bad_slot`. A slot ending after close_time gets `outside_hours`. An IST date boundary is not treated as UTC. Tested in Task 4 pgTAP with a 23:30 IST slot.
4. **SOS failure is visible.** When `raise_sos` fails offline or errors, the resident sees "Couldn't send SOS", Try again and the emergency numbers, never a spinner. A second press while one is open returns the same alert. Tested in Task 9 Jest (`sosSendState`) and Task 5 pgTAP (idempotent raise).
5. **Directory phone leak.** A member with `in_directory` true and `show_phone` false shows no phone. Turning `in_directory` off hides the member completely. Tested in Task 5 pgTAP.

---

### Task 1: Polls (DB)

**Files:**
- Create: `supabase/migrations/0020_polls.sql`, `supabase/tests/polls.test.sql`.
- Regenerate: `packages/shared/src/database.types.ts`.
- Modify: `packages/shared/src/constants.ts`, adding `POLL_MIN_OPTIONS = 2`, `POLL_MAX_OPTIONS = 6`, `POLL_REMIND_HOURS = 6`.
- Modify: `packages/shared/src/selects.ts`, adding `POLL_SELECT = 'id, question, description, options, multi, max_choices, closes_at, closed_at, created_at, last_reminded_at'`.

**Interfaces — Produces:**
- Tables:
  - `polls(id, society_id, question, description, options jsonb [{id uuid, label text}], multi bool, max_choices int, closes_at, closed_at, created_by, created_at, last_reminded_at)`.
  - `poll_votes(poll_id, flat_id, society_id, option_ids uuid[], voted_by_name, voted_at)`, with PK `(poll_id, flat_id)`.
- RLS:
  - `polls` can be selected by `is_member(society_id)`.
  - `poll_votes` can be selected **only** where `is_flat_resident(flat_id)`. There is no admin or guard select.
- RPCs:
  - `create_poll(p_question text, p_description text, p_options text[], p_multi boolean, p_max_choices int, p_closes_at timestamptz) returns polls`. Admin only. Errors: `invalid_question`, `invalid_options`, `invalid_choice` (bad max_choices), `invalid_time`.
  - `vote_poll(p_poll_id uuid, p_flat_id uuid, p_option_ids uuid[], p_actor_name text default null) returns void`. Resident of the flat, same society as the poll. Errors:
    - `poll_closed`
    - `invalid_choice` for an empty list, an unknown id or a duplicate
    - `too_many_choices`
    - `already_voted`, raised by catching `unique_violation`
  - `close_poll(p_poll_id uuid) returns polls`. Admin only. Raises `poll_closed` if the poll is already closed or past its closing time.
  - `delete_poll(p_poll_id uuid) returns void`. Admin only. Votes cascade.
  - `remind_poll(p_poll_id uuid) returns polls`. Admin only. Sets `last_reminded_at = now()`. Errors: `poll_closed`; `remind_too_soon` if the last reminder was under 6 hours ago.
  - `poll_results(p_poll_id uuid, p_flat_id uuid default null) returns jsonb`. Returns `{ counts: {<option_id>: int} | null, voted_flats: int, total_flats: int, my_vote: {option_ids, voted_by_name, voted_at} | null, not_voted: text[] | null, is_open: bool }`.
    - Every option id appears in `counts`, including those with 0 votes.
    - Admins always get `counts` and get `not_voted`, a sorted list of labels of flats with residents that haven't voted.
    - Residents (with `p_flat_id`, and the caller must reside there) get `counts` only when their flat voted or the poll is not open; otherwise `counts` is null. They always get `not_voted: null`.
    - Guards, and anyone without `p_flat_id` who is not an admin, get `not_authorized`.

- [ ] **Write failing pgTAP tests** in `polls.test.sql`:
  - **create_poll validation:**
    - 1 option → `invalid_options`; 7 options → `invalid_options`
    - blank question → `invalid_question`
    - `closes_at` in the past → `invalid_time`
    - multi with max 4 on 3 options → `invalid_choice`
    - a resident calling create → `not_authorized`
  - **Voting:**
    - flat A votes → `poll_results(p, A).my_vote` is set, and `counts` has the chosen option at 1 and the others at 0
    - flat B, before voting, gets `counts` null and `voted_flats` 1
    - A votes again → `already_voted`
    - single-choice with 2 ids → `too_many_choices`
    - an unknown option id → `invalid_choice`
  - **Secrecy:**
    - an admin selecting `count(*)` from `poll_votes` gets 0
    - flat B selecting `poll_votes` gets 0
  - **Admin results:**
    - `not_voted` contains B's label and not A's
    - `total_flats` counts only flats with residents
  - **Closing and access:**
    - after `close_poll`, B voting → `poll_closed`, B sees counts, and close again → `poll_closed`
    - after setting `closes_at = now() - 1 minute` as postgres, voting → `poll_closed`
    - a guard calling `poll_results` → `not_authorized`
  - **Reminders:** `remind_poll` twice → the second raises `remind_too_soon`.
  - **Cross-society:** an admin of another society calling close/results → `not_authorized`.
- [ ] **Run the DB test command.** Expected: FAIL.
- [ ] **Implement** the migration and the shared constants and select.
- [ ] **Run the DB test command again.** Expected: PASS, including all older files. Then run `npm run gen:types` and `npm test -w packages/shared`. Expected: PASS.
- [ ] **Commit:** `feat(db): secret one-vote-per-flat polls`.

### Task 2: Polls (mobile: resident + admin app)

**Files:**
- Create:
  - `apps/mobile/src/lib/polls.ts` (+ `polls.test.ts`)
  - `src/app/(resident)/polls/{_layout.tsx,index.tsx,[id].tsx}`
  - `src/app/(admin)/polls/{_layout.tsx,index.tsx,new.tsx,[id].tsx}`
  - `src/components/PollResults.tsx`
- Modify:
  - `(resident)/_layout.tsx`: add `polls` to HIDDEN
  - `(resident)/index.tsx`: Home card
  - `(resident)/more.tsx`: Polls entry
  - `(admin)/_layout.tsx`: add a TABS entry `polls`, title "Polls", icon `stats-chart-outline`/`stats-chart`, placed after Notices
  - `src/lib/errors.ts` (+ test): poll codes
  - `src/lib/notificationRoute.ts` (+ test)

**Interfaces:**
- **Consumes:** the Task 1 RPCs, `POLL_SELECT` and the constants.
- **Produces:**
  - `pollIsOpen(p: {closes_at: string; closed_at: string | null}, now: Date): boolean`
  - `closesLabel(p, now): string`, returning "Closes in 3 days", "Closes in 5 hours", "Closes in 20 min" or "Closed"
  - `selectionError(p: {multi: boolean; max_choices: number}, selected: string[]): string | null`, returning `null`, "Choose an option" or "You can pick up to 2"
  - `resultBars(options: {id: string; label: string}[], counts: Record<string, number> | null, myOptionIds: string[]): {id, label, count, pct, mine}[]`, where pct is rounded to a whole number, 0 when there are no votes, and options keep their original order
  - `turnoutText(voted: number, total: number): string`, e.g. "12 of 40 flats voted (30%)"
  - `<PollResults bars turnout />`, horizontal bars with %, where your own choice gets a check icon
  - `notificationRoute`: `poll_created`/`poll_reminder` → `/(resident)/polls/[id]` with `{id}`
- **Resident polls list:**
  - Open / Closed sections.
  - Each row shows the question, a `closesLabel` pill, and "Voted"/"Not voted" for the current flat (from the `poll_votes` own-flat select).
- **Resident poll detail:**
  - Shows the question, the description, and options as radio buttons (single) or checkboxes (multi, with a "Pick up to N" hint).
  - "Vote" asks for confirmation with an Alert: "Submit your flat's vote?" / "It can't be changed later."
  - Calls `vote_poll` with the actor name from the existing "who's using this phone" actor (`actor.ts`).
  - After voting or closing, it shows `PollResults` and "Voted by <name> · <time>".
  - The Home card "Polls waiting for your vote (n)" appears when n > 0 and opens the list.
- **Admin app:**
  - The list shows open and closed polls with turnout.
  - The **new** form has: question, description, options (start with 2 inputs, "Add option" up to 6, remove buttons from the 3rd), a Multiple choice switch with a max-choices stepper, and a closing date (chips for 1/3/7/14 days, default 7, closing at 9:00 PM IST on that day).
  - Detail shows results, turnout, the not-voted flats list, and buttons for Send reminder, Close voting (confirm) and Delete (confirm).

- [ ] **Write failing Jest tests:**
  - `pollIsOpen`: closed_at set → false; closes_at past → false; future → true
  - `closesLabel`: the four cases with a fixed `now`
  - `selectionError`: empty → "Choose an option"; 3 picks with max 2 → "You can pick up to 2"; ok → null
  - `resultBars`: `counts` null → count 0, pct 0; `{a:3,b:1}` → 75/25 with mine flagged
  - `turnoutText(12,40)`; `turnoutText(0,0)` → "0 of 0 flats voted (0%)"
  - `friendlyError` for each poll code
  - `notificationRoute` for `poll_created`
- [ ] **Run `npx jest`.** Expected: FAIL.
- [ ] **Implement** the libs and the screens.
- [ ] **Run the mobile checks.** Expected: PASS.
- [ ] **Commit:** `feat(mobile): polls for residents and the office app`.

### Task 3: Polls (admin website)

**Files:**
- Create: `apps/admin/src/pages/Polls.tsx`, `apps/admin/src/lib/polls.ts` (+ `polls.test.ts`).
- Modify:
  - `App.tsx`: route `/polls`
  - `components/Layout.tsx`: sidebar "Polls", placed after Notices
  - `lib/errors.ts`: poll codes
  - `scripts/smoke-queries.mjs`: admin selects `POLL_SELECT` and calls `poll_results`; resident selects own `poll_votes`

**Interfaces:**
- **Produces:**
  - `resultRows(options, counts, total)` → `{label, count, pct}[]`
  - `turnoutText(voted, total)`, the same copy as mobile
  - `defaultClosesAt(now: Date): string`, giving 7 days ahead at 21:00 IST as a `datetime-local` value
- **Page:**
  - The list table shows Question, Status (Open/Closed), Closes, and Turnout.
  - "New poll" opens a form with dynamic options (2–6), a Multiple choice checkbox with max choices, and closes at.
  - Selecting a row opens a panel with result bars, turnout, the not-voted flats list (chips), and buttons for Send reminder, Close voting and Delete. Close and Delete use `confirm()`.

- [ ] **Write failing Vitest tests:** `resultRows` with null counts and with counts; `turnoutText`; `defaultClosesAt` (fixed date → "2026-11-30T21:00").
- [ ] **Run `npm test -w apps/admin`.** Expected: FAIL.
- [ ] **Implement** the page. Then run the admin checks. Expected: PASS.
- [ ] **Commit:** `feat(admin): polls page with results, turnout and reminders`.

### Task 4: Amenity booking (DB)

**Files:**
- Create: `supabase/migrations/0021_amenities.sql`, `supabase/tests/amenities.test.sql`.
- Regenerate types.
- Modify:
  - `constants.ts`: `SLOT_MINUTES = [30, 60, 120, 240, 1440]`, `BOOKING_DAYS_AHEAD = 14`
  - `selects.ts`: `AMENITY_SELECT`, and `BOOKING_SELECT` (with amenity name and the flat label embed)

**Interfaces:**
- **Produces:**
  - Tables:
    - `amenities(id, society_id, name, description, open_time time, close_time time, slot_minutes int, requires_approval bool, max_upcoming int default 2, fee_note, active bool default true, created_at)`
    - `amenity_bookings(id, society_id, amenity_id, flat_id, start_at, end_at, status booking_status, booked_by_name, decided_by, decided_at, reject_reason, created_at)`, with the unique partial index `(amenity_id, start_at) where status in ('pending','confirmed')`
  - RLS:
    - Members can select `amenities`.
    - Admins and guards of the society can select bookings, and so can residents of the booking's flat.
  - `upsert_amenity(p_id uuid, p_name text, p_description text, p_open_time time, p_close_time time, p_slot_minutes int, p_requires_approval boolean, p_max_upcoming int, p_fee_note text, p_active boolean) returns amenities`
    - Admin only. A null `p_id` creates the amenity.
    - Errors: `invalid_name`, `invalid_slot`, `invalid_time` (open ≥ close, or the window is shorter than one slot when slot < 1440), `invalid_limit`.
  - `amenity_slots(p_amenity_id uuid, p_date date, p_flat_id uuid default null) returns table(start_at timestamptz, end_at timestamptz, state text)`
    - `state` is one of `free`, `taken`, `mine` or `past`.
    - Each slot is an IST grid cell from open_time to close_time.
    - Members only. A non-null `p_flat_id` requires the caller to reside there (it is used for `mine`).
  - `book_amenity(p_amenity_id uuid, p_flat_id uuid, p_start_at timestamptz, p_actor_name text default null) returns amenity_bookings`. Resident of the flat. Checks run in this order:
    1. `amenity_inactive`
    2. `in_past`
    3. `too_far_ahead` (IST date beyond today + 14)
    4. `bad_slot` (the start is not on the grid; for 1440 the start must equal date + open_time)
    5. `outside_hours`
    6. `booking_limit` (count of the flat's pending/confirmed bookings for this amenity with `end_at > now()` ≥ `max_upcoming`)
    7. `slot_taken` (catch `unique_violation`)

    The status is `pending` if approval is required, otherwise `confirmed`.
  - `cancel_booking(p_booking_id uuid) returns amenity_bookings`. Resident of the flat. Errors: `already_cancelled` (cancelled or rejected), `already_started`.
  - `decide_booking(p_booking_id uuid, p_approve boolean, p_reason text default null) returns amenity_bookings`. Admin only. Errors: `not_pending`, `invalid_reason`.

- [ ] **Write failing pgTAP tests** for a court with 60-minute slots, open 06:00–23:59. Create the amenities with `upsert_amenity` as admin, and pick dates relative to the current IST date:
  - Book tomorrow 18:00 IST → confirmed.
  - Flat B booking the same slot → `slot_taken`.
  - 18:30 → `bad_slot`; 05:00 → `outside_hours`; day +15 → `too_far_ahead`; an earlier hour today → `in_past`.
  - The third upcoming booking with max 2 → `booking_limit`.
  - `amenity_slots` for flat A shows `mine`; for flat B the same slot shows `taken`.
  - The party hall (1440, approval) creates a `pending` booking; `decide_booking` reject with a reason → `rejected`; deciding again → `not_pending`.
  - A slot freed by cancel can be booked again.
  - Cancel by flat B → `not_authorized`.
  - A 23:00 slot on a court closing at 23:59 is valid; at 30-minute slots, 23:30 is valid.
  - An IST boundary case: booking `(tomorrow 00:30 IST)` on an amenity open from 00:00 counts as tomorrow's date, not today's in UTC.
  - Upsert validation errors.
- [ ] **Run.** Expected: FAIL.
- [ ] **Implement.** Run the DB test command. Expected: PASS. Then run gen:types.
- [ ] **Commit:** `feat(db): amenity booking with slot grid and approvals`.

### Task 5: SOS, emergency contacts, directory (DB)

**Files:**
- Create: `supabase/migrations/0022_sos_contacts_directory.sql`, `supabase/tests/sos_contacts_directory.test.sql`.
- Regenerate types.
- Modify:
  - `constants.ts`: `SOS_TYPES: {value, label}[]` with the labels from Global Constraints
  - `selects.ts`: `SOS_SELECT` (with the flat label embed), `EMERGENCY_CONTACT_SELECT`

**Interfaces:**
- **Produces:**
  - Table `sos_alerts(id, society_id, flat_id, type sos_type, status sos_status default 'open', raised_by_name, created_at, acknowledged_by_name, acknowledged_at, resolved_at, resolved_note, resolved_by_name)`, with the unique partial index `(flat_id) where status in ('open','acknowledged')`.
  - RLS: admins and guards of the society can select, and so can residents of the alert's flat.
  - SOS RPCs:
    - `raise_sos(p_flat_id uuid, p_type sos_type, p_actor_name text default null) returns sos_alerts`. Resident of the flat. If an alert is already open or acknowledged, it returns that row unchanged.
    - `cancel_sos(p_id uuid) returns sos_alerts`. Resident of the flat. Works from open or acknowledged; otherwise raises `sos_closed`.
    - `ack_sos(p_id uuid, p_actor_name text default null) returns sos_alerts`. Guard or admin. open → acknowledged. If it is already acknowledged, return it unchanged. If it is resolved or cancelled, raise `sos_closed`.
    - `resolve_sos(p_id uuid, p_note text default null, p_actor_name text default null) returns sos_alerts`. Guard or admin. open or acknowledged → resolved. Errors: `sos_closed`, `invalid_note`.
  - Table `emergency_contacts(id, society_id, name, phone, note, sort_order int default 0, created_at)`. Members can select it.
  - Contact RPCs:
    - `upsert_emergency_contact(p_id uuid, p_name text, p_phone text, p_note text, p_sort_order int) returns emergency_contacts`. Admin only. Errors: `invalid_name`, `invalid_contact_phone`.
    - `delete_emergency_contact(p_id uuid) returns void`. Admin only.
  - `family_members` gains `in_directory boolean not null default false` and `show_phone boolean not null default false`.
  - Directory RPCs:
    - `set_directory_visibility(p_member_id uuid, p_in_directory boolean, p_show_phone boolean) returns family_members`. Resident of that member's flat. `show_phone` true forces `in_directory` true; `in_directory` false forces `show_phone` false.
    - `resident_directory() returns table(flat_id uuid, flat_label text, name text, relation text, phone text)`. Covers the caller's society, which must be a society they are a member of. Returns only `in_directory` members, with `phone` null unless `show_phone`. Ordered by flat label, then name.
    - `directory_committee() returns table(name text)`. Returns the display names of the society's admin accounts (the profiles name column; read 0001), skipping nulls.

- [ ] **Write failing pgTAP tests:**
  - **SOS:**
    - `raise_sos` → open. Raising again returns the same id, and there is still only one row.
    - Flat B cannot see A's alert. A guard sees it.
    - A resident calling `ack_sos` → `not_authorized`.
    - Guard ack → acknowledged with the name; ack again stays acknowledged.
    - Resolve with a 301-character note → `invalid_note`. Resolve → resolved. Resolve again → `sos_closed`. Cancel after resolve → `sos_closed`.
    - A new raise after resolve creates a new row.
  - **Contacts:**
    - Phone `112` is ok; `+911123456789` is ok; `12` → `invalid_contact_phone`; `abc123` → `invalid_contact_phone`.
    - A resident calling upsert → `not_authorized`.
  - **Directory:**
    - A member with `in_directory` true and `show_phone` false appears with a null phone.
    - With `show_phone` true, the phone appears.
    - With `in_directory` false, the member is absent.
    - Visibility set by a resident of another flat → `not_authorized`.
    - A member of another society never appears.
- [ ] **Run.** Expected: FAIL. **Implement.** Then run. Expected: PASS. Then run gen:types.
- [ ] **Commit:** `feat(db): SOS alerts, emergency contacts and opt-in resident directory`.

### Task 6: Events and documents (DB)

**Files:**
- Create: `supabase/migrations/0023_events_documents.sql`, `supabase/tests/events_documents.test.sql`.
- Regenerate types.
- Modify:
  - `constants.ts`: `DOC_CATEGORIES: {value, label}[]`
  - `selects.ts`: `EVENT_SELECT`, `DOCUMENT_SELECT`

**Interfaces:**
- **Produces:**
  - Tables:
    - `events(id, society_id, title, description, place, starts_at, ends_at, created_by, created_at, cancelled_at)`
    - `event_rsvps(event_id, flat_id, society_id, response rsvp_response, heads int, by_name, updated_at)`, with PK `(event_id, flat_id)`
    - `documents(id, society_id, title, category doc_category, file_path, file_kind text check in ('pdf','image'), created_by, created_at)`
  - RLS:
    - Members can select `events` and `documents`.
    - `event_rsvps` can be selected by residents of the flat, and by admins.
  - Event RPCs:
    - `create_event(p_title text, p_description text, p_place text, p_starts_at timestamptz, p_ends_at timestamptz) returns events`. Admin only. Errors: `invalid_title` (1–120 characters), `invalid_time` (starts in the past, or ends ≤ starts).
    - `cancel_event(p_id uuid) returns events`. Admin only.
    - `rsvp_event(p_event_id uuid, p_flat_id uuid, p_response rsvp_response, p_heads int default 1, p_actor_name text default null) returns event_rsvps`. Resident of the flat. Upserts the RSVP. Errors: `event_over` (started or cancelled), `invalid_heads`.
    - `event_summary(p_event_id uuid) returns jsonb`. Returns `{going_flats, going_heads, maybe_flats, maybe_heads, no_flats, rsvps: [{flat_label, response, heads, by_name}] | null}`. `rsvps` is for admins only. Any member can call it.
  - Document RPCs:
    - `add_document(p_title text, p_category doc_category, p_file_path text, p_file_kind text) returns documents`. Admin only. The path must start with `<society_id>/`; otherwise raise `invalid_file`. Errors: `invalid_title`, `invalid_file` (kind).
    - `delete_document(p_id uuid) returns text`. Admin only. Returns the `file_path` so the caller can remove the storage object.
  - Private bucket `society-docs`:
    - Admins of the society in the first path segment can insert and delete.
    - Members of that society can select.

- [ ] **Write failing pgTAP tests:**
  - **create_event validation:**
    - a past start → `invalid_time`
    - ends before it starts → `invalid_time`
    - a resident creating one → `not_authorized`
  - **RSVPs:**
    - RSVP going with 3 heads, then change it to maybe with 2 → one row
    - `event_summary`: `maybe_heads` is 2; residents get `rsvps` null; admins get the list
    - heads 0 for going → `invalid_heads`; RSVP `no` stores heads 0
    - an RSVP after `cancel_event` → `event_over`
    - flat B cannot select A's RSVP
  - **Documents:**
    - `add_document` with a path under another society → `invalid_file`; a resident adding one → `not_authorized`
    - `delete_document` returns the path
  - **Storage policies:** a resident inserting into `society-docs` is denied; a member selecting is allowed.
- [ ] **Run.** Expected: FAIL. **Implement.** Then run. Expected: PASS. Then run gen:types.
- [ ] **Commit:** `feat(db): events with RSVPs and society documents`.

### Task 7: Notifications and realtime for Round 3

**Files:**
- Create: `supabase/migrations/0024_notify_round3.sql`, `supabase/tests/notify_round3.test.sql`, `supabase/functions/notify/round3.test.ts`.
- Modify: `supabase/functions/notify/push.ts`, `index.ts`.

**Interfaces:**
- **Produces:**
  - Triggers that never block, using the same pg_net + Vault pattern as 0013/0016.
  - Builders with exact copy. Data is `{type, id}`, and times are IST in the format `Sat 30 Nov, 6:00 PM`:

    | Trigger | Type | Recipients | Title | Body |
    |---|---|---|---|---|
    | `polls` INSERT | `poll_created` | all resident tokens of the society | "New poll" | `<question>` (truncated to 120 chars with "…") |
    | `polls` UPDATE when `last_reminded_at` changes | `poll_reminder` | tokens of resident flats that haven't voted | "Your vote is needed" | "Your flat hasn't voted yet: `<question>`" |
    | `events` INSERT | `event_created` | all residents | "New event: `<title>`" | "`<starts_at>` · `<place>`", or just the time when there is no place |
    | `amenity_bookings` INSERT with status `pending` | `booking_requested` | admins | "Booking request" | "B1-A-101 wants Party hall on Sat 30 Nov, 6:00 PM" |
    | `amenity_bookings` UPDATE pending → confirmed | `booking_decided` | the flat | "Booking confirmed" | "Party hall · Sat 30 Nov, 6:00 PM" |
    | `amenity_bookings` UPDATE pending → rejected | `booking_decided` | the flat | "Booking rejected" | "Party hall · Sat 30 Nov, 6:00 PM — `<reason>`" (no suffix without a reason) |
    | `sos_alerts` INSERT | `sos_raised` | all guards and admins | "🚨 SOS — Medical" (type label) | "B1-A-101 needs help now" |
    | `sos_alerts` UPDATE → acknowledged | `sos_update` | the flat | "Help is on the way" | "Ravi is coming" (or "The guard is coming" when there is no name) |
    | `sos_alerts` UPDATE → resolved | `sos_update` | the flat | "SOS resolved" | "Marked resolved by Ravi" |

  - `sos_raised` messages set `priority: 'high'` and `sound: 'default'`.
  - Cancelled alerts send nothing.
  - Realtime: `alter publication supabase_realtime add table public.sos_alerts, public.polls, public.amenity_bookings;`

- [ ] **Write failing Deno tests**, one per builder with the exact strings, plus the truncation and no-place/no-reason variants. Run `npx -y deno test supabase/functions/notify`. Expected: FAIL.
- [ ] **Write failing pgTAP tests:** inserts and updates on each table succeed with the Vault secrets absent, and the publication includes the 3 tables.
- [ ] **Implement.** Run Deno and the DB test command. Expected: PASS.
- [ ] **Commit:** `feat(notify): poll, event, booking and SOS notifications; realtime for SOS`.

### Task 8: Mobile resident — amenities, events, documents, directory, emergency numbers

**Files:**
- Create:
  - `src/lib/community.ts` (+ `community.test.ts`)
  - `src/app/(resident)/amenities/{_layout.tsx,index.tsx,[id].tsx,bookings.tsx}`
  - `src/app/(resident)/events/{_layout.tsx,index.tsx,[id].tsx}`
  - `src/app/(resident)/documents.tsx`, `directory.tsx`, `emergency.tsx`
- Modify:
  - `(resident)/_layout.tsx`: add `amenities`, `events`, `documents`, `directory`, `emergency` to HIDDEN
  - `(resident)/index.tsx`: the quick action "Book amenity" replaces "Complaint" (Complaint stays a tab), plus an "Upcoming event" card
  - `(resident)/more.tsx`: entries
  - `(resident)/family.tsx`: per-member "Show in directory" and "Show phone" switches → `set_directory_visibility`
  - `errors.ts` (+ test): amenity, event and contact codes
  - `notificationRoute.ts` (+ test)

**Interfaces:**
- **Consumes:** the Task 4–6 RPCs, selects and constants.
- **Produces:**
  - `dateChips(now: Date, days = 15): {date: string /* YYYY-MM-DD IST */; label: string}[]`, labelled "Today", "Tomorrow", then "Wed 26"
  - `slotLabel(startIso: string, endIso: string): string`, e.g. "6:00 – 7:00 PM" and "Full day"
  - `bookingPill(status): {label, tone}`: pending → "Waiting for approval"/warning, confirmed → "Confirmed"/success, rejected → "Rejected"/danger, cancelled → "Cancelled"/neutral
  - `rsvpText(s: {going_flats: number; going_heads: number}): string`, e.g. "12 flats going · 31 people" (singular "1 flat going · 1 person")
  - `filterDirectory<T extends {name: string; flat_label: string}>(rows: T[], q: string): T[]`, case-insensitive on name or flat label
  - `groupDocuments<T extends {category: DocCategory}>(docs: T[]): {category, label, items: T[]}[]`, in the order bylaws, minutes, circular, form, other, with empty groups dropped
  - `notificationRoute`: `booking_decided` → `/(resident)/amenities/bookings`; `event_created` → `/(resident)/events/[id]`
- **Screens:**
  - **Amenities list:** name, hours, slot length and fee note.
  - **Amenity detail:**
    - Date chips and a slot grid from `amenity_slots`. Taken slots are grey and disabled, mine are teal, past slots are hidden.
    - Tapping a free slot asks for confirmation and then books.
    - On `slot_taken` it shows the error and reloads the slots.
  - **My bookings:** upcoming and past, with a pill and Cancel (confirm) on upcoming pending/confirmed bookings.
  - **Events:**
    - Upcoming and Past sections.
    - Detail shows the time, place, description, `rsvpText`, and Going/Maybe/Not going chips with a heads stepper (1–20, hidden for Not going) and Save.
  - **Documents:** grouped list; tapping one opens it with the same viewer approach as notice attachments (signed URL).
  - **Directory:**
    - A search box, the committee list at the top, then flats with their members.
    - A Call button only when a phone is present.
    - The empty state: "No one has joined the directory yet. Turn it on for your family in the Family tab."
  - **Emergency numbers:** a list with a big Call button (`tel:`) and notes.

- [ ] **Write failing Jest tests:**
  - `dateChips`, using fixed now `2026-11-23T20:00:00Z` (= 24 Nov 01:30 IST, so the first chip is `2026-11-24` "Today")
  - `slotLabel`, including full day
  - `bookingPill`, all four statuses
  - `rsvpText`, plural and singular
  - `filterDirectory`
  - `groupDocuments`, order and dropping empty groups
  - new `friendlyError` codes and new routes
- [ ] **Run `npx jest`.** Expected: FAIL. **Implement.** Then run the mobile checks. Expected: PASS.
- [ ] **Commit:** `feat(mobile): amenity booking, events, documents, directory and emergency numbers`.

### Task 9: Mobile SOS (resident, guard, admin app)

**Files:**
- Create:
  - `src/lib/sos.ts` (+ `sos.test.ts`)
  - `src/components/SosHoldButton.tsx`, `src/components/SosBanner.tsx`
  - `src/app/(resident)/sos.tsx`
  - `src/lib/useOpenSos.ts`
- Modify:
  - `(resident)/_layout.tsx`: add `sos` to HIDDEN
  - `(resident)/index.tsx`: SOS button + "Emergency numbers" link near the top
  - `(guard)/_layout.tsx` and `(admin)/_layout.tsx`: render `<SosBanner/>` above the tabs so it shows on every tab
  - `errors.ts`, `guardErrors.ts` (+ tests): `sos_closed`, `invalid_note`
  - `notificationRoute.ts` (+ test)

**Interfaces:**
- **Consumes:** the Task 5 RPCs and `SOS_SELECT`, the Task 7 realtime publication, and `emergency_contacts` (as in Task 8).
- **Produces:**
  - `SOS_HOLD_MS = 2000`
  - `sosTypeLabel(t)` and `sosTypeIcon(t)` (medical → `medkit`, fire → `flame`, security → `shield`, lift → `swap-vertical`, other → `alert-circle`)
  - `sosStatusText(a: {status; acknowledged_by_name}): string`:
    - "Sent — alerting the guards"
    - "Ravi is on the way" (or "A guard is on the way" when there is no name)
    - "Resolved"
    - "Cancelled"
  - `sosSendState(r: {busy: boolean; error: string | null; alert: {status} | null}): 'idle' | 'sending' | 'failed' | 'active' | 'done'`
    - busy → sending
    - error and no alert → failed
    - open or acknowledged → active
    - resolved or cancelled → done
    - otherwise idle
  - `useOpenSos(societyId)`: loads open and acknowledged alerts with `SOS_SELECT`, subscribes to realtime `sos_alerts` for the society, and refetches on any change and on app focus.
  - `notificationRoute`: `sos_raised` → `/` (the guard/admin home shows the banner); `sos_update` → `/(resident)/sos`.
- **Resident flow:**
  - Holding `SosHoldButton` for 2 s fills a ring; releasing early cancels.
  - After the hold, a sheet shows the 5 type buttons. One tap sends `raise_sos` with the actor name.
  - The app then navigates to the `sos` screen, which shows live status via a realtime subscription on its own row, plus "Cancel — false alarm" (confirm) while active.
  - The `failed` state shows a big red card: "Couldn't send SOS", the error text, a "Try again" button, and the emergency numbers list with Call buttons.
  - If an alert is already open, Home shows a red strip "SOS active — tap to view" instead of the hold button.
- **Guard and admin banner:**
  - A red card per open alert: "🚨 B1-A-101 · Medical · 2 min ago · raised by Rahul".
  - Buttons: "On my way" (`ack_sos`, hidden once acknowledged, which then shows "Ravi is on the way") and "Resolved" (prompts for an optional note, then `resolve_sos`).
  - The banner is collapsed to nothing when there are no alerts.

- [ ] **Write failing Jest tests:** `sosStatusText` for all statuses and the no-name variant; `sosSendState` for every branch; the type labels and icons; `friendlyError`/`guardErrorText('sos_closed')`; the routes.
- [ ] **Run `npx jest`.** Expected: FAIL. **Implement.** Then run the mobile checks. Expected: PASS.
- [ ] **Commit:** `feat(mobile): hold-to-send SOS with live guard and office alerts`.

### Task 10: Admin website — Amenities, Events, Documents, Emergency contacts, SOS log

**Files:**
- Create:
  - `apps/admin/src/pages/{Amenities.tsx,Events.tsx,Documents.tsx,EmergencyContacts.tsx,SosLog.tsx}`
  - `apps/admin/src/lib/community.ts` (+ `community.test.ts`)
- Modify:
  - `App.tsx`: routes
  - `components/Layout.tsx`: sidebar Amenities, Events, Documents, Emergency contacts, SOS
  - `lib/errors.ts`: the remaining codes
  - `scripts/smoke-queries.mjs`: admin selects of each new table, plus resident selects of bookings, contacts and documents

**Interfaces:**
- **Produces:**
  - `formatSlot(startIso, endIso): string`, e.g. "Sat 30 Nov · 6:00 – 8:00 PM" (IST)
  - `bookingTab(rows, tab: 'pending' | 'upcoming' | 'past', now: Date)`:
    - pending = status pending and not ended
    - upcoming = confirmed and `end_at > now`
    - past = everything else
  - `sosDuration(createdIso, resolvedIso | null, now: Date): string`, e.g. "12 min", "1 h 5 min" or "ongoing 3 min"
- **Pages:**
  - **Amenities:**
    - A list with Edit (a form for every `upsert_amenity` field) and an Active toggle.
    - A bookings table with Pending / Upcoming / Past tabs; Approve, and Reject with a reason prompt.
  - **Events:** create form, list, a panel with the `event_summary` totals and RSVP list, and Cancel (confirm).
  - **Documents:**
    - Upload a PDF or image, of 10 MB at most, to `society-docs/<society_id>/<uuid>.<ext>`, then call `add_document`. On an RPC failure, remove the uploaded object.
    - The list has category filter chips.
    - Delete calls `delete_document`, then removes the storage object.
  - **Emergency contacts:** an editable table with add, edit, delete and sort order.
  - **SOS log:** a table (flat, type, raised by, time, status, handled by, duration, note) with an "Open only" toggle, and On my way / Resolved actions on open alerts.

- [ ] **Write failing Vitest tests:** `formatSlot` (fixed ISO → exact string); `bookingTab`, all three tabs; `sosDuration`, all three forms.
- [ ] **Run `npm test -w apps/admin`.** Expected: FAIL. **Implement.** Then run the admin checks. Expected: PASS.
- [ ] **Commit:** `feat(admin): amenities, events, documents, emergency contacts and SOS log pages`.

### Task 11: Demo data, deploy to test, APK (controller)

- [ ] **Extend `scripts/seed-demo.mjs`** so it stays idempotent:
  - **Polls:**
    - An open poll: "Which colour for the building repaint?" with options Cream, Light grey and Peach, closing in 7 days. Flat B1-A-102 votes Cream.
    - A closed poll: "Should we hire a second night guard?" with options Yes and No, and votes from 2 flats.
  - **Amenities:** Party hall (full day, approval, fee note "₹2,000 per day"), Badminton court (60 min, 06:00–22:00), Clubhouse (120 min, 08:00–22:00, approval).
  - **Event:** "Diwali get-together", 7 days ahead at 7 PM in the Clubhouse.
  - **Documents:** 2 small generated PDFs, "Society bylaws" (bylaws) and "AGM minutes 2026" (minutes).
  - **Emergency contacts:**
    - Police 112, Fire 101, Ambulance 108, Women helpline 1091
    - "Society office" with the demo admin phone placeholder
  - **Directory:** B1-A-101 family members opted in, one of them with show_phone.
- [ ] **Run the full local suite:** DB tests, Deno, `npm test`, the mobile checks, the admin build, and smoke.
- [ ] **Deploy to the test project `cwhhmqkanviioxtmwoce`** (`--yes`, already consented for test deploys): `supabase db push`, deploy `notify`, then seed. Smoke against test.
- [ ] **Merge and build:** fast-forward `main` and push (Vercel redeploys admin). Then build the **preview** APK only, from a clean worktree; there are no native changes, so the dev APK is not needed.
