-- Migration 0019: Round 2 fix wave.
--  * helper_check_in refuses a helper no flat employs (helper_unlinked)
--  * a flat sees a helper's attendance only from the day it linked the helper
--  * one parcel per visit (parcel_already_logged)

-- ---------------------------------------------------------------- helper_unlinked
create or replace function public.helper_check_in(p_helper_id uuid)
returns public.helper_attendance
language plpgsql security definer set search_path = ''
as $$
declare
  v_helper public.helpers;
  v_row public.helper_attendance;
begin
  -- Lock the helper row so two guards tapping at once serialize.
  select * into v_helper from public.helpers where id = p_helper_id for update;
  if not found or not public.has_role(v_helper.society_id, 'guard') then
    raise exception 'not_authorized';
  end if;
  if not v_helper.active then
    raise exception 'helper_inactive';
  end if;
  if not exists (select 1 from public.helper_flats hf where hf.helper_id = p_helper_id) then
    raise exception 'helper_unlinked';
  end if;
  if exists (select 1 from public.helper_attendance a where a.helper_id = p_helper_id and a.exit_at is null) then
    raise exception 'already_inside';
  end if;
  insert into public.helper_attendance (society_id, helper_id, entry_by)
  values (v_helper.society_id, p_helper_id, auth.uid())
  returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------- attendance since link
drop policy helper_attendance_select on public.helper_attendance;
create policy helper_attendance_select on public.helper_attendance for select to authenticated
  using (
    public.has_role(helper_attendance.society_id, 'guard') or public.has_role(helper_attendance.society_id, 'admin')
    or exists (
      select 1 from public.helper_flats hf
      where hf.helper_id = helper_attendance.helper_id
        and public.is_flat_resident(hf.flat_id)
        and helper_attendance.entry_at >= hf.added_at
    )
  );

-- ---------------------------------------------------------------- one parcel per visit
create unique index parcels_visit_id_key on public.parcels (visit_id) where visit_id is not null;

create or replace function public.log_parcel(
  p_flat_id uuid, p_courier text, p_note text, p_photo_path text, p_visit_id uuid default null
) returns public.parcels
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid;
  v_courier text := btrim(p_courier);
  v_row public.parcels;
begin
  select society_id into v_society from public.flats where id = p_flat_id;
  if v_society is null or not public.has_role(v_society, 'guard') then
    raise exception 'not_authorized';
  end if;
  if v_courier is null or char_length(v_courier) < 1 or char_length(v_courier) > 40 then
    raise exception 'invalid_courier';
  end if;
  if p_photo_path is not null
     and p_photo_path not like v_society::text || '/' || p_flat_id::text || '/%' then
    raise exception 'invalid_photo_path';
  end if;
  if p_visit_id is not null and not exists (
    select 1 from public.visits v where v.id = p_visit_id and v.flat_id = p_flat_id
  ) then
    raise exception 'not_authorized';
  end if;

  begin
    insert into public.parcels (society_id, flat_id, courier, note, photo_path, logged_by, visit_id)
    values (v_society, p_flat_id, v_courier, nullif(btrim(p_note), ''), p_photo_path, auth.uid(), p_visit_id)
    returning * into v_row;
  exception when unique_violation then
    raise exception 'parcel_already_logged';
  end;
  return v_row;
end;
$$;
