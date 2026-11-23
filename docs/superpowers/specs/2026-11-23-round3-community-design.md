# Society Gate — Round 3: Community Features (Design)

Date: 2026-11-23
Status: Owner opted out of review questions ("decide and proceed"). Owner said mid-design:
**"its very important that is polls"**, so polls come first and get the most depth.
The calls below are Claude's and will be reported to the owner.
Builds on: Round 2 (`2026-11-23-round2-daily-gate-design.md`, on the test server at migration 0019)

## 1. Intent and why

Sharda Serene decides things together: AGM questions, paint colours, festival budgets,
security agency changes. Today that happens on WhatsApp, where nobody can tell who voted
twice or which flats haven't voted. Round 3 brings the society's shared life into the app.
Polls are the priority. After polls come amenity booking, SOS with emergency contacts,
a resident directory, events and documents. Every feature keeps the Round 2 standard of
error handling.

## 2. Goals

1. **Polls (priority)**
   - The office creates a poll from the admin website or the admin mobile app. A poll has:
     - a question
     - an optional description
     - 2–6 options
     - single choice, or multiple choice with up to N picks
     - a closing date and time
   - **One vote per flat.** Voting is by flat, matching the per-flat login.
   - Votes are **secret**. No one, the office included, can see which option a flat
     picked. The office sees counts, turnout (x of y flats), and which flats have not
     voted yet, so it can chase them.
   - Residents see live results after their flat votes, or once the poll closes. The
     flat's own choice is highlighted.
   - A vote cannot be changed after it is cast.
   - Residents can see "Voted by Rahul" (the actor name) on their own flat's vote.
   - All residents are notified when a poll is posted. The office can send a reminder,
     which notifies only the flats that have not voted (at most once every 6 hours).
   - The office can close a poll early or delete it. Polls with votes cannot be edited.
   - Home shows a card for open polls not yet voted.
2. **Amenity booking**
   - The office sets up amenities (party hall, clubhouse, badminton court, guest room…)
     with:
     - opening hours
     - slot length (30/60/120/240 min, or full day)
     - whether the office must approve
     - a max number of upcoming bookings per flat
     - an optional fee note (display only)
   - Residents pick a date (today up to 14 days ahead) and a free slot, then book.
   - Each slot belongs to one flat.
   - If approval is needed, the booking starts as pending and the office
     approves or rejects it (optionally with a reason).
   - Residents can cancel before the start.
   - Notifications:
     - booking approved or rejected → the flat
     - new booking needing approval → admins
3. **SOS + emergency contacts**
   - A resident **holds** the red SOS button on Home for 2 seconds, then picks one of:
     Medical, Fire, Security, Lift stuck, Other. That makes 2 deliberate actions, so
     there are no pocket alerts.
   - Every guard and admin gets a push notification and a live red banner on their
     Today/Home screen.
   - The guard taps "On my way" (name recorded), then "Resolved" with an optional note.
   - The resident sees the status live and can cancel it as a false alarm.
   - Only one open SOS per flat. A second press returns the existing alert.
   - Emergency contacts are an office-managed list (police 112, fire 101,
     ambulance 108, society office, electrician…) with one-tap call. The list is
     reachable from Home and from the SOS screen.
4. **Resident directory**
   - Residents can find neighbours by name or flat. It is **opt-in per family member**:
     - the flat chooses "show in directory"
     - and, separately, "show phone"
   - Flats with nobody opted in don't appear.
   - The office committee list appears at the top: admin staff accounts with a
     display name.
5. **Events**
   - The office posts an event: title, description, start/end, place.
   - Flats RSVP Going / Maybe / Not going, with a head count of 1–20.
   - The office sees the totals and the list of who is going.
   - All residents are notified about a new event.
   - Past events move to a "Past" section.
6. **Documents**
   - The office uploads PDFs or images: bylaws, AGM minutes, forms, circulars.
   - Each document has a category and a title.
   - Residents browse by category and open a document in the viewer, using the same
     approach as notice attachments.
7. **Admin website**
   - Pages: Polls (create, live results, turnout, not-voted list, remind, close),
     Amenities (manage plus bookings with approve/reject), Events (create, RSVPs),
     Documents (upload/delete), Emergency contacts (manage), SOS log.

## 3. Non-goals (this round)

- Paid amenity bookings or online payment, which belong to Round 4 (money).
- Poll weighting by flat area, proxy votes, or ranked choice.
- Chat, forums, marketplace, or classifieds.
- Event photos and galleries.
- SOS to people outside the society (SMS to relatives).
- Firebase setup. New notification types plug into the existing notify function and
  work once FCM is configured.

## 4. Anti-goals

- Anyone (the office included, or via the API) learning how a specific flat voted. This
  needs a vote table that clients cannot read across flats, and results coming only
  from a security-definer function.
