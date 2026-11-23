-- Round 3: SOS alerts, emergency contacts and the opt-in resident directory.
-- Writes are RPC-only (security definer).

create type public.sos_type as enum ('medical', 'fire', 'security', 'lift', 'other');
create type public.sos_status as enum ('open', 'acknowledged', 'resolved', 'cancelled');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.sos_alerts (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  flat_id uuid not null,
  type public.sos_type not null,
  status public.sos_status not null default 'open',
  raised_by_name text,
  created_at timestamptz not null default now(),
  acknowledged_by_name text,
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolved_note text,
  resolved_by_name text,
  constraint sos_alerts_flat_same_society
    foreign key (flat_id, society_id) references public.flats (id, society_id) on delete cascade
);
create unique index sos_alerts_one_active_uidx
  on public.sos_alerts (flat_id) where status in ('open', 'acknowledged');
create index sos_alerts_society_idx on public.sos_alerts (society_id, created_at desc);

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  phone text not null,
  note text check (note is null or char_length(note) <= 200),
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index emergency_contacts_society_idx on public.emergency_contacts (society_id, sort_order, name);

alter table public.family_members
  add column in_directory boolean not null default false,
  add column show_phone boolean not null default false;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.sos_alerts enable row level security;
alter table public.emergency_contacts enable row level security;

revoke all on public.sos_alerts, public.emergency_contacts from anon;
revoke insert, update, delete on public.sos_alerts, public.emergency_contacts from authenticated;

create policy sos_alerts_select on public.sos_alerts for select to authenticated
  using (
    public.has_role(society_id, 'admin') or public.has_role(society_id, 'guard')
    or public.is_flat_resident(flat_id)
  );

create policy emergency_contacts_select on public.emergency_contacts for select to authenticated
  using (public.is_member(society_id));

-- ---------------------------------------------------------------------------
-- SOS RPCs
-- ---------------------------------------------------------------------------
create function public.raise_sos(
  p_flat_id uuid, p_type public.sos_type, p_actor_name text default null
) returns public.sos_alerts
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid;
  v_name text;
  v_row public.sos_alerts;
begin
  select society_id into v_society from public.flats where id = p_flat_id;
  if v_society is null or p_type is null or not public.is_flat_resident(p_flat_id) then
    raise exception 'not_authorized';
  end if;
  v_name := public.clean_actor_name(p_actor_name);

  select * into v_row from public.sos_alerts
   where flat_id = p_flat_id and status in ('open', 'acknowledged');
  if found then
    return v_row;
  end if;

  begin
    insert into public.sos_alerts (society_id, flat_id, type, raised_by_name)
    values (v_society, p_flat_id, p_type, v_name)
    returning * into v_row;
  exception when unique_violation then
    select * into v_row from public.sos_alerts
     where flat_id = p_flat_id and status in ('open', 'acknowledged');
  end;
  return v_row;
end;
$$;

create function public.cancel_sos(p_id uuid)
returns public.sos_alerts
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.sos_alerts;
begin
  select * into v_row from public.sos_alerts where id = p_id for update;
  if not found or not public.is_flat_resident(v_row.flat_id) then
    raise exception 'not_authorized';
  end if;
  if v_row.status not in ('open', 'acknowledged') then
    raise exception 'sos_closed';
  end if;
  update public.sos_alerts set status = 'cancelled' where id = p_id returning * into v_row;
  return v_row;
end;
$$;

create function public.ack_sos(p_id uuid, p_actor_name text default null)
returns public.sos_alerts
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.sos_alerts;
  v_name text;
begin
  select * into v_row from public.sos_alerts where id = p_id for update;
  if not found or not (public.has_role(v_row.society_id, 'guard')
                       or public.has_role(v_row.society_id, 'admin')) then
    raise exception 'not_authorized';
  end if;
  v_name := public.clean_actor_name(p_actor_name);
  if v_row.status = 'acknowledged' then
    return v_row;
  end if;
  if v_row.status <> 'open' then
    raise exception 'sos_closed';
  end if;
  update public.sos_alerts
     set status = 'acknowledged', acknowledged_by_name = v_name, acknowledged_at = now()
   where id = p_id returning * into v_row;
  return v_row;
end;
$$;

create function public.resolve_sos(
  p_id uuid, p_note text default null, p_actor_name text default null
) returns public.sos_alerts
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.sos_alerts;
  v_name text;
  v_note text := nullif(btrim(p_note), '');
begin
  select * into v_row from public.sos_alerts where id = p_id for update;
  if not found or not (public.has_role(v_row.society_id, 'guard')
                       or public.has_role(v_row.society_id, 'admin')) then
    raise exception 'not_authorized';
  end if;
  v_name := public.clean_actor_name(p_actor_name);
  if v_row.status not in ('open', 'acknowledged') then
    raise exception 'sos_closed';
  end if;
  if v_note is not null and char_length(v_note) > 300 then
    raise exception 'invalid_note';
  end if;
  update public.sos_alerts
     set status = 'resolved', resolved_at = now(), resolved_note = v_note, resolved_by_name = v_name
   where id = p_id returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Emergency contact RPCs (admin)
