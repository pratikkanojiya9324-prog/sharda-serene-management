-- Round 2: daily help (maids, cooks, drivers...) with permanent entry codes,
-- flat links and gate attendance. Writes are RPC-only (security definer).

create type public.helper_type as enum
  ('maid', 'cook', 'driver', 'nanny', 'car_cleaner', 'tutor', 'other');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.helpers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  society_id uuid not null references public.societies(id) on delete cascade,
  name text not null,
  phone text not null,
  type public.helper_type not null,
  photo_path text,
  entry_code text not null check (entry_code ~ '^[0-9]{6}$'),
  active boolean not null default true,
  constraint helpers_society_phone_key unique (society_id, phone),
  constraint helpers_id_society_key unique (id, society_id)
);
create unique index helpers_active_code_key on public.helpers (society_id, entry_code) where active;

create table public.helper_flats (
  helper_id uuid not null,
  flat_id uuid not null,
  society_id uuid not null references public.societies(id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by_name text,
  primary key (helper_id, flat_id),
  constraint helper_flats_helper_same_society
    foreign key (helper_id, society_id) references public.helpers (id, society_id) on delete cascade,
  constraint helper_flats_flat_same_society
    foreign key (flat_id, society_id) references public.flats (id, society_id) on delete cascade
);
create index helper_flats_flat_idx on public.helper_flats (flat_id);

create table public.helper_attendance (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  helper_id uuid not null,
  entry_at timestamptz not null default now(),
  exit_at timestamptz,
  entry_by uuid references public.profiles(id) on delete set null,
  exit_by uuid references public.profiles(id) on delete set null,
  constraint helper_attendance_helper_same_society
    foreign key (helper_id, society_id) references public.helpers (id, society_id) on delete cascade
);
create unique index helper_attendance_one_open on public.helper_attendance (helper_id) where exit_at is null;
create index helper_attendance_helper_idx on public.helper_attendance (helper_id, entry_at desc);
create index helper_attendance_society_idx on public.helper_attendance (society_id, entry_at desc);

-- ---------------------------------------------------------------------------
-- RLS: reads only; writes via RPC
-- ---------------------------------------------------------------------------
alter table public.helpers enable row level security;
alter table public.helper_flats enable row level security;
alter table public.helper_attendance enable row level security;

revoke all on public.helpers, public.helper_flats, public.helper_attendance from anon;
revoke insert, update, delete on public.helpers, public.helper_flats, public.helper_attendance from authenticated;

create policy helper_flats_select on public.helper_flats for select to authenticated
  using (
    public.has_role(society_id, 'guard') or public.has_role(society_id, 'admin')
    or public.is_flat_resident(flat_id)
  );

create policy helpers_select on public.helpers for select to authenticated
  using (
    public.has_role(society_id, 'guard') or public.has_role(society_id, 'admin')
    or exists (
      select 1 from public.helper_flats hf
      where hf.helper_id = helpers.id and public.is_flat_resident(hf.flat_id)
    )
  );

create policy helper_attendance_select on public.helper_attendance for select to authenticated
  using (
    public.has_role(society_id, 'guard') or public.has_role(society_id, 'admin')
    or exists (
      select 1 from public.helper_flats hf
      where hf.helper_id = helper_attendance.helper_id and public.is_flat_resident(hf.flat_id)
    )
  );

-- ---------------------------------------------------------------------------
-- Storage: helper-photos/{society_id}/... (CASE-guarded uuid cast, as in 0009)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('helper-photos', 'helper-photos', false)
on conflict (id) do nothing;

create policy helper_photos_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'helper-photos'
  and case
    when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_role(((storage.foldername(name))[1])::uuid, 'guard')
        or exists (
          select 1 from public.flat_residents fr
          join public.flats f on f.id = fr.flat_id
          where fr.profile_id = auth.uid()
            and f.society_id = ((storage.foldername(name))[1])::uuid
        )
    else false
  end
);

-- Readable by whoever can read a helper using that photo (helpers RLS applies).
create policy helper_photos_select on storage.objects
for select to authenticated
using (
  bucket_id = 'helper-photos'
  and case
    when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_role(((storage.foldername(name))[1])::uuid, 'guard')
        or public.has_role(((storage.foldername(name))[1])::uuid, 'admin')
        or exists (select 1 from public.helpers h where h.photo_path = name)
    else false
  end
);

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create function public.add_helper(
  p_flat_id uuid, p_name text, p_phone text, p_type public.helper_type,
  p_photo_path text default null, p_actor_name text default null
) returns public.helpers
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid;
  v_name text := btrim(p_name);
  v_actor text;
  v_helper public.helpers;
  v_code text;
  v_attempt int := 0;