- A flat voting twice, or voting after the close. Both must be enforced in the database,
  not just the UI.
- Two flats getting the same amenity slot, including under a double-tap or a race.
- An SOS that silently fails. The resident must see clearly whether it was sent, or a
  big error with "Call guard" and the emergency contacts.
- A phone number appearing in the directory without that member opting in.

## 5. Constraints

- Same stack and conventions as Rounds 1–2. New migrations start at 0020. Never edit
  0001–0019.
- All writes go through security-definer RPCs with `set search_path=''`. `society_id` is
  on every row, with composite `(flat_id, society_id)` FKs and RLS for reads.
- pgTAP covers every RPC and RLS rule. Jest covers app logic and Vitest covers the admin
  libs.
- Society time zone is **Asia/Kolkata**. Slot maths, "today" and closing times are all
  in IST.
- No new native packages, so the dev APK doesn't need a rebuild (the preview APK still
  does, for the new screens).

## 6. Approaches (Claude's calls)

| Area | Chosen | Rejected and why |
|---|---|---|
| Poll secrecy | `poll_votes` with **no client select policy** except the voter's own flat. Results come from the `poll_results(poll)` definer function: option counts plus turnout, and the not-voted flat list for admins only | Plain RLS-visible votes, which would leak choices to admins; fully anonymous votes with no flat link, which would make "one vote per flat" unenforceable |
| Multi-choice | `poll_votes` has one row per flat with `option_ids uuid[]`, validated in the RPC | A row per option, which makes "one vote per flat" harder to enforce atomically |
| Booking clash | Slots aligned to the amenity grid, plus a unique partial index on `(amenity_id, start_at)` where status is pending or confirmed | A range exclusion constraint, which is overkill while every slot length is fixed per amenity |
| SOS delivery | Insert triggers notify, plus realtime on `sos_alerts` for guard/admin screens | Polling, which is too slow for an emergency |
| Directory | The `resident_directory()` definer function returns only opted-in members | Widening the `family_members` RLS, which would expose rows that haven't opted in |
| Documents storage | New private bucket `society-docs`, using the notice-attachment pattern (CASE-form policy) | Reusing the notices bucket, which would mix lifecycles |

## 7. Decided parts of the how

### Data (migrations 0020–0024)

- **0020 polls**:
  - `polls`:
    - id, society_id, question (1–200), description (≤1000, null), options jsonb `[{id,label}]`
      (2–6, labels 1–80)
    - multi bool, max_choices int (1..options; 1 when not multi)
    - closes_at, closed_at, created_by, created_at, last_reminded_at
  - `poll_votes`: poll_id, flat_id, society_id, option_ids uuid[], voted_by_name, voted_at.
    PK `(poll_id, flat_id)`.
  - RPCs:
    - `create_poll` (admin)
    - `vote_poll(poll, flat, option_ids, actor)` (resident of the flat)
    - `close_poll` (admin)
    - `delete_poll` (admin)
    - `remind_poll` (admin; error `remind_too_soon` within 6h)
    - `poll_results(poll)`, which returns a jsonb: `{counts:{option_id:n}, voted_flats, total_flats, my_vote, not_voted:[flat labels] (admin only)}`.
      Counts are visible to admins always, and to residents only after their flat voted or
      once the poll is closed. Otherwise counts is null.
  - "Open" means `closed_at is null and now() < closes_at`. `total_flats` counts flats in
    the society that have at least one resident account.
- **0021 amenities**:
  - `amenities`:
    - id, society_id, name, description, open_time, close_time (time, IST)
    - slot_minutes in (30,60,120,240,1440), requires_approval, max_upcoming (1–10, default 2)
    - fee_note, active
  - `amenity_bookings`:
    - id, society_id, amenity_id, flat_id, start_at, end_at
    - status enum `pending, confirmed, rejected, cancelled`
    - booked_by_name, decided_by, decided_at, reject_reason, created_at
  - RPCs:
    - `upsert_amenity` (admin)
    - `book_amenity(amenity, flat, start_at, actor)`, with errors:
      - `in_past`
      - `too_far_ahead` (>14 days)
      - `outside_hours`
      - `bad_slot` (not on the grid)
      - `slot_taken`
      - `booking_limit`
      - `amenity_inactive`
    - `cancel_booking` (resident; `already_started`, `already_cancelled`)
    - `decide_booking(id, approve, reason)` (admin; `not_pending`)
  - A 1440-minute slot is the whole day from open_time to close_time.
