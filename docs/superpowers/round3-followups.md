# Round 3 follow-up backlog

These are minor findings deferred from the Round 3 build (community: polls, amenities, SOS, directory, events, documents). None of them block testing. The final whole-branch review triaged them, and every finding it judged load-bearing was fixed in commit 08339e3.

## Deferred minors

- **Polls**
  - A description over 1000 characters raises `invalid_question`.
  - Cross-society delete/remind is untested.
  - On the admin website, "Open" goes stale after `closes_at` while the page stays open.
  - The admin list makes one `poll_results` call per poll.
  - After removing an option, the max-choices display goes stale.
  - When a detail panel fails to load, there is no Retry button.
- **Amenities**
  - Over-long description/fee note raises `invalid_name`.
  - The booking limit is count-then-insert, so two phones of the same flat can race (advisory lock).
  - The 14-day window is hard-coded in SQL.
  - Test gaps: cross-society, cancel of a rejected booking, admin cancel, partially elapsed slot.
  - The admin `toggleActive` resends a possibly stale row.
  - The bookings list is capped at 500.
- **SOS**
  - `raise_sos` can return an empty row in a narrow resolve-during-insert race.
  - A null type raises `not_authorized`.
  - Resident/admin SOS fetch errors go through `guardErrorText`, not `reportError`, so session expiry is not handled there.
  - The banner doubles the top inset.
  - The hold button fills a disc rather than a ring.
  - A second press during an in-flight send is dropped.
  - The contacts fetch has no timeout (the cache covers it).
- **Emergency contacts:** a note over 200 characters raises `invalid_name`. Test gaps: direct DML denial, cross-society contacts.
- **Events and documents**
  - RSVPs on a cancelled event say "already started"; an `event_cancelled` code would be clearer.
  - `rsvp_event` takes no lock against `cancel_event`.
  - The document path check is loose.
  - The RSVP list is sorted as strings.
  - No test that another society is denied select on the bucket.
  - "Cancel event" wording is ambiguous next to the dismiss button.
  - The storage remove result is ignored on delete.
- **Notify**
  - The "nothing queued without secrets" assertion is vacuous.
  - The SOS guard in `index.ts` calls a builder just to check status.
  - `nonVotingFlatTokens` uses large `.in()` lists, which is fine at about 170 flats.
  - `complaintFlatLabel` falls back to "Flat".
- **Mobile**
  - Events "open/started" is computed only at render.
  - Indentation in `family.tsx`.
  - Mobile `invalid_title` still says "Give the notice a title".
- **Admin website**
  - `dateTime` has no weekday.
  - Admin `invalid_title` is "Enter a title." (trailing period).
  - Round 2 pages DailyHelp and VisitorLog still use the browser time zone.
- **Realtime:** `polls` and `amenity_bookings` are published, but no client subscribes yet. Results refresh on focus and pull-to-refresh.

## Decisions made during the build

- Ruling: plan defect fixed before execution. The court-close edge tests used 22:00 close and a 30-minute amenity running 00:00–23:00. Cost if wrong: none.
- Ruling: execution was subagent-driven on branch round3 in the main checkout. Cost: none.
- Ruling: the poll percentage base is the number of flats that voted, on both phone and website. Cost: none.
- Ruling: Task 5 commit trailer says "Sonnet 5.5". Left as is, since it is cosmetic.
- Ruling: an over-long event description or place raises `invalid_note`. Cost: the message is slightly generic.
- Ruling: IST date helpers were extracted to `apps/mobile/src/lib/ist.ts`. Cost: none.
- Ruling: mobile `invalid_title` keeps the notice copy, because event and document titles are only typed on the admin website. Cost: none.
- Ruling: offline SOS failure shows cached emergency contacts plus an always-present 112 card. Cost: small.
- Ruling: admin error copy uses the exact spec strings. The admin dateTime display was forced to IST. Cost: none.
- Ruling: the admin `invalid_title` trailing period was accepted. Cost: one character.
- **Ruling: the office sees poll counts only after voting closes.** While a poll is open, the office sees turnout and the not-voted list. The spec's anti-goal "no one, the office included, learns how a flat voted" outranks §7's "admins always". Cost if wrong: the office waits for close to see results. This is easy to flip back.
- Ruling: an amenity's timings or slot length cannot change while upcoming bookings exist (new code `has_bookings`). Cost: the office must wait for or cancel those bookings first.
- Ruling: migrations 0020 and 0021 were edited in place, because they were never applied remotely. The `family_members` grant fix went in a new 0025. Cost: none.
