# Society Gate — Round 1: Flat Login, Family, Notices, Complaints, Bills (Design)

Date: 2026-11-20
Status: Draft, awaiting approval
Builds on: `2026-11-20-society-gate-design.md` (v1, built and tested)

## 1. Intent and why

The owner's society, **Sharda Serene**, wants residents to log in per **flat**, not per
person, with no OTP/SMS (avoids SMS cost and TRAI DLT registration, and fits how
families share one phone account). After login the app should grow into a full
society app like MyGate/NoBroker. All 11 feature areas are wanted; this round delivers
the new login and the first three features. Speed matters: there is only a test
environment right now and the goal is to get testable APKs quickly.

## 2. Goals (Round 1)

1. **Flat login (residents)** — welcome screen "Welcome Sharda family members";
   dropdowns Building (1, 2) → Wing (A, B) → Flat (101–106 … 701–706: 7 floors × 6
   flats; 42 per wing, 168 total) → password → Login. One password per flat, shared by
   the family.
2. **Staff login** — "Guard / Admin login" link → username + password. Guards land on
   the existing gate screens; admins on admin screens.
3. **Remove OTP** entirely (login/verify screens, phone auth, invites/claim flow).
4. **Family tab** — the flat's members: name, mobile, relation. Loaded by the admin.
5. **Notice board** — admin posts (title, body, optional image or PDF), can pin and
   delete; all flats are push-notified; residents read newest first, pinned on top.
6. **Complaints** — flat raises (category, description, optional photo); status
   Open → In progress → Resolved; comment thread both ways; flat notified on status
   change / admin comment; admins notified on new complaint.
7. **Maintenance bills (track only)** — admin generates monthly bills for all flats
   (one amount for all, or per-flat amounts from CSV); residents see dues, due date,
   history; admin marks paid (mode: cash/cheque/UPI/other, reference) → an in-app
   receipt with a receipt number appears; flat notified on new bill and on payment.
8. **Password management** — admin sets/resets any flat's password (and staff
   passwords); a flat can change its own password in the app.
9. **Demo data** — Sharda Serene with 2 buildings × 2 wings × 42 flats, a few demo
   family members, demo bills/notices, demo staff accounts. Real data is loaded later
   by the owner via the admin website.

## 3. Non-goals (this round)

- Online bill payment (Razorpay/UPI gateway) — planned next for bills.
- PDF receipts (in-app receipt screen only).
- Residents editing their own family list (admin-managed this round).
- Remaining features — later rounds, in this order: amenity booking, daily help,
  polls, SOS + emergency contacts, resident directory, deliveries, vehicles/parking.
- Self-registration of any kind.

## 4. Anti-goals

- One flat able to see another flat's bills, complaints, family or visitors.
- Login slower or more confusing than "pick flat, type password".
- Losing the v1 guarantees: cross-society isolation, first-response-wins visits,
  10-minute expiry, call-resident fallback.

## 5. Constraints

- Same stack as v1: Supabase (Postgres, Auth, RLS, RPCs, Storage, Realtime, Edge
  Functions), Expo app, Vite admin web, TypeScript. Test Supabase project
  `cwhhmqkanviioxtmwoce` is the only hosted environment.
- Keep `society_id` on every row (the product may be sold to other societies later).
- Never edit applied migrations 0001–0010; new migrations 0011+.
- Notifications still require the owner's Firebase setup (unchanged).

## 6. Approaches considered (owner chose A)

| Approach | Trade-offs |
|---|---|
| **A. Each flat and each staff member is a Supabase Auth account** with a hidden synthetic email + password | Reuses Supabase password auth and all RLS built on `auth.uid()`; admin manages passwords through a service-role Edge Function. Needs the account model to change from "person" to "flat". |
| B. Custom login table + self-issued JWTs | Much more security-critical code for no benefit. |
| C. Keep phone OTP underneath + flat PIN | Still needs SMS/DLT — what the owner wants to avoid. Rejected. |

Admin split (owner agreed): **in the app** — post notices, handle complaints, mark
bills paid; **on the admin website** — bulk flat/member import, passwords, staff
accounts, monthly bill generation (plus the same notice/complaint/bill views).

