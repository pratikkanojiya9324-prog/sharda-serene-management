-- Visitor-photo storage policies: guard the ::uuid cast with CASE. SQL does not
-- promise left-to-right evaluation of AND, so `regex AND has_role(x::uuid)` could
-- try to cast a non-uuid folder name and raise instead of simply denying.
drop policy if exists visitor_photos_guard_insert on storage.objects;
drop policy if exists visitor_photos_member_select on storage.objects;

create policy visitor_photos_guard_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'visitor-photos'
  and case
    when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_role(((storage.foldername(name))[1])::uuid, 'guard')
    else false
  end
);

create policy visitor_photos_member_select on storage.objects
for select to authenticated
using (
  bucket_id = 'visitor-photos'
  and case
    when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);
