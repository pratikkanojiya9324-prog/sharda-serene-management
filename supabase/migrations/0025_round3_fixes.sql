-- Round 3 fix wave.
--  * Directory flags (in_directory, show_phone) are the flat's choice: they change
--    only through set_directory_visibility() (security definer). Admins keep
--    editing a member's name, phone and relation directly; the flat import runs
--    through the accounts edge function with the service role.

revoke insert, update on public.family_members from authenticated;
grant insert (society_id, flat_id, name, phone, relation) on public.family_members to authenticated;
grant update (name, phone, relation) on public.family_members to authenticated;