-- ---------------------------------------------------------------------------
create function public.upsert_emergency_contact(
  p_id uuid, p_name text, p_phone text, p_note text, p_sort_order int
) returns public.emergency_contacts
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid := public.admin_society();
  v_name text := btrim(p_name);
  v_phone text := btrim(p_phone);
  v_note text := nullif(btrim(p_note), '');
  v_row public.emergency_contacts;
begin
  if v_society is null then
    raise exception 'not_authorized';
  end if;
  if v_name is null or char_length(v_name) < 1 or char_length(v_name) > 80
     or (v_note is not null and char_length(v_note) > 200) then
    raise exception 'invalid_name';
  end if;
  if v_phone is null or v_phone !~ '^\+?[0-9]{3,15}$' then
    raise exception 'invalid_contact_phone';
  end if;

  if p_id is null then
    insert into public.emergency_contacts (society_id, name, phone, note, sort_order)
    values (v_society, v_name, v_phone, v_note, coalesce(p_sort_order, 0))
    returning * into v_row;
  else
    update public.emergency_contacts
       set name = v_name, phone = v_phone, note = v_note, sort_order = coalesce(p_sort_order, 0)
     where id = p_id and society_id = v_society
    returning * into v_row;
    if v_row.id is null then
      raise exception 'not_authorized';
    end if;
  end if;
  return v_row;
end;
$$;

create function public.delete_emergency_contact(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid := public.admin_society();
begin
  if v_society is null then
    raise exception 'not_authorized';
  end if;
  delete from public.emergency_contacts where id = p_id and society_id = v_society;
  if not found then
    raise exception 'not_authorized';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Directory RPCs
-- ---------------------------------------------------------------------------
create function public.set_directory_visibility(
  p_member_id uuid, p_in_directory boolean, p_show_phone boolean
) returns public.family_members
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.family_members;
  v_show boolean := coalesce(p_show_phone, false);
  v_in boolean := coalesce(p_in_directory, false);
begin
  select * into v_row from public.family_members where id = p_member_id for update;
  if not found or not public.is_flat_resident(v_row.flat_id) then
    raise exception 'not_authorized';
  end if;
  if v_show then
    v_in := true;
  end if;
  if not v_in then
    v_show := false;
  end if;
  update public.family_members set in_directory = v_in, show_phone = v_show
   where id = p_member_id returning * into v_row;
  return v_row;
end;
$$;

create function public.resident_directory()
returns table (flat_id uuid, flat_label text, name text, relation text, phone text)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_society uuid;
begin
  select m.society_id into v_society from public.memberships m
   where m.profile_id = auth.uid() order by m.society_id limit 1;
  if v_society is null then
    raise exception 'not_authorized';
  end if;

  return query
  select fm.flat_id,
         coalesce('B' || substring(t.building from '(\d+)\s*$'), t.building)
           || '-' || t.name || '-' || f.number,
         fm.name, fm.relation,
         case when fm.show_phone then fm.phone else null end
    from public.family_members fm
    join public.flats f on f.id = fm.flat_id
    join public.towers t on t.id = f.tower_id
   where fm.society_id = v_society and fm.in_directory
   order by 2, fm.name;
end;
$$;

create function public.directory_committee()
returns table (name text)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_society uuid;
begin
  select m.society_id into v_society from public.memberships m
   where m.profile_id = auth.uid() order by m.society_id limit 1;
  if v_society is null then
    raise exception 'not_authorized';
  end if;

  return query
  select p.name
    from public.memberships m
    join public.profiles p on p.id = m.profile_id
   where m.society_id = v_society and m.role = 'admin' and btrim(p.name) <> ''
   order by p.name;
end;
$$;

revoke execute on function
  public.raise_sos(uuid, public.sos_type, text),
  public.cancel_sos(uuid),
  public.ack_sos(uuid, text),
  public.resolve_sos(uuid, text, text),
  public.upsert_emergency_contact(uuid, text, text, text, int),
  public.delete_emergency_contact(uuid),
  public.set_directory_visibility(uuid, boolean, boolean),
  public.resident_directory(),
  public.directory_committee()
from public, anon, authenticated;

grant execute on function
  public.raise_sos(uuid, public.sos_type, text),
  public.cancel_sos(uuid),
  public.ack_sos(uuid, text),
  public.resolve_sos(uuid, text, text),
  public.upsert_emergency_contact(uuid, text, text, text, int),
  public.delete_emergency_contact(uuid),
  public.set_directory_visibility(uuid, boolean, boolean),
  public.resident_directory(),
  public.directory_committee()
to authenticated;