## 7. Decided parts of the how

### Accounts
- **Flat account**: Supabase auth user with email `flat-<flat_id>@login.societygate.app`
  (flat_id = uuid; never shown to users). Linked to its flat through `flat_residents`
  and a `resident` membership. `profiles.name` = flat label, e.g. "B1-A-101".
- **Staff account**: email `<username>@staff.<society_id>.societygate.app`;
  membership role `guard` or `admin`. Usernames unique per society, lowercase
  `[a-z0-9_.-]{3,30}`.
- The app/admin build the synthetic email from the selection/username and call
  `signInWithPassword`. Nothing synthetic is ever displayed.
- `profiles.phone` becomes nullable (accounts are no longer people). Remove the
  invite/claim path for new accounts (tables may stay; no UI uses them).
- **Edge Function `accounts`** (service role, caller must be admin of the society):
  `create_flat_account(flat_id, password)`, `set_password(user_id, password)`,
  `create_staff(username, name, role, password)`, `disable_staff(user_id)`,
  `bulk_import(rows)`. Passwords min 6 chars.
- Phone auth/SMS disabled in config; email/password auth enabled; email signup
  disabled (accounts only via the Edge Function); email confirmations off for these
  synthetic accounts.

### Buildings and wings
- Add `towers.building text not null` (e.g. "Building 1"); `towers.name` = wing
  ("A"). Unique `(society_id, building, name)`. Labels: "B1-A-101".
- **Login directory**: RPC `login_directory(p_society_id uuid)` executable by `anon`,
  returning only `{building, wing, flat_id, flat_number}` for that society — no names,
  phones or other data. The app is configured with the society via
  `EXPO_PUBLIC_SOCIETY_ID`; the welcome text comes from the society name
  (`login_directory` also returns it).

### Family
- New table `family_members(id, society_id, flat_id, name, phone null, relation null,
  created_at)`; read: the flat's account, guards and admins of the society; write:
  admins. Composite FK `(flat_id, society_id)`.
- `flat_contacts` (guard "Call resident") now returns family members with phones.

### Notices
- `notices(id, society_id, title, body, attachment_path null, attachment_kind
  'image'|'pdf' null, pinned bool, created_by, created_at)`; read: society members;
  write: admins. Private storage bucket `notices` (`{society_id}/...`; admins write,
  members read).

### Complaints
- `complaints(id, society_id, flat_id, category enum('plumbing','electrical','lift',
  'cleaning','security','parking','other'), description, photo_path null, status
  enum('open','in_progress','resolved') default 'open', created_by, created_at,
  updated_at)`; `complaint_comments(id, complaint_id, society_id, author_id, body,
  created_at)`.
- Flat: create own, read own, comment on own. Admin: read all in society, change
  status, comment. Status changes only via RPC `set_complaint_status`. Photos in
  bucket `complaint-photos` (`{society_id}/...`).

### Bills
- `bills(id, society_id, flat_id, period date (first of month), amount numeric(10,2),
  due_date date, status enum('unpaid','paid') default 'unpaid', paid_at, payment_mode
  enum('cash','cheque','upi','other') null, payment_reference null, receipt_no text
  null unique per society, created_at)`; unique `(flat_id, period)`.
- RPCs (admin only): `generate_bills(p_period, p_amount, p_due_date)` for all flats
  without a bill that period; `generate_bills_custom(p_period, p_due_date,
  p_rows jsonb)` for per-flat amounts; `mark_bill_paid(p_bill_id, p_mode,
  p_reference)` → assigns receipt_no like `SS-2026-11-0001`.
- Flats read their own bills; admins read all in society.

### Notifications
- Extend the existing `notify` Edge Function + trigger pattern with new message types:
  `notice_posted` (all resident devices in the society), `complaint_created` (admins),
  `complaint_updated` (the flat), `bill_created` and `bill_paid` (the flat).
  Recipients resolved server-side from memberships; same NOTIFY_SECRET auth.

### App structure
- **Resident tabs**: Home (visitors: pending requests + recent), Notices, Complaints,
  Bills, Family; a "More" screen for Passes, Visitor history, Change password,
  Logout.
