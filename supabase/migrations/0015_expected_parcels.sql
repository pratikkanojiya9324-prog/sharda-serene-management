-- Round 2: expected entries (pre-approved deliveries/cabs/guests that auto-approve
-- matching gate visits) and parcels held at the gate. Writes are RPC-only.

create type public.parcel_status as enum ('at_gate', 'collected', 'returned');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.expected_entries (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  society_id uuid not null references public.societies(id) on delete cascade,
  flat_id uuid not null,
  purpose public.visit_purpose not null check (purpose <> 'other'),
  company text,
  valid_from timestamptz not null default now(),
  valid_to timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  cancelled_at timestamptz,
  used_count int not null default 0,
  constraint expected_entries_flat_same_society
    foreign key (flat_id, society_id) references public.flats (id, society_id) on delete cascade
);
create index expected_entries_match_idx
  on public.expected_entries (flat_id, purpose, valid_to desc) where cancelled_at is null;
create index expected_entries_flat_idx on public.expected_entries (flat_id, created_at desc);

alter table public.visits
  add column expected_entry_id uuid references public.expected_entries(id) on delete set null;

create table public.parcels (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  society_id uuid not null references public.societies(id) on delete cascade,
  flat_id uuid not null,
  courier text not null,
  note text,
  photo_path text,
  status public.parcel_status not null default 'at_gate',
  logged_by uuid references public.profiles(id) on delete set null,
  collected_at timestamptz,
  collected_by_name text,
  handed_by uuid references public.profiles(id) on delete set null,
  visit_id uuid references public.visits(id) on delete set null,
  constraint parcels_flat_same_society
    foreign key (flat_id, society_id) references public.flats (id, society_id) on delete cascade
);
create index parcels_flat_idx on public.parcels (flat_id, created_at desc);
create index parcels_society_status_idx on public.parcels (society_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS: reads only; writes via RPC
-- ---------------------------------------------------------------------------
alter table public.expected_entries enable row level security;
alter table public.parcels enable row level security;

revoke all on public.expected_entries, public.parcels from anon;
revoke insert, update, delete on public.expected_entries, public.parcels from authenticated;

create policy expected_entries_select on public.expected_entries for select to authenticated
  using (
    public.has_role(society_id, 'guard') or public.has_role(society_id, 'admin')
    or public.is_flat_resident(flat_id)
  );

create policy parcels_select on public.parcels for select to authenticated
  using (
    public.has_role(society_id, 'guard') or public.has_role(society_id, 'admin')
    or public.is_flat_resident(flat_id)
  );

-- ---------------------------------------------------------------------------
-- Storage: parcel-photos/{society_id}/{flat_id}/... (CASE-guarded uuid casts)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('parcel-photos', 'parcel-photos', false)
on conflict (id) do nothing;

create policy parcel_photos_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'parcel-photos'
  and case
    when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_role(((storage.foldername(name))[1])::uuid, 'guard')
    else false
  end
);