begin
  select society_id into v_society from public.flats where id = p_flat_id;
  if v_society is null or not public.is_flat_resident(p_flat_id) then
    raise exception 'not_authorized';
  end if;
  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception 'invalid_name';
  end if;
  if p_phone is null or p_phone !~ '^\+91[6-9][0-9]{9}$' then
    raise exception 'invalid_phone';
  end if;
  if p_type is null then
    raise exception 'invalid_type';
  end if;
  if p_photo_path is not null and p_photo_path not like v_society::text || '/%' then
    raise exception 'invalid_photo_path';
  end if;
  v_actor := public.clean_actor_name(p_actor_name);

  -- Serialize helper creation per society so the same phone added by two flats
  -- at once yields one helper, and the code check cannot race with an insert.
  perform pg_advisory_xact_lock(hashtextextended('add_helper:' || v_society::text, 0));

  select * into v_helper from public.helpers
   where society_id = v_society and phone = p_phone;
  if found then
    if not v_helper.active then
      raise exception 'helper_inactive';
    end if;
    if exists (select 1 from public.helper_flats where helper_id = v_helper.id and flat_id = p_flat_id) then
      raise exception 'helper_already_linked';
    end if;
  else
    loop
      v_attempt := v_attempt + 1;
      if v_attempt > 50 then
        raise exception 'code_generation_failed';
      end if;
      v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
      exit when not exists (
        select 1 from public.helpers h
        where h.society_id = v_society and h.entry_code = v_code and h.active
      );
    end loop;
    insert into public.helpers (society_id, name, phone, type, photo_path, entry_code)
    values (v_society, v_name, p_phone, p_type, p_photo_path, v_code)
    returning * into v_helper;
  end if;

  insert into public.helper_flats (helper_id, flat_id, society_id, added_by_name)
  values (v_helper.id, p_flat_id, v_society, v_actor);
  return v_helper;
end;
$$;

create function public.remove_helper_from_flat(p_helper_id uuid, p_flat_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_flat_resident(p_flat_id) then
    raise exception 'not_authorized';
  end if;
  delete from public.helper_flats where helper_id = p_helper_id and flat_id = p_flat_id;
  if not found then
    raise exception 'not_authorized';
  end if;
end;
$$;

create function public.helper_check_in(p_helper_id uuid)
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
  if exists (select 1 from public.helper_attendance where helper_id = p_helper_id and exit_at is null) then
    raise exception 'already_inside';
  end if;
  insert into public.helper_attendance (society_id, helper_id, entry_by)
  values (v_helper.society_id, p_helper_id, auth.uid())
  returning * into v_row;
  return v_row;
end;
$$;

create function public.helper_check_out(p_helper_id uuid)
returns public.helper_attendance
language plpgsql security definer set search_path = ''
as $$
declare
  v_helper public.helpers;
  v_row public.helper_attendance;
begin
  select * into v_helper from public.helpers where id = p_helper_id for update;
  if not found or not public.has_role(v_helper.society_id, 'guard') then
    raise exception 'not_authorized';
  end if;
  update public.helper_attendance
     set exit_at = now(), exit_by = auth.uid()
   where helper_id = p_helper_id and exit_at is null
  returning * into v_row;
  if not found then
    raise exception 'not_inside';
  end if;
  return v_row;
end;
$$;

create function public.set_helper_active(p_helper_id uuid, p_active boolean)
returns public.helpers
language plpgsql security definer set search_path = ''
as $$
declare
  v_helper public.helpers;
  v_code text;
  v_attempt int := 0;
begin
  select * into v_helper from public.helpers where id = p_helper_id for update;
  if not found or not public.has_role(v_helper.society_id, 'admin') then
    raise exception 'not_authorized';
  end if;
  if p_active is null then
    raise exception 'invalid_active';
  end if;

  if p_active then
    if not v_helper.active then
      -- The old code may have been handed to another helper meanwhile.
      perform pg_advisory_xact_lock(hashtextextended('add_helper:' || v_helper.society_id::text, 0));
      v_code := v_helper.entry_code;
      while exists (
        select 1 from public.helpers h
        where h.society_id = v_helper.society_id and h.entry_code = v_code and h.active
      ) loop
        v_attempt := v_attempt + 1;
        if v_attempt > 50 then
          raise exception 'code_generation_failed';
        end if;
        v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
      end loop;
      update public.helpers set active = true, entry_code = v_code
       where id = p_helper_id returning * into v_helper;
    end if;
  else
    update public.helper_attendance
       set exit_at = now(), exit_by = auth.uid()
     where helper_id = p_helper_id and exit_at is null;
    update public.helpers set active = false
     where id = p_helper_id returning * into v_helper;
  end if;
  return v_helper;
end;
$$;

revoke execute on function
  public.add_helper(uuid, text, text, public.helper_type, text, text),
  public.remove_helper_from_flat(uuid, uuid),
  public.helper_check_in(uuid),
  public.helper_check_out(uuid),
  public.set_helper_active(uuid, boolean)
from public, anon, authenticated;

grant execute on function
  public.add_helper(uuid, text, text, public.helper_type, text, text),
  public.remove_helper_from_flat(uuid, uuid),
  public.helper_check_in(uuid),
  public.helper_check_out(uuid),
  public.set_helper_active(uuid, boolean)
to authenticated;