- **Guard**: existing gate screens; flat picker uses Building → Wing → Flat.
- **Admin (in app)**: Notices (post/pin/delete), Complaints (list/filter/status/
  comment), Bills (list by month, mark paid).
- **Admin website**: Flats & members import (CSV: building,wing,flat,password,
  member_name,member_phone,relation — one row per member, password repeated or blank
  to keep), staff accounts, password reset, bill generation, plus notices/complaints/
  bills views.

## 8. Decisions after builder review

Owner decided:
- **Per-member identity: "Who's using this phone?"** After a flat logs in on a
  device, the app asks the user to tap their name from the flat's family list (or
  "Someone else" → type a name). Stored on the device (AsyncStorage), changeable from
  More. Actions carry it: `visits.responded_by_name`, `complaints.created_by_name`,
  `complaint_comments.author_name`, `passes.created_by_name` (text, nullable). UI shows
  "Approved by Rahul (B1-A-101)". The RPCs take an optional `p_actor_name text`
  (trimmed, max 60 chars).
- **Modern, aesthetic UI** on both app and admin website (see §9).
- Implement quickly without further questions.

Claude's calls:
- **Existing test accounts**: the test project's phone-OTP users, memberships, invites,
  visits and passes are wiped and replaced by the new demo data (test environment only).
  Local `seed.sql` is rewritten for the new model.
- **First admin / staff bootstrap**: `scripts/create-staff.mjs` (Node, uses the service
  role key from env, never committed) creates staff accounts directly through the
  Supabase Admin API; the `accounts` Edge Function handles everything after that.
  Demo staff: `admin` / `Admin@123`, `guard1` / `Guard@123`.
- **Demo data creation**: `scripts/seed-demo.mjs` (service role) creates Sharda Serene,
  2 buildings × wings A/B × flats 101–706, a flat account per flat with demo password
  `Sharda@<building><wing><flat>` (e.g. `Sharda@1A101`), 1–4 demo family members per
  flat for a subset, 3 notices, a few complaints, and bills for the current month.
- **Passwords**: min 6 chars; bulk import generates a random 8-char password for any
  flat without an account and no password given, and returns a downloadable list.
  Supabase's default auth rate limits are accepted for this round.
- **Bulk import**: upsert by (building, wing, flat number); missing building/wing is
  created; blank password keeps the existing one; family members of each flat present
  in the CSV are replaced wholesale. Per-row results reported (ok / error message).
- **Backfill**: existing `towers.building` defaults to 'Building 1'.
- **Guard & admin flat lists** use authenticated table reads (with `towers.building`),
  not `login_directory`.
- **Profile visibility**: flat accounts are visible to staff of the society; family
  data lives in `family_members` (RLS as in §7).
- **PDF notices**: open via a signed URL in the phone's viewer (`Linking.openURL`);
  max 10 MB per attachment; images shown inline.
- **Receipt numbers**: `SS-YYYY-MM-NNNN` by payment month, per society, from a counter
  table updated under row lock (prefix from society short code, default "SS").
- **Notifications**: new types reuse the notify function (batched 100 per Expo request,
  already implemented) and the same Vault/NOTIFY_SECRET trigger pattern. Unit tests
  with mocks plus one manual check are sufficient.

## 9. UI direction

- **Mobile**: clean, card-based, generous spacing, rounded corners (16), soft shadows,
  one brand colour (deep teal `#0F766E`) with a warm accent (amber `#F59E0B`) on a
  light neutral background; light/dark aware. Bottom tab bar with icons
  (`@expo/vector-icons` Ionicons). Welcome screen with a gradient header
  (`expo-linear-gradient`) and the society name; large touch targets; status pills
  (Open/In progress/Resolved, Paid/Unpaid, Approved/Denied) with colour + icon; empty
  states with an icon and one line of copy; pull-to-refresh on lists. Shared theme
  tokens in `apps/mobile/src/theme/`.
- **Admin website**: Tailwind CSS (Vite plugin); sidebar layout, top bar with society
  name, data tables with filters, modal forms, toast messages; same colours.

## 10. Left to the builder

Screen layouts and styling; receipt screen design; exact CSV parsing error messages;
pagination sizes; demo family names/amounts; test structure.
