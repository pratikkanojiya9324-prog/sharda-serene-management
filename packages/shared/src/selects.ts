// PostgREST select strings that embed related tables, shared by the apps and by
// `npm run smoke` (scripts/smoke-queries.mjs), which runs each one against the
// local stack. Composite tenant FKs (e.g. flats_tower_same_society) create a
// second relationship between some tables, so embeds name the simple FK with
// `table!constraint(...)` or PostgREST answers PGRST201 (ambiguous embed).
// Keep this file free of imports: the smoke script loads it directly with Node.

/** mobile guard home: today's visits with flat + tower. */
export const GUARD_TODAY_VISITS_SELECT =
  'id, name, status, created_at, flats!visits_flat_id_fkey(number, towers!flats_tower_id_fkey(name))' as const;

/** mobile resident: the signed-in resident's own flats. */
export const RESIDENT_FLATS_SELECT = 'flat_id, flats(number, towers!flats_tower_id_fkey(name))' as const;

/** mobile resident household: who lives in the flat. */
export const HOUSEHOLD_MEMBERS_SELECT = 'profile_id, profiles!flat_residents_profile_id_fkey(name, phone)' as const;

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
