-- Round 1: flat accounts. Accounts are flats/staff, not people, so profiles.phone
-- is optional; family members live in their own table; actors are named per action.

-- ---------------------------------------------------------------------------
-- Profiles: phone optional (unique still holds for non-null values)
-- ---------------------------------------------------------------------------
alter table public.profiles alter column phone drop not null;

-- ---------------------------------------------------------------------------
-- Towers: building + wing (towers.name is the wing)
-- ---------------------------------------------------------------------------
alter table public.towers add column building text not null default 'Building 1';
alter table public.towers drop constraint towers_society_id_name_key;
alter table public.towers add constraint towers_society_building_name_key unique (society_id, building, name);

-- ---------------------------------------------------------------------------
-- Family members (managed by admins)
-- ---------------------------------------------------------------------------
create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  flat_id uuid not null,
  name text not null,
  phone text,
  relation text,
  created_at timestamptz not null default now(),
  constraint family_members_flat_same_society
    foreign key (flat_id, society_id) references public.flats (id, society_id) on delete cascade
);
create index family_members_flat_idx on public.family_members (flat_id);

alter table public.family_members enable row level security;
revoke all on public.family_members from anon;

create policy family_members_select on public.family_members for select to authenticated
  using (
    public.has_role(society_id, 'admin')
    or public.has_role(society_id, 'guard')
    or public.is_flat_resident(flat_id)
  );
create policy family_members_insert on public.family_members for insert to authenticated
  with check (public.has_role(society_id, 'admin'));
create policy family_members_update on public.family_members for update to authenticated
  using (public.has_role(society_id, 'admin')) with check (public.has_role(society_id, 'admin'));
create policy family_members_delete on public.family_members for delete to authenticated
  using (public.has_role(society_id, 'admin'));

-- ---------------------------------------------------------------------------
-- Actor names ("Approved by Rahul")
-- ---------------------------------------------------------------------------
alter table public.visits add column responded_by_name text;
alter table public.passes add column created_by_name text;

-- Trims; blank -> null; over 60 chars -> invalid_actor_name. Internal helper.
create function public.clean_actor_name(p_name text)
returns text
language plpgsql immutable set search_path = ''
as $$
declare
  v_name text := nullif(btrim(p_name), '');
begin
  if v_name is not null and char_length(v_name) > 60 then
    raise exception 'invalid_actor_name';
  end if;
  return v_name;
end;
$$;
revoke execute on function public.clean_actor_name(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Login directory: the only thing anon can read (no names, phones, residents)
-- ---------------------------------------------------------------------------
create function public.login_directory(p_society_id uuid)
returns table (society_name text, building text, wing text, flat_id uuid, flat_number text)
language sql stable security definer set search_path = ''
as $$
  select s.name, t.building, t.name, f.id, f.number
  from public.societies s
  join public.flats f on f.society_id = s.id
  join public.towers t on t.id = f.tower_id
  where s.id = p_society_id
  order by t.building, t.name, f.number;
$$;
revoke execute on function public.login_directory(uuid) from public, anon, authenticated;
grant execute on function public.login_directory(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- respond_to_visit: add p_actor_name (behaviour of 0010 otherwise unchanged)
-- ---------------------------------------------------------------------------
drop function public.respond_to_visit(uuid, public.visit_status);
create function public.respond_to_visit(
  p_visit_id uuid, p_response public.visit_status, p_actor_name text default null
) returns public.visits
language plpgsql security definer set search_path = ''
as $$
declare
  v_flat uuid;
  v_status public.visit_status;
  v_visit public.visits;
  v_name text;
begin
  select flat_id into v_flat from public.visits where id = p_visit_id;
  if v_flat is null or not public.is_flat_resident(v_flat) then
    raise exception 'not_authorized';
  end if;
  if p_response not in ('approved', 'denied', 'leave_at_gate') then
    raise exception 'invalid_response';
  end if;
  v_name := public.clean_actor_name(p_actor_name);

  update public.visits
     set status = p_response, responded_by = auth.uid(), responded_at = now(),
         responded_by_name = v_name
   where id = p_visit_id and status = 'pending' and manual_outcome is null
  returning * into v_visit;

  if not found then
    select status into v_status from public.visits where id = p_visit_id;
    if v_status = 'expired' then
      raise exception 'visit_expired';
    end if;
    raise exception 'already_responded';
  end if;
  return v_visit;
end;
$$;
revoke execute on function public.respond_to_visit(uuid, public.visit_status, text) from public, anon, authenticated;
grant execute on function public.respond_to_visit(uuid, public.visit_status, text) to authenticated;

-- ---------------------------------------------------------------------------
-- create_pass: add p_actor_name (behaviour of 0004 otherwise unchanged)
-- ---------------------------------------------------------------------------
drop function public.create_pass(uuid, text, timestamptz, timestamptz);
create function public.create_pass(
  p_flat_id uuid, p_guest_name text, p_valid_from timestamptz, p_valid_to timestamptz,
  p_actor_name text default null
) returns public.passes
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid;
  v_code text;
  v_pass public.passes;
  v_attempt int := 0;
  v_name text;
begin
  select society_id into v_society from public.flats where id = p_flat_id;
  if v_society is null or not public.is_flat_resident(p_flat_id) then
    raise exception 'not_authorized';
  end if;
  if p_guest_name is null or btrim(p_guest_name) = '' then
    raise exception 'invalid_guest_name';
  end if;
  if p_valid_from is null or p_valid_to is null or p_valid_to <= p_valid_from then
    raise exception 'invalid_validity';
  end if;
  v_name := public.clean_actor_name(p_actor_name);

  -- Serialize pass creation per society (lock released at commit) so the
  -- "unique among currently-valid passes" check below cannot race with a
  -- concurrent insert of the same code.
  perform pg_advisory_xact_lock(hashtextextended('create_pass:' || v_society::text, 0));

  loop
    v_attempt := v_attempt + 1;
    if v_attempt > 50 then
      raise exception 'code_generation_failed';
    end if;
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (
      select 1 from public.passes p
      where p.society_id = v_society and p.code = v_code
        and p.revoked_at is null and p.valid_to > now()
    );
  end loop;

  insert into public.passes (society_id, flat_id, created_by, created_by_name, guest_name, code, valid_from, valid_to)
  values (v_society, p_flat_id, auth.uid(), v_name, btrim(p_guest_name), v_code, p_valid_from, p_valid_to)
  returning * into v_pass;
  return v_pass;
end;
$$;
revoke execute on function public.create_pass(uuid, text, timestamptz, timestamptz, text) from public, anon, authenticated;
grant execute on function public.create_pass(uuid, text, timestamptz, timestamptz, text) to authenticated;

-- ---------------------------------------------------------------------------
-- flat_contacts: guard "Call resident" now lists family members with phones
-- ---------------------------------------------------------------------------
drop function public.flat_contacts(uuid);
create function public.flat_contacts(p_flat_id uuid)
returns table (name text, phone text, relation text)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_society uuid;
begin
  select society_id into v_society from public.flats where id = p_flat_id;
  if v_society is null or not public.has_role(v_society, 'guard') then
    raise exception 'not_authorized';
  end if;
  return query
    select fm.name, fm.phone, fm.relation
    from public.family_members fm
    where fm.flat_id = p_flat_id and fm.phone is not null
    order by fm.name;
end;
$$;
revoke execute on function public.flat_contacts(uuid) from public, anon, authenticated;
grant execute on function public.flat_contacts(uuid) to authenticated;
