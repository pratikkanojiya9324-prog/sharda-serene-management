# Round 1 follow-up backlog

Deferred minor findings from the round 1 build (none block testing).

- Task 1: minor (deferred): login_directory test NULL society_name loophole; empty-society returns no name; flatLabel fallback untested
- Task 2: minor (deferred): admin_society() picks lowest id for multi-society admin; notices bucket lacks delete/update policy (orphans); generate_bills_custom error codes; amount round-then-check; due_date >= period; counter single statement; admin B cross-society tests
- Task 3: minor (deferred): complaint lookup lacks society filter; duplicate vault/pg_net logic vs 0008; complaintFlatLabel swallows errors; bill_paid receipt_no null guard; lowercase category wording
- Task 4: minor (deferred): family replace not transactional; raw error messages returned; CORS *; seed comment 1-4 members; no automated authz tests for index.ts; create-staff password in CLI args
- Task 4: minor (deferred): groupRows case-sensitive building key vs case-insensitive tower match (family wipe on mixed-case CSV) — FIX in Task 8 dispatch (admin site should normalise building before sending) or final wave; too_many_rows error string vs README; Task 8 must chunk ≤200; disable_staff 409 semantics
- Task 5: minor (deferred): no render tests for theme components; StatusBar light not reset on plain screens
- Task 8: minor (deferred): multi-line quoted CSV fields; notice attachment orphan; Google Fonts dependency; staff list lacks username
- Task 6: minor (deferred): endless spinner when no flat linked (Bills/Complaints/Family/History/Passes); overdue uses device date; change-password setBusy not in finally; orphan complaint photo on RPC failure; FlatSwitcher only on some tabs; family "This phone" exact match; dead HOUSEHOLD_MEMBERS_SELECT/add_household_member
- Task 7: minor (deferred): single-wing auto-pick on initial load; bills month Select not serialized; already_paid doesn't refresh row; notice orphan on retry; adminTabs test weak assertion
- Final fix wave re-review: all addressed. Parked minors: seed-demo /D/g regex (should be \D); list_staff prefers user-editable metadata username (display only).

## Decisions made during the build

- Ruling: Task 4 — supabase/seed.sql becomes a comment-only file; local demo data comes from `npm run seed:demo` (README) — pgTAP tests seed their own rows — cost if wrong: one script call after reset.
- Ruling: Task 2 — "except none" means all writes RPC-only except storage uploads — cost if wrong: none.
- Ruling: subagent commit trailers name their own model (Sonnet) per their harness attribution — not rewriting history — cost if wrong: cosmetic.
- Ruling: speed — Task 3 implementer dispatched in parallel with Task 2 review; Task 3 restricted to new files (notify fn, 0013) so no file overlap — cost if wrong: Task 2 fix may need rebase of 0013 triggers.
- Ruling: bulk_import cap 200 rows per call; admin site chunks — fits Edge Function time limit — cost if wrong: smaller chunks.
- Ruling: I4 — keep demo password pattern for this test round (owner wants quick demo testing; data is demo); real data import uses generated random passwords — cost if wrong: testers can log into other demo flats.
- Ruling: staff username stored in auth user_metadata + list_staff action (no migration) — cost if wrong: one function action to replace later.
