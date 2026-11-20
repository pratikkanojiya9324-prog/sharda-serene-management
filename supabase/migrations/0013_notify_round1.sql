-- Round 1 notifications: notices, complaints, complaint comments (admin replies) and
-- bills post { type, table, schema, record, old_record } to the notify Edge Function,
-- exactly like the visits trigger (0008): URL from Vault `notify_url`, Bearer from
-- Vault `notify_secret`, pg_net, and never blocking the originating write.
-- The visits trigger already sends `table: 'visits'`, so it is left unchanged.

create or replace function public.notify_post(p_table text, p_type text, p_record jsonb, p_old jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notify_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_secret';
  if v_url is null or v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_secret
    ),
    body := jsonb_build_object(
      'type', p_type,
      'table', p_table,
      'schema', 'public',
      'record', p_record,
      'old_record', p_old
    ),
    timeout_milliseconds := 15000
  );
end;
$$;

revoke execute on function public.notify_post(text, text, jsonb, jsonb) from public, anon, authenticated;

create or replace function public.notify_round1_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.notify_post(tg_table_name, 'INSERT', to_jsonb(new), null);
  return null;
exception when others then
  raise warning 'notify_round1_insert failed: %', sqlerrm;
  return null;
end;
$$;

-- Replies only notify the flat when written by an admin of the society.
create or replace function public.notify_complaint_comment_insert()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (
    select 1 from public.memberships m
    where m.profile_id = new.author_id and m.society_id = new.society_id and m.role = 'admin'
  ) then
    perform public.notify_post('complaint_comments', 'INSERT', to_jsonb(new), null);
  end if;
  return null;
exception when others then
  raise warning 'notify_complaint_comment_insert failed: %', sqlerrm;
  return null;
end;
$$;

create or replace function public.notify_round1_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.notify_post(tg_table_name, 'UPDATE', to_jsonb(new), to_jsonb(old));
  return null;
exception when others then
  raise warning 'notify_round1_update failed: %', sqlerrm;
  return null;
end;
$$;

revoke execute on function public.notify_round1_insert() from public, anon, authenticated;
revoke execute on function public.notify_round1_update() from public, anon, authenticated;
revoke execute on function public.notify_complaint_comment_insert() from public, anon, authenticated;

create trigger notices_notify after insert on public.notices
  for each row execute function public.notify_round1_insert();
create trigger complaints_notify_insert after insert on public.complaints
  for each row execute function public.notify_round1_insert();
create trigger complaint_comments_notify after insert on public.complaint_comments
  for each row execute function public.notify_complaint_comment_insert();
create trigger bills_notify_insert after insert on public.bills
  for each row execute function public.notify_round1_insert();

create trigger complaints_notify_status after update of status on public.complaints
  for each row when (old.status is distinct from new.status)
  execute function public.notify_round1_update();
create trigger bills_notify_paid after update of status on public.bills
  for each row when (old.status is distinct from new.status and new.status = 'paid')
  execute function public.notify_round1_update();
