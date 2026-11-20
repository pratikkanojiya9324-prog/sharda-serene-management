-- Society Gate: pre-approval pass RPCs (the only write path for passes)

create function public.create_pass(
  p_flat_id uuid, p_guest_name text, p_valid_from timestamptz, p_valid_to timestamptz
) returns public.passes
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid;
  v_code text;
  v_pass public.passes;
  v_attempt int := 0;
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

  insert into public.passes (society_id, flat_id, created_by, guest_name, code, valid_from, valid_to)
  values (v_society, p_flat_id, auth.uid(), btrim(p_guest_name), v_code, p_valid_from, p_valid_to)
  returning * into v_pass;
  return v_pass;
end;
$$;

create function public.revoke_pass(p_pass_id uuid)
returns public.passes
language plpgsql security definer set search_path = ''
as $$
declare
  v_pass public.passes;
begin
  select * into v_pass from public.passes where id = p_pass_id;
  if not found
     or not (public.is_flat_resident(v_pass.flat_id) or public.has_role(v_pass.society_id, 'admin')) then
    raise exception 'not_authorized';
  end if;

  update public.passes set revoked_at = coalesce(revoked_at, now())
   where id = p_pass_id returning * into v_pass;
  return v_pass;
end;
$$;

create function public.use_pass(p_code text)
returns public.visits
language plpgsql security definer set search_path = ''
as $$
declare
  v_pass public.passes;
  v_visit public.visits;
begin
  if not exists (
    select 1 from public.memberships m where m.profile_id = auth.uid() and m.role = 'guard'
  ) then
    raise exception 'not_authorized';
  end if;

  -- Only passes of societies where the caller is a guard. Codes are unique among
  -- live passes, so prefer a live pass; otherwise the newest matching one.
  select p.* into v_pass
  from public.passes p
  where p.code = p_code and public.has_role(p.society_id, 'guard')
  order by (p.revoked_at is null and p.valid_to > now()) desc, p.created_at desc
  limit 1;
  if not found then
    raise exception 'invalid_code';
  end if;
  if v_pass.revoked_at is not null then
    raise exception 'pass_revoked';
  end if;
  if now() < v_pass.valid_from then
    raise exception 'pass_not_yet_valid';
  end if;
  if now() >= v_pass.valid_to then
    raise exception 'pass_expired';
  end if;

  -- flat and society both come from the pass (the visit->pass FK only enforces same society)
  insert into public.visits
    (society_id, flat_id, name, purpose, status, pass_id, entry_at, created_by)
  values
    (v_pass.society_id, v_pass.flat_id, v_pass.guest_name, 'guest', 'approved', v_pass.id, now(), auth.uid())
  returning * into v_visit;
  return v_visit;
end;
$$;

create function public.add_household_member(p_flat_id uuid, p_name text, p_phone text)
returns public.invites
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid;
  v_invite public.invites;
begin
  select society_id into v_society from public.flats where id = p_flat_id;
  if v_society is null or not public.is_flat_resident(p_flat_id) then
    raise exception 'not_authorized';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'invalid_name';
  end if;
  if p_phone is null or p_phone !~ '^\+91[6-9][0-9]{9}$' then
    raise exception 'invalid_phone';
  end if;

  insert into public.invites (society_id, phone, name, role, flat_id, created_by)
  values (v_society, p_phone, btrim(p_name), 'resident', p_flat_id, auth.uid())
  returning * into v_invite;
  return v_invite;
end;
$$;

revoke execute on function
  public.create_pass(uuid, text, timestamptz, timestamptz),
  public.revoke_pass(uuid),
  public.use_pass(text),
  public.add_household_member(uuid, text, text)
from public, anon, authenticated;

grant execute on function
  public.create_pass(uuid, text, timestamptz, timestamptz),
  public.revoke_pass(uuid),
  public.use_pass(text),
  public.add_household_member(uuid, text, text)
to authenticated;
