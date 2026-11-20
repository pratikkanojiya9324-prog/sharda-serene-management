-- Society Gate: push notifications on visit insert + visitor photo storage

-- ---------------------------------------------------------------------------
-- Webhook: after insert on visits -> POST to the `notify` Edge Function via pg_net.
-- URL and service-role key come from Vault secrets `notify_url` and
-- `service_role_key`; if either is missing (or the call fails) we do nothing so
-- the visit insert is never blocked.
-- ---------------------------------------------------------------------------
create extension if not exists pg_net with schema extensions;

create function public.notify_visit_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notify_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    return null;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'visits',
      'schema', 'public',
      'record', to_jsonb(new)
    ),
    timeout_milliseconds := 15000
  );
  return null;
exception when others then
  raise warning 'notify_visit_insert failed: %', sqlerrm;
  return null;
end;
$$;

revoke execute on function public.notify_visit_insert() from public, anon, authenticated;

create trigger visits_notify
after insert on public.visits
for each row execute function public.notify_visit_insert();

-- ---------------------------------------------------------------------------
-- Storage: private bucket for visitor photos, laid out as {society_id}/...
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('visitor-photos', 'visitor-photos', false)
on conflict (id) do nothing;

create policy visitor_photos_guard_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'visitor-photos'
  and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.has_role(((storage.foldername(name))[1])::uuid, 'guard')
);

create policy visitor_photos_member_select on storage.objects
for select to authenticated
using (
  bucket_id = 'visitor-photos'
  and (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  and public.is_member(((storage.foldername(name))[1])::uuid)
);
