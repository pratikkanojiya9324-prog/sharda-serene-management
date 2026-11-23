-- Round 3: amenity booking. Slots are an IST grid between open_time and close_time;
-- writes are RPC-only (security definer).

create type public.booking_status as enum ('pending', 'confirmed', 'rejected', 'cancelled');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.amenities (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  open_time time not null,
  close_time time not null,
  slot_minutes int not null check (slot_minutes in (30, 60, 120, 240, 1440)),
  requires_approval boolean not null default false,
  max_upcoming int not null default 2 check (max_upcoming between 1 and 50),
  fee_note text check (fee_note is null or char_length(fee_note) <= 200),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  check (open_time < close_time)
);
create index amenities_society_idx on public.amenities (society_id, name);

create table public.amenity_bookings (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  amenity_id uuid not null references public.amenities(id) on delete cascade,
  flat_id uuid not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status public.booking_status not null,
  booked_by_name text,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  reject_reason text,
  created_at timestamptz not null default now(),
  check (end_at > start_at),
  constraint amenity_bookings_flat_same_society
    foreign key (flat_id, society_id) references public.flats (id, society_id) on delete cascade
);
create unique index amenity_bookings_slot_uidx
  on public.amenity_bookings (amenity_id, start_at) where status in ('pending', 'confirmed');