create policy parcel_photos_select on storage.objects
for select to authenticated
using (
  bucket_id = 'parcel-photos'
  and case
    when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_role(((storage.foldername(name))[1])::uuid, 'guard')
        or public.has_role(((storage.foldername(name))[1])::uuid, 'admin')
        or (
          (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
          and public.is_flat_resident(((storage.foldername(name))[2])::uuid)
        )
    else false
  end
);

-- ---------------------------------------------------------------------------
-- Expected entries
-- ---------------------------------------------------------------------------
create function public.create_expected_entry(
  p_flat_id uuid, p_purpose public.visit_purpose, p_company text, p_hours int,
  p_actor_name text default null
) returns public.expected_entries
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid;
  v_company text := nullif(btrim(p_company), '');
  v_row public.expected_entries;
begin
  select society_id into v_society from public.flats where id = p_flat_id;
  if v_society is null or not public.is_flat_resident(p_flat_id) then
    raise exception 'not_authorized';
  end if;
  if p_hours is null or p_hours not in (1, 2, 4, 8) then
    raise exception 'invalid_hours';
  end if;
  if p_purpose is null or p_purpose not in ('delivery', 'cab', 'service', 'guest') then
    raise exception 'invalid_purpose';
  end if;
  if v_company is not null and char_length(v_company) > 40 then
    raise exception 'invalid_company';
  end if;

  insert into public.expected_entries
    (society_id, flat_id, purpose, company, valid_from, valid_to, created_by, created_by_name)
  values
    (v_society, p_flat_id, p_purpose, v_company, now(), now() + make_interval(hours => p_hours),
     auth.uid(), public.clean_actor_name(p_actor_name))
  returning * into v_row;
  return v_row;
end;
$$;

create function public.cancel_expected_entry(p_id uuid)
returns public.expected_entries
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.expected_entries;
begin
  select * into v_row from public.expected_entries where id = p_id for update;
  if not found or not public.is_flat_resident(v_row.flat_id) then
    raise exception 'not_authorized';
  end if;
  if v_row.cancelled_at is not null then
    raise exception 'already_cancelled';
  end if;
  update public.expected_entries set cancelled_at = now()
   where id = p_id returning * into v_row;
  return v_row;
end;
$$;

-- Same signature, authorization and behaviour as 0003; a visit matching an
-- active expected entry (same flat + purpose) is approved on the spot.
create or replace function public.create_visit(
  p_flat_id uuid, p_name text, p_phone text, p_purpose public.visit_purpose, p_photo_path text
) returns public.visits
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid;
  v_visit public.visits;
  v_entry public.expected_entries;
begin
  select society_id into v_society from public.flats where id = p_flat_id;
  if v_society is null or not public.has_role(v_society, 'guard') then
    raise exception 'not_authorized';
  end if;

  select * into v_entry from public.expected_entries
   where flat_id = p_flat_id and purpose = p_purpose
     and cancelled_at is null and now() between valid_from and valid_to
   order by valid_to desc
   limit 1
   for update;

  if found then
    insert into public.visits
      (society_id, flat_id, name, phone, purpose, photo_path, created_by,
       status, responded_at, responded_by_name, expected_entry_id)
    values
      (v_society, p_flat_id, p_name, p_phone, p_purpose, p_photo_path, auth.uid(),
       'approved', now(), coalesce(v_entry.created_by_name, 'Resident') || ' (expected)', v_entry.id)
    returning * into v_visit;
    update public.expected_entries set used_count = used_count + 1 where id = v_entry.id;
  else
    insert into public.visits (society_id, flat_id, name, phone, purpose, photo_path, created_by)
    values (v_society, p_flat_id, p_name, p_phone, p_purpose, p_photo_path, auth.uid())
    returning * into v_visit;
  end if;
  return v_visit;
end;
$$;

-- ---------------------------------------------------------------------------
-- Parcels
-- ---------------------------------------------------------------------------
create function public.log_parcel(
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

  insert into public.parcels (society_id, flat_id, courier, note, photo_path, logged_by, visit_id)
  values (v_society, p_flat_id, v_courier, nullif(btrim(p_note), ''), p_photo_path, auth.uid(), p_visit_id)
  returning * into v_row;
  return v_row;
end;
$$;

create function public.collect_parcel(p_parcel_id uuid, p_collected_by_name text)
returns public.parcels
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.parcels;
  v_name text := btrim(p_collected_by_name);
begin
  select * into v_row from public.parcels where id = p_parcel_id for update;
  if not found or not public.has_role(v_row.society_id, 'guard') then
    raise exception 'not_authorized';
  end if;
  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 60 then
    raise exception 'invalid_name';
  end if;
  if v_row.status <> 'at_gate' then
    raise exception 'already_collected';
  end if;
  update public.parcels
     set status = 'collected', collected_at = now(), collected_by_name = v_name, handed_by = auth.uid()
   where id = p_parcel_id returning * into v_row;
  return v_row;
end;
$$;

create function public.return_parcel(p_parcel_id uuid)
returns public.parcels
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.parcels;
begin
  select * into v_row from public.parcels where id = p_parcel_id for update;
  if not found or not public.has_role(v_row.society_id, 'guard') then
    raise exception 'not_authorized';
  end if;
  if v_row.status <> 'at_gate' then
    raise exception 'already_collected';
  end if;
  update public.parcels
     set status = 'returned', collected_at = now(), handed_by = auth.uid()
   where id = p_parcel_id returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function
  public.create_expected_entry(uuid, public.visit_purpose, text, int, text),
  public.cancel_expected_entry(uuid),
  public.log_parcel(uuid, text, text, text, uuid),
  public.collect_parcel(uuid, text),
  public.return_parcel(uuid)
from public, anon, authenticated;

grant execute on function
  public.create_expected_entry(uuid, public.visit_purpose, text, int, text),
  public.cancel_expected_entry(uuid),
  public.log_parcel(uuid, text, text, text, uuid),
  public.collect_parcel(uuid, text),
  public.return_parcel(uuid)
to authenticated;
