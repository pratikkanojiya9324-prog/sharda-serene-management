# Society Gate — Visitor Management App (Design)

Date: 2026-11-20
Status: Draft, awaiting approval

## 1. Intent and why

A security-gate app for a residential housing society (India). When a visitor
(delivery person, relative, cab, service worker) arrives at the gate, the guard
logs them in the app, the flat's resident is notified on their phone, and the
resident approves or denies entry. The guard sees the decision immediately.

Why: the owner wants to run it first in their own society, then sell it to
other societies as a paid product (similar market to MyGate, NoBrokerHood,
ADDA, ApnaComplex). Low running cost and simple implementation matter. The
owner knows JavaScript.

## 2. Goals (v1, own society)

1. **Guard app** — log a visitor: name, phone, photo, purpose (delivery /
   guest / cab / service / other), flat. See the resident's response live.
   Mark entry and exit.
2. **Resident app** — receive a push notification within seconds (even when
   the app is closed); respond Approve / Deny / Leave at gate.
3. **Pre-approval** — resident creates an expected-guest pass with a short
   code (e.g. 6 digits) valid for a date/time window; guard enters the code and
   the visitor is let in without waiting.
4. **Visitor log** — entry/exit history. Residents see their own flat's
   history; society admin sees the whole society.
5. **Admin panel (web)** — society admin manages towers/flats, residents
   (incl. multiple residents per flat), and guards.

## 3. Non-goals for v1 (later phases)

- Maintenance billing / payments, accounting
- Complaints / helpdesk, notices, polls, amenity booking
- Daily-help (maid/driver) attendance
- Intercom / voice calls
- Selling flow: self-serve society signup, subscription billing for societies
- Multiple languages (English only in v1)

## 4. Anti-goals (would be failure even if it "works")

- Notifications that arrive late or not at all — the guard ends up calling the
  resident anyway, so the app is pointless.
- One society able to see another society's data (critical once sold).
- A guard flow slower than writing in the paper register.

## 5. Constraints

- Owner knows JavaScript → TypeScript throughout.
- Minimal running cost; near ₹0/month for one society.
- Android is the priority (most guards and residents in India). iPhone
  supported from the same code; publishing to App Store is optional for v1
  ($99/yr).
- Must be multi-society in the data model from day one (so selling later does
  not require a rewrite), even though v1 has one society.

## 6. Approaches considered

| Approach | Trade-offs |
|---|---|
| **A. React Native (Expo) + Supabase, TypeScript** — chosen | One codebase for Android + iOS; admin web in same language; Postgres + Row-Level Security makes per-society isolation straightforward; Expo push notifications free; free tiers cover one society. |
| B. Flutter + Firebase | Smooth apps, quick start, free FCM. But Dart is a new language for the owner, Firestore's document model makes relational data (society → flat → resident) and reports harder, multi-tenant isolation via security rules is more error-prone. |
| C. Web app / PWA only | Cheapest, but iOS web push requires add-to-home-screen and is unreliable → violates the "notifications must arrive" anti-goal. Rejected. |

The owner chose **A** because they know JavaScript.

## 7. Decided parts of the how

- **Mobile:** React Native with Expo (TypeScript). One app with two roles
  (guard / resident) selected by the logged-in user's role — *builder's call
  whether to ship as one app or two*.
- **Backend:** Supabase — Postgres, Auth, Storage (visitor photos), Realtime
  (guard sees the decision live), Edge Functions (sending push).
- **Push:** Expo Push Notification service; device tokens stored per user.
- **Admin panel:** web app in TypeScript (e.g. React/Next.js) on Supabase.
- **Multi-tenancy:** every row carries `society_id`; Postgres Row-Level
  Security restricts every user to their society (and residents to their own
  flat where relevant).

### Core data (sketch)

- `societies` (id, name, address)
- `towers` (id, society_id, name)
- `flats` (id, society_id, tower_id, number)
- `profiles` (user id, name, phone) — a person, not tied to one society
- `memberships` (profile_id, society_id, role: admin | guard | resident) —
  one person can hold several roles and belong to several societies
- `flat_residents` (flat_id, profile_id, added_by) — many residents per flat
- `visitors` / `visits` (id, society_id, flat_id, name, phone, photo_url,
  purpose, status: pending | approved | denied | leave_at_gate | expired,
  responded_by, created_by_guard, entry_at, exit_at)
- `passes` (id, society_id, flat_id, created_by, guest name, code,
  valid_from, valid_to, revoked_at) — each use creates a `visits` row
  linked by `pass_id`
- `push_tokens` (profile_id, token, platform)

### Key flow

1. Guard creates a visit (pending) → Edge Function sends push to every
   resident of that flat.
2. Any one resident responds → status updated → guard screen updates via
   Realtime. First response wins.
3. Guard marks entry; later marks exit.

## 8. Decisions after builder review

Decided by the owner:

- **No response from resident → "Call resident" button.** If a visit is still
  pending after ~60 seconds, the guard sees a "Call resident" button that opens
  the phone dialer with the resident's number (if several residents, list
  them). No paid SMS/IVR in v1. Guards can therefore see residents' numbers —
  accepted trade-off. A pending visit becomes `expired` after ~10 minutes with
  no response; the guard can still record the outcome manually (e.g. "allowed
  after call") so the log stays complete. *(Timeouts are Claude's call.)*
- **Guards use their own phones**, logging in with phone OTP like everyone
  else. No shared gate device, no per-shift PIN. `created_by_guard` is the
  guard's profile. Single gate assumed for v1; no `gate_id`.

Claude's calls (owner may override):

- **Memberships table** (see data sketch) so one person can be admin +
  resident, or belong to several societies. Cheap now, a rewrite later.
- **Accounts:** admin pre-adds each person's phone number and links them to a
  flat or guard role; on first OTP login they're matched by phone. No
  self-signup. A resident can add household members to their own flat.
- **Passes:** reusable within their validity window (multi-day guests);
  resident can revoke. Code is 6 digits, unique among the society's
  currently-valid passes. Each use creates a normal visit (status approved,
  with entry/exit) linked to the pass, and notifies the resident.
- **Online-only in v1.** If the gate's internet is down, guards fall back to
  the paper register. Offline mode would roughly double the guard app's work.
- **Push reliability:** on first launch, the resident app guides Android users
  to disable battery optimisation for the app (important on Xiaomi/Oppo/Vivo/
  Realme). The "Call resident" fallback covers the remaining failures.

## 9. Left to the builder

- Screen layouts and styling
- Login method details (phone OTP via Supabase Auth is the expected default
  for India)
- Folder structure, state management, testing approach
- Admin web framework specifics
- Photo compression / storage retention
