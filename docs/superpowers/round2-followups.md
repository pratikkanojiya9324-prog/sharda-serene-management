# Round 2 follow-up backlog

Deferred minor findings from the Round 2 build (none block testing). Final whole-branch review triaged all of these as safe to defer.

- Task 1: minor (deferred): HELPER_*_SELECT embed all attendance rows unbounded — Task 5/6 must add embed filters (entry_at range / exit_at is null) at query time
- Task 1: minor (deferred): test gaps — other-society guard on check_in/out/set_helper_active; invalid_actor_name/invalid_type/invalid_active; reactivation code regen
- Task 1: minor (deferred): database.types.ts includes notify_post — likely drift from 0013, check
- Task 2: minor (deferred): parcel-photos guard insert checks only society segment (orphans possible under fake flat id)
- Task 2: minor (deferred): return_parcel writes collected_at for returned parcels (UI must label by status)
- Task 2: minor (deferred): test gaps — invalid_photo_path, cancel by non-resident, admin reads, latest valid_to pick, used_count concurrency
- Task 2: minor (deferred): allowed hours/purposes duplicated SQL vs constants.ts
- Task 3: minor (deferred): index.ts helper-flat token lookups sequential; collected_by_name null fallback; index.ts handler paths untested (only pure builders)
- Task 4: minor (deferred): handlingExpiry re-arms when signOut settles (possible re-alerts)
- Task 4: minor (deferred): detail screens + guard pass/new-visit/visit still use friendlyError/guardErrorText, no session-expiry handling
- Task 4: minor (deferred): root _layout reportError drops non-Error rejections
- Task 4: minor (deferred): OfflineBanner overlays header (check visually)
- Task 4: minor (deferred): passes no_flat shows create form above NoFlatState; revoke no in-flight guard
- Task 4: minor (deferred): thrown refresh after loaded shows no Banner (screens show only local `error`, not `loadFailure`) — Task 5/6 new screens should show `error ?? loadFailure`
- Task 4: minor (deferred): photo-cleanup "other user" test doesn't isolate owner check from select visibility
- Task 5: minor (deferred): photoUpload renders image twice to read width; complaintPhoto ignores passed width
- Task 5: minor (deferred): expecting cancel no busy guard
- Task 5: minor (deferred): parcels "Collected" heading also holds returned
- Task 5: minor (deferred): daily-help/new no NoFlat/ErrorState explanation when no flat
- Task 5: minor (deferred): Home ready Banner ignores loadFailure
- Task 5: minor (deferred): Home inside-now misses open rows from previous month (month-filtered embed)
- Task 5: minor (deferred): inline import() type in flatHelpers.ts
- Task 6: minor (deferred): visit/[id] duplicate imports + visitPill computed 3x; parcels modal backdrop discards typed name; no test for loadGuardHelpers; daily-help "No match" + "No daily help yet" both shown
- Task 7: minor (deferred): DailyHelp stale rows under error banner; deactivate double-confirm guard unverified; todayStatus midnight edge untested
- Final review M6: linking an existing helper by phone silently ignores the typed name/type/photo (shows the first flat's name; uploaded photo orphaned)
- Final review M9: demo helper codes 111111/222222/333333 are test-server only — never seed them into real use
- Next worth doing: session-expiry handling on guard pass/new-visit/visit and detail screens (L57); check OfflineBanner on a device

## Decisions made during the build

- Ruling: work directly on branch round2 in the main checkout, no worktree — same as Round 1, owner wants speed, branch is isolated from main — cost if wrong: none (main untouched until Task 8).
- Ruling: execution method subagent-driven chosen by controller — owner asked not to be asked repeatedly — cost if wrong: token cost only.
- Ruling: orphan complaint-photo removal is a no-op (no storage DELETE policy in 0012) — park; final review decides whether to add a resident delete policy migration — cost if wrong: occasional orphan photos in storage, invisible to users.
- Task 5: review → Needs fixes (I1 missing visitPill auto-approved test). Ruling: "Other" company needs free-text input — Global Constraints say free text ≤40 accepted — cost if wrong: one extra input. Fix round 1 sent.
- Ruling: helperAction(inactive, open) → 'check_out' (not 'blocked') — a blocked helper still inside must be able to leave; set_helper_active(false) closes open rows anyway — cost if wrong: none.
- Ruling: fix wave scope = C1 (+L62/L72 same hook), I2, I3 (guard shows expectation + honest resident copy, no schema change, no guest cap), M4 duplicate parcel (unique partial index + hide button), M5 courier prefill, M7 prefer active on code match, M8 admin code_generation_failed copy, plus attendance-since-link privacy rule (reviewer's "next round" item, cheap) — cost if wrong: slightly larger fix wave.
- Ruling: M6 (linking ignores typed name) and M9 (demo codes) stay deferred — M9 is test-server only; M6 cosmetic — cost if wrong: confusing link message.
