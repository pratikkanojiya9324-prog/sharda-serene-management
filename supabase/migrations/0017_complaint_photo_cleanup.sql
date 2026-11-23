-- Residents can delete a complaint photo they uploaded when no complaint
-- references it (the app cleans up after a failed create_complaint).
create policy complaint_photos_owner_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'complaint-photos'
  and owner_id = auth.uid()::text
  and not exists (
    select 1 from public.complaints c where c.photo_path = objects.name
  )
);
