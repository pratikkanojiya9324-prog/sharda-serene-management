# Society Gate — Round 2: Daily Gate Features + Error Handling (Design)

Date: 2026-11-23
Status: Owner opted out of review questions ("implement the features") — calls below are Claude's, reported to the owner
Builds on: Round 1 (`2026-11-20-flat-login-round1-design.md`, built and on the test server)

## 1. Intent and why

The app is for the owner's own society, Sharda Serene. The owner wants features that
remove daily friction for residents and guards, and solid error handling — not
hosting/infrastructure work. The things that happen at the gate every single day are:
maids/cooks/drivers coming and going, food and parcel deliveries, cabs. Today each of
those either needs a live approval or isn't tracked at all. Round 2 makes them
one-tap or zero-tap, and makes every screen fail gracefully.

## 2. Goals

1. **Daily help & regular visitors** — a flat registers its maid, cook, driver, nanny,
   car cleaner, tutor etc. once. Each helper gets a permanent 6-digit entry code. The
   guard checks them in/out in seconds (code or search). Flats see who is inside now,
   today's in/out times and a monthly attendance count. One helper can work for many
   flats (same phone = same helper, linked to each flat).
2. **Expected deliveries / cabs (quick pre-approval)** — resident taps "Expecting
   delivery/cab/service", optionally picks the company (Swiggy, Zomato, Amazon,
   Flipkart, Blinkit, Zepto, Uber, Ola, Rapido, Other) and a window (1/2/4/8 hours).
   When the guard logs a visitor for that flat with a matching purpose inside the
   window, the visit is **auto-approved** — no waiting at the gate. The resident sees
   it marked "Auto-approved (you were expecting it)".
3. **Parcels at the gate** — guard logs a parcel for a flat (courier, optional photo,
   note). The flat sees "Parcel waiting at the gate" on Home and gets notified. Guard
   marks it collected (who collected). A "Leave at gate" delivery visit can be turned
   into a parcel with one tap.
4. **Error handling everywhere** —
   - App-wide crash screen (root error boundary) with "Restart" instead of a blank screen.
   - Offline banner when the phone has no internet; actions show "No internet" clearly.
   - Every list screen: loading → content / empty / error-with-Retry (no endless
     spinners, including when the account has no flat linked — a Round 1 backlog item).
   - Expired login detected → friendly "Please log in again" and sign-out, not raw errors.
   - Friendly text for every RPC error code (old and new); no raw database messages.
   - Submit buttons can't be double-tapped; forms keep what was typed when a save fails.
   - Round 1 app-side backlog minors (change-password busy reset, already-paid refresh,
     orphan photo cleanup on failed complaint, FlatSwitcher consistency, etc.).
5. **Admin website** — Daily help page (all helpers, flats, today's attendance,
   deactivate a helper) and Parcels page (log, filter waiting/collected).

## 3. Non-goals (this round)

- Push setup (Firebase) — the code already sends pushes; enabling it needs the owner's
  Firebase account. New Round 2 events are wired into the existing notify function so
  they work the moment Firebase is configured.
- Amenity booking, polls, SOS, directory, vehicles, payments — later rounds.
- Helper payments/salary tracking, helper ratings.
- Offline queueing of guard actions (show a clear error instead).

## 4. Anti-goals

- A flat seeing another flat's helpers' attendance (a helper shared by flats is visible
  to each linked flat — that's expected — but not to unlinked flats).
- Auto-approval letting someone in that the resident didn't expect (purpose must match,
  window must be active, expected entry is single-flat).
- The guard flow for daily help being slower than a paper register (target: ≤ 3 taps).
- Losing v1/Round 1 guarantees (society isolation, first-response-wins, 10-min expiry).

## 5. Constraints

- Same stack; new migrations 0014+; never edit 0001–0013 (use `create or replace` in a
  new migration to change `create_visit`).
- All writes via security-definer RPCs, `society_id` on every row, RLS for reads.
- pgTAP tests for every RPC/RLS rule; Jest tests for app logic, like Round 1.
- New native package `@react-native-community/netinfo` → dev APK rebuild needed.

## 6. Approaches (Claude's calls)

