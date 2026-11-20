// PostgREST select strings used only by the admin website. `npm run smoke`
// (scripts/smoke-queries.mjs) runs every one of them against the local stack.
// flats has two FKs to towers (flats_tower_id_fkey and the composite
// flats_tower_same_society), so tower embeds always name the FK.
// Keep this file free of imports: the smoke script loads it directly with Node.

/** Flats with building + wing, for labels like "B1-A-101". */
export const ADMIN_FLAT_LABELS_SELECT = 'id, number, towers!flats_tower_id_fkey(building, name)' as const;

/** Flat accounts: resident links (a flat with a link has a login). */
export const ADMIN_FLAT_ACCOUNTS_SELECT = 'flat_id, flats!flat_residents_flat_id_fkey!inner(society_id)' as const;

/** Family members of the society's flats. */
export const ADMIN_FAMILY_SELECT = 'id, flat_id, name, phone, relation' as const;

/** Staff (guards + admins) with their display name. */
export const ADMIN_STAFF_SELECT = 'id, profile_id, role, profiles!memberships_profile_id_fkey(name)' as const;

/** Notices list. */
export const ADMIN_NOTICES_SELECT = 'id, title, body, pinned, attachment_path, attachment_kind, created_at' as const;

/** Complaints list. */
export const ADMIN_COMPLAINTS_SELECT =
  'id, flat_id, category, description, photo_path, status, created_by_name, created_at, updated_at' as const;

/** Comments of one complaint. */
export const ADMIN_COMPLAINT_COMMENTS_SELECT = 'id, body, author_id, author_name, created_at' as const;

/** Bills of a period. */
export const ADMIN_BILLS_SELECT =
  'id, flat_id, period, amount, due_date, status, paid_at, payment_mode, payment_reference, receipt_no' as const;
