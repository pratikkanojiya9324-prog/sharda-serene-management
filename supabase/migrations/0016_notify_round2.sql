-- Round 2 notifications: daily help attendance and parcels post to the notify Edge
-- Function via public.notify_post (0013): pg_net + Vault, never blocking the write.
-- notify_round1_insert is the generic row-insert poster from 0013.
-- The visits trigger (0005) already posts every INSERT, including auto-approved
-- visits, so no new visits trigger is needed.

create or replace function public.notify_round2_update()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.notify_post(tg_table_name, 'UPDATE', to_jsonb(new), to_jsonb(old));
  return null;
exception when others then
  raise warning 'notify_round2_update failed: %', sqlerrm;
  return null;
end;
$$;

revoke execute on function public.notify_round2_update() from public, anon, authenticated;

create trigger helper_attendance_notify_insert after insert on public.helper_attendance
  for each row execute function public.notify_round1_insert();
create trigger helper_attendance_notify_exit after update of exit_at on public.helper_attendance
  for each row when (old.exit_at is null and new.exit_at is not null)
  execute function public.notify_round2_update();

create trigger parcels_notify_insert after insert on public.parcels
  for each row execute function public.notify_round1_insert();
create trigger parcels_notify_collected after update of status on public.parcels
  for each row when (old.status is distinct from new.status and new.status = 'collected')
  execute function public.notify_round2_update();
