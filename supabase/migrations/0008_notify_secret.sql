-- The notify webhook now authenticates with a dedicated shared secret instead of
-- the legacy service-role JWT. The Edge Function compares the Bearer token to its
-- NOTIFY_SECRET env var; the trigger reads the same value from Vault secret
-- `notify_secret` (URL still from `notify_url`). Missing secrets or a failed call
-- never block the visit insert.
create or replace function public.notify_visit_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notify_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_secret';
  if v_url is null or v_secret is null then
    return null;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
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
