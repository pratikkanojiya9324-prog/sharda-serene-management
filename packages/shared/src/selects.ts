// PostgREST select strings that embed related tables, shared by the apps and by
// `npm run smoke` (scripts/smoke-queries.mjs), which runs each one against the
// local stack. Composite tenant FKs (e.g. flats_tower_same_society) create a
// second relationship between some tables, so embeds name the simple FK with
// `table!constraint(...)` or PostgREST answers PGRST201 (ambiguous embed).
// Keep this file free of imports: the smoke script loads it directly with Node.

/** mobile guard home: today's visits with flat + building/wing (for "B1-A-101"). */
export const GUARD_TODAY_VISITS_SELECT =
  'id, name, purpose, status, manual_outcome, created_at, flats!visits_flat_id_fkey(number, towers!flats_tower_id_fkey(name, building))' as const;

/** mobile resident: the signed-in flat account's flat(s), with building + wing for the label. */
export const RESIDENT_FLATS_SELECT =
  'flat_id, flats(number, society_id, towers!flats_tower_id_fkey(name, building))' as const;

/** admin: flats with tower name (People, Visitor log). */
export const ADMIN_FLATS_SELECT = 'id, number, towers!flats_tower_id_fkey(name)' as const;

/** admin App: the user's admin societies. */
export const ADMIN_SOCIETIES_SELECT = 'society_id, societies(name)' as const;

/** admin People: memberships with profile. */
export const ADMIN_MEMBERS_SELECT = 'id, profile_id, role, profiles(name, phone)' as const;

/** admin People: flat links of the society (filter `flats.society_id`). */
export const ADMIN_FLAT_LINKS_SELECT = 'id, flat_id, profile_id, flats!inner(society_id)' as const;

/** admin Visitor log rows. */
export const ADMIN_VISIT_LOG_SELECT =
  'id, created_at, name, purpose, status, manual_outcome, flat_id, photo_path, entry_at, exit_at' as const;

/** mobile guard flat picker + in-app admin flat labels: every flat with building + wing. */
export const FLAT_DIRECTORY_SELECT = 'id, number, towers!flats_tower_id_fkey(building, name)' as const;

/** mobile resident daily help: helper + attendance history (filter entry_at client-side for today/month). */
export const HELPER_RESIDENT_SELECT =
  'id, name, phone, type, photo_path, entry_code, active, helper_attendance(id, entry_at, exit_at)' as const;

/** mobile guard daily help: helper + the flats served + attendance rows (open ones have exit_at null). */
export const HELPER_GUARD_SELECT =
  'id, name, phone, type, photo_path, entry_code, active, helper_flats(flat_id, flats(number, towers!flats_tower_id_fkey(building, name))), helper_attendance(id, entry_at, exit_at)' as const;

/** mobile parcels (resident + guard): parcel with the flat label. */
export const PARCEL_SELECT =
  'id, created_at, flat_id, courier, note, photo_path, status, collected_at, collected_by_name, visit_id, flats(number, towers!flats_tower_id_fkey(building, name))' as const;

/** polls list (residents + admin): choices are never part of a poll row. */
export const POLL_SELECT =
  'id, question, description, options, multi, max_choices, closes_at, closed_at, created_at, last_reminded_at' as const;