| Area | Chosen | Rejected and why |
|---|---|---|
| Daily help identity | One `helpers` row per person per society (matched by phone), linked to flats via `helper_flats` | A helper row per flat — duplicate codes, guard confusion, attendance split |
| Who adds helpers | Residents add for their own flat; admin views/deactivates | Admin-only — office becomes a bottleneck for every new maid |
| Daily help check-in | Guard enters code **or** searches by name; one button Check in/Check out | QR codes — helpers often have no smartphone; printed cards get lost |
| Quick pre-approval | New `expected_entries` table checked inside `create_visit` | Reusing guest passes — passes are per named guest with a code, too slow for Swiggy |
| Parcels | New `parcels` table, guard-owned lifecycle | Reusing visits — different lifecycle (stays days, collected by resident) |
| Offline detection | NetInfo + existing 'Network request failed' mapping | Error-sniffing only — can't show a banner before the user taps |

## 7. Decided parts of the how

### Data

- `helper_type` enum: maid, cook, driver, nanny, car_cleaner, tutor, other.
- `helpers`: id, society_id, name, phone (10 digits, unique per society), type,
  photo_path, entry_code (6 digits, unique per society among active helpers),
  active bool, created_at.
- `helper_flats`: helper_id, flat_id, society_id, added_at; PK (helper_id, flat_id).
- `helper_attendance`: id, society_id, helper_id, entry_at, exit_at, entry_by, exit_by.
  At most one open (exit_at null) row per helper.
- `expected_entries`: id, society_id, flat_id, purpose (visit_purpose: delivery/cab/
  service/guest), company text null, valid_from, valid_to, created_by, cancelled_at,
  used_count. Visits get `expected_entry_id` (nullable) for the auto-approval link.
- `parcels`: id, society_id, flat_id, courier, note, photo_path, status
  (at_gate/collected/returned), logged_by, logged_at, collected_at, collected_by_name,
  handed_by, visit_id null.

### RPCs (all security definer, error codes mapped in the app)

- Resident: `add_helper(flat, name, phone, type, photo_path)` (links existing helper by
  phone or creates one with a code), `remove_helper_from_flat(helper, flat)`,
  `create_expected_entry(flat, purpose, company, hours)`, `cancel_expected_entry(id)`.
- Guard: `find_helper_by_code(code)`, `helper_check_in(helper)`, `helper_check_out(helper)`,
  `log_parcel(flat, courier, note, photo_path, visit_id)`, `collect_parcel(id, name)`,
  `return_parcel(id)`.
- Admin: `set_helper_active(helper, bool)`.
- `create_visit` replaced: if an active expected entry exists for (flat, purpose) the
  visit is inserted as `approved` with `expected_entry_id`, `responded_at = now()` and
  the entry's `used_count` incremented. Delivery/cab entries stay valid for the whole
  window (multiple orders), not single-use.
- Reads via RLS: flat residents see their helpers (via helper_flats), those helpers'
  attendance, their expected entries and parcels; guards/admins see all in society.
- Notify (existing function, new cases): helper check-in/out → linked flats; parcel
  logged/collected → the flat. Auto-approved visit → flat gets "X entered (expected)".

### App screens

- Resident Home: quick actions become Guest pass · Expecting · Daily help · Complaint;
  cards for "Parcels at gate (n)" and "Daily help inside now".
- Resident: Daily help list + add (name, phone, type, photo) + helper detail
  (code to share, today, month attendance, call, remove); Expecting sheet with active
  expectations and cancel; Parcels list.
- Guard Today: tiles New visitor · Pass code · Daily help · Parcel; "Help inside now"
  section; daily help screen (code keypad + search + check in/out); log parcel screen;
  parcels waiting list with Collected.
- Visit detail: "Auto-approved" pill; "Log as parcel" on leave-at-gate deliveries.

### Error handling

- `ErrorBoundary` export in root layout; `OfflineBanner` in root layout.
- Shared `useLoad`-style pattern: `{status: loading|ready|error, retry}` with an
  `ErrorState` component (message + Retry), used by every list screen.
- `friendlyError` gets all new codes + JWT-expired / PGRST301 → sign-out path.

## 8. Left to the builder

Exact copy text, icon choices, attendance view layout, chunking of tasks, test layout,
seed data for demo helpers/parcels, admin website table design (follow existing pages).