create index amenity_bookings_flat_idx on public.amenity_bookings (flat_id, start_at desc);
create index amenity_bookings_society_idx on public.amenity_bookings (society_id, start_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.amenities enable row level security;
alter table public.amenity_bookings enable row level security;

revoke all on public.amenities, public.amenity_bookings from anon;
revoke insert, update, delete on public.amenities, public.amenity_bookings from authenticated;

create policy amenities_select on public.amenities for select to authenticated
  using (public.is_member(society_id));

create policy amenity_bookings_select on public.amenity_bookings for select to authenticated
  using (
    public.has_role(society_id, 'admin') or public.has_role(society_id, 'guard')
    or public.is_flat_resident(flat_id)
  );

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------
create function public.upsert_amenity(
  p_id uuid, p_name text, p_description text, p_open_time time, p_close_time time,
  p_slot_minutes int, p_requires_approval boolean, p_max_upcoming int, p_fee_note text,
  p_active boolean
) returns public.amenities
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid := public.admin_society();
  v_name text := btrim(p_name);
  v_description text := nullif(btrim(p_description), '');
  v_fee text := nullif(btrim(p_fee_note), '');
  v_max int := coalesce(p_max_upcoming, 2);
  v_row public.amenities;
begin
  if v_society is null then
    raise exception 'not_authorized';
  end if;
  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 80
     or (v_description is not null and char_length(v_description) > 500)
     or (v_fee is not null and char_length(v_fee) > 200) then
    raise exception 'invalid_name';
  end if;
  if p_slot_minutes is null or p_slot_minutes not in (30, 60, 120, 240, 1440) then
    raise exception 'invalid_slot';
  end if;
  if p_open_time is null or p_close_time is null or p_open_time >= p_close_time
     or (p_slot_minutes < 1440
         and extract(epoch from (p_close_time - p_open_time)) < p_slot_minutes * 60) then
    raise exception 'invalid_time';
  end if;
  if v_max < 1 or v_max > 50 then
    raise exception 'invalid_limit';
  end if;

  if p_id is null then
    insert into public.amenities
      (society_id, name, description, open_time, close_time, slot_minutes,
       requires_approval, max_upcoming, fee_note, active)
    values
      (v_society, v_name, v_description, p_open_time, p_close_time, p_slot_minutes,
       coalesce(p_requires_approval, false), v_max, v_fee, coalesce(p_active, true))
    returning * into v_row;
  else
    update public.amenities set
      name = v_name, description = v_description, open_time = p_open_time,
      close_time = p_close_time, slot_minutes = p_slot_minutes,
      requires_approval = coalesce(p_requires_approval, false), max_upcoming = v_max,
      fee_note = v_fee, active = coalesce(p_active, true)
    where id = p_id and society_id = v_society
    returning * into v_row;
    if v_row.id is null then
      raise exception 'not_authorized';
    end if;
  end if;
  return v_row;
end;
$$;

create function public.decide_booking(
  p_booking_id uuid, p_approve boolean, p_reason text default null
) returns public.amenity_bookings
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.amenity_bookings;
  v_reason text := nullif(btrim(p_reason), '');
begin
  select * into v_row from public.amenity_bookings where id = p_booking_id for update;
  if not found or not public.has_role(v_row.society_id, 'admin') then
    raise exception 'not_authorized';
  end if;
  if v_row.status <> 'pending' then
    raise exception 'not_pending';
  end if;
  if v_reason is not null and char_length(v_reason) > 200 then
    raise exception 'invalid_reason';
  end if;
  update public.amenity_bookings set
    status = case when coalesce(p_approve, false) then 'confirmed'::public.booking_status
                  else 'rejected'::public.booking_status end,
    decided_by = auth.uid(),
    decided_at = now(),
    reject_reason = case when coalesce(p_approve, false) then null else v_reason end
  where id = p_booking_id
  returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Slot grid
-- ---------------------------------------------------------------------------
create function public.amenity_slots(
  p_amenity_id uuid, p_date date, p_flat_id uuid default null
) returns table (start_at timestamptz, end_at timestamptz, state text)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_am public.amenities;
begin
  select * into v_am from public.amenities where id = p_amenity_id;
  if v_am.id is null or p_date is null or not public.is_member(v_am.society_id) then
    raise exception 'not_authorized';
  end if;
  if p_flat_id is not null and not (
    exists (select 1 from public.flats f where f.id = p_flat_id and f.society_id = v_am.society_id)
    and public.is_flat_resident(p_flat_id)
  ) then
    raise exception 'not_authorized';
  end if;

  return query
  select s.s_at, s.s_at + make_interval(mins => v_am.slot_minutes),
    case
      when s.s_at <= now() then 'past'
      when b.id is null then 'free'
      when p_flat_id is not null and b.flat_id = p_flat_id then 'mine'
      else 'taken'
    end
  from (
    select ((p_date + v_am.open_time) + make_interval(mins => v_am.slot_minutes * k))
             at time zone 'Asia/Kolkata' as s_at
      from generate_series(
        0,
        case when v_am.slot_minutes = 1440 then 0
             else (extract(epoch from (v_am.close_time - v_am.open_time))::int / 60
                   / v_am.slot_minutes) - 1 end
      ) k
  ) s
  left join public.amenity_bookings b
    on b.amenity_id = v_am.id and b.start_at = s.s_at and b.status in ('pending', 'confirmed')
  order by s.s_at;
end;
$$;

-- ---------------------------------------------------------------------------
-- Resident RPCs
-- ---------------------------------------------------------------------------
create function public.book_amenity(
  p_amenity_id uuid, p_flat_id uuid, p_start_at timestamptz, p_actor_name text default null
) returns public.amenity_bookings
language plpgsql security definer set search_path = ''
as $$
declare
  v_am public.amenities;
  v_flat_society uuid;
  v_name text;
  v_local timestamp;
  v_date date;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_row public.amenity_bookings;
begin
  select * into v_am from public.amenities where id = p_amenity_id;
  select society_id into v_flat_society from public.flats where id = p_flat_id;
  if v_am.id is null or v_flat_society is null or v_flat_society <> v_am.society_id
     or p_start_at is null or not public.is_flat_resident(p_flat_id) then
    raise exception 'not_authorized';
  end if;
  v_name := public.clean_actor_name(p_actor_name);

  if not v_am.active then
    raise exception 'amenity_inactive';
  end if;
  if p_start_at <= now() then
    raise exception 'in_past';
  end if;
  v_local := p_start_at at time zone 'Asia/Kolkata';
  v_date := v_local::date;
  if v_date > v_today + 14 then
    raise exception 'too_far_ahead';
  end if;

  if v_am.slot_minutes = 1440 then
    if v_local <> v_date + v_am.open_time then
      raise exception 'bad_slot';
    end if;
  else
    if mod(extract(epoch from (v_local - (v_date + v_am.open_time)))::numeric,
           (v_am.slot_minutes * 60)::numeric) <> 0 then
      raise exception 'bad_slot';
    end if;
    if v_local < v_date + v_am.open_time
       or v_local + make_interval(mins => v_am.slot_minutes) > v_date + v_am.close_time then
      raise exception 'outside_hours';
    end if;
  end if;

  if (select count(*) from public.amenity_bookings b
       where b.flat_id = p_flat_id and b.amenity_id = v_am.id
         and b.status in ('pending', 'confirmed') and b.end_at > now()) >= v_am.max_upcoming then
    raise exception 'booking_limit';
  end if;

  begin
    insert into public.amenity_bookings
      (society_id, amenity_id, flat_id, start_at, end_at, status, booked_by_name)
    values
      (v_am.society_id, v_am.id, p_flat_id, p_start_at,
       p_start_at + make_interval(mins => v_am.slot_minutes),
       case when v_am.requires_approval then 'pending'::public.booking_status
            else 'confirmed'::public.booking_status end,
       v_name)
    returning * into v_row;
  exception when unique_violation then
    raise exception 'slot_taken';
  end;
  return v_row;
end;
$$;

create function public.cancel_booking(p_booking_id uuid)
returns public.amenity_bookings
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.amenity_bookings;
begin
  select * into v_row from public.amenity_bookings where id = p_booking_id for update;
  if not found or not public.is_flat_resident(v_row.flat_id) then
    raise exception 'not_authorized';
  end if;
  if v_row.status in ('cancelled', 'rejected') then
    raise exception 'already_cancelled';
  end if;
  if v_row.start_at <= now() then
    raise exception 'already_started';
  end if;
  update public.amenity_bookings set status = 'cancelled' where id = p_booking_id
  returning * into v_row;
  return v_row;
end;
$$;

revoke execute on function
  public.upsert_amenity(uuid, text, text, time, time, int, boolean, int, text, boolean),
  public.decide_booking(uuid, boolean, text),
  public.amenity_slots(uuid, date, uuid),
  public.book_amenity(uuid, uuid, timestamptz, text),
  public.cancel_booking(uuid)
from public, anon, authenticated;

grant execute on function
  public.upsert_amenity(uuid, text, text, time, time, int, boolean, int, text, boolean),
  public.decide_booking(uuid, boolean, text),
  public.amenity_slots(uuid, date, uuid),
  public.book_amenity(uuid, uuid, timestamptz, text),
  public.cancel_booking(uuid)
to authenticated;