- **0022 SOS, emergency contacts, directory**:
  - `sos_type` enum: `medical, fire, security, lift, other`.
  - `sos_alerts`:
    - id, society_id, flat_id, type, raised_by_name, created_at
    - status `open, acknowledged, resolved, cancelled`
    - acknowledged_by_name, acknowledged_at, resolved_at, resolved_note
  - Unique partial index `(flat_id) where status in ('open','acknowledged')`.
  - RPCs:
    - `raise_sos(flat, type, actor)`, which returns the existing open alert if there is one
    - `cancel_sos` (resident)
    - `ack_sos` (guard/admin, actor name)
    - `resolve_sos(id, note, actor)` (guard/admin; `sos_closed`)
  - `emergency_contacts`: id, society_id, name, phone (digits 3–15, may start with +),
    note, sort_order. Admin RPCs `upsert_emergency_contact` and
    `delete_emergency_contact`. All members can read.
  - `family_members` gains `in_directory bool default false` and `show_phone bool default false`.
    RPC `set_directory_visibility(member, in_directory, show_phone)` (resident of the
    flat; show_phone implies in_directory).
  - `resident_directory()` returns flat label, member name, relation, and phone (only if
    show_phone). Any society member can call it.
  - `profiles` committee: the directory top section lists the admins'
    `profiles.full_name` without phones.
- **0023 events + documents**:
  - `events`: id, society_id, title, description, place, starts_at, ends_at, created_by,
    created_at, cancelled_at.
  - `event_rsvps`: event_id, flat_id, society_id, response enum `going, maybe, no`, heads
    1–20, by_name, updated_at. PK `(event_id, flat_id)`. The flat can change its RSVP
    until the event starts (`event_over`).
  - RPCs: `create_event`/`cancel_event` (admin), `rsvp_event` (resident).
  - Residents see their own RSVP. The `event_summary(event)` definer function returns
    totals for everyone, plus the per-flat list for admins.
  - `documents`: id, society_id, title, category enum `bylaws, minutes, circular, form, other`,
    file_path, file_kind (`pdf`/`image`), created_by, created_at. Bucket `society-docs`.
    RPCs `add_document` and `delete_document` (admin). All members can read.
- **0024 notify + realtime**:
  - New events:
    - `poll_created` (all residents)
    - `poll_reminder` (not-voted flats)
    - `event_created` (all residents)
    - `booking_requested` (admins)
    - `booking_decided` (flat)
    - `sos_raised` (all guards + admins, high priority)
    - `sos_update` (flat, on ack/resolve)
  - Realtime publication: `sos_alerts`, `polls`, `amenity_bookings`.

### Error codes and copy (app)

| Code | Copy |
|---|---|
| `invalid_question` | Enter the question |
| `invalid_options` | Add 2 to 6 options |
| `invalid_choice` | Choose an option |
| `too_many_choices` | You picked too many options |
| `poll_closed` | Voting has closed |
| `already_voted` | Your flat has already voted |
| `remind_too_soon` | A reminder was sent recently — try again later |
| `in_past` | That time has already passed |
| `too_far_ahead` | You can book up to 14 days ahead |
| `outside_hours` | It's closed at that time |
| `bad_slot` | Pick one of the listed slots |
| `slot_taken` | Someone just booked this slot — pick another |
| `booking_limit` | Your flat already has the maximum upcoming bookings for this |
| `amenity_inactive` | This is not open for booking right now |
| `already_started` | It has already started |
| `not_pending` | This booking was already decided |
| `sos_closed` | This alert is already closed |
| `invalid_title` | Enter a title |
| `invalid_time` | Check the start and end time |
| `event_over` | This event has already started |
| `invalid_heads` | Enter how many people (1–20) |
| `invalid_contact_phone` | Enter a valid phone number |

### App screens

- Resident Home:
  - Quick actions: Guest pass · Expecting · Daily help · Book amenity.
  - Cards: "Polls waiting for your vote (n)" and "Upcoming event".
  - A red **SOS** button pinned near the top, with "Emergency numbers" next to it.
- Resident More: Polls · Amenities & bookings · Events · Documents · Directory ·
  Emergency numbers · Directory privacy (on the Family tab, as per-member toggles).
- Polls:
  - List (Open / Closed).
  - Detail: question, options as radio or checkbox, "Vote" with confirm ("Your flat's
    vote can't be changed"), and results bars with %, turnout and "You voted".
- Amenities: list, then detail (date chips for 14 days, slot grid with taken/free, book),
  plus "My bookings" with status and cancel.
- SOS:
  - Hold-to-send button with a progress ring, then the type sheet, then a live status
    screen with cancel.
  - On failure: a big red error, "Try again", and the emergency numbers list.
- Guard Today and admin app: a live red banner listing open SOS (flat, type, time) with
  "On my way" / "Resolved". This works from any guard tab.
- Admin mobile app: a new Polls tab (list, create, results, remind, close) and an SOS
  banner. Everything else is on the website.

## 8. Left to the builder

Exact copy beyond the table, icons, layout of results bars and slot grids, chunking of
tasks, test layout, demo seed (one open poll, one closed poll with votes, 3 amenities,
an event, 2 documents, default emergency numbers), and website table design (follow the
existing pages).
