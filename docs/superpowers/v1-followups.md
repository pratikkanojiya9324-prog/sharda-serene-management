# Society Gate v1 — follow-up backlog

Minor findings deferred during the v1 build (none block a first pilot). Items fixed in the final fix wave are removed.

- Task 4: minor (deferred): record_manual_outcome can overwrite after entry / accepts NULL
- Task 4: minor (deferred): NULL p_response gives 23502 not invalid_response
- Task 4: minor (deferred): mark_entry check-then-update not atomic vs record_manual_outcome
- Task 4: minor (deferred): missing negative tests (resident on guard RPCs, guard B on respond/manual/has_app_users, anon, non-resident respond)
- Task 4: minor (deferred): gen:types unformatted note
- Task 5: minor (deferred): use_pass ambiguous when guard in 2 societies with same live code — raise ambiguous_code
- Task 5: minor (deferred): codes use random(), prefer extensions.gen_random_bytes
- Task 5: minor (deferred): guard can enumerate codes, no failed-attempt logging (v1 acceptable)
- Task 5: minor (deferred): use_pass lookup can't use (society_id, code) index — join memberships
- Task 5: minor (deferred): no test for prefer-live-pass ordering
- Task 5: minor (deferred): database.types.ts unformatted (project-wide decision)
- Task 6: minor (deferred): tokens not de-duplicated
- Task 6: minor (deferred): missing tests — resident cannot upload, guard reads own upload, visit insert works with no Vault secrets
- Task 6: minor (deferred): notification failures only logged as warning (ops visibility)
- Task 7: minor (deferred): verify.tsx phone param may be undefined if opened directly
- Task 8: minor (deferred): null-as-string casts for create_visit nullable args (regen types)
- Task 8: minor (deferred): stale error text not cleared (index.tsx, CallResident)
- Task 8: minor (deferred): CallResident test harness re-implements interval
- Task 9: implementer DONE_WITH_CONCERNS da3213b,2bfe230 — concerns observations; co-resident profile RLS confirmed in Task 3 review. Task 9: minor (deferred): pass validity typed as text, no date picker (resident UX). Review dispatched.
- Task 9: minor (deferred): flat switch leaves stale data / out-of-order responses
- Task 9: minor (deferred): pass date input accepts out-of-range values (rollover)
- Task 9: minor (deferred): realtime handler doesn't filter eventType
- Task 9: minor (deferred): errors.ts lacks invalid_name; tests cover only 4 mappings
- Task 10: minor (deferred): CSV bulk no 23505 handling; towers persist if flat insert fails
- Task 10: minor (deferred): VisitorLog signed URL errors ignored; no stale-response guard
- Task 10: minor (deferred): notAdmin message persists; no duplicate-invite pre-check
- Final fix wave re-review: all findings ADDRESSED, no new Critical/Important. 3 new minors deferred: unregisterPushToken clears local key on failed delete; expo.ts res.text() inside retry try (rare double-send); useLiveVisit stale fetch on id change. Out-of-scope: delete legacy service_role_key Vault secret in prod.
