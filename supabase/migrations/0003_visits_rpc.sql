-- Society Gate: visit RPCs (the only write path for visits) and auto-expiry

create function public.create_visit(
  p_flat_id uuid, p_name text, p_phone text, p_purpose public.visit_purpose, p_photo_path text
) returns public.visits
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid;
  v_visit public.visits;
begin
  select society_id into v_society from public.flats where id = p_flat_id;
  if v_society is null or not public.has_role(v_society, 'guard') then
    raise exception 'not_authorized';
  end if;

  insert into public.visits (society_id, flat_id, name, phone, purpose, photo_path, created_by)
  values (v_society, p_flat_id, p_name, p_phone, p_purpose, p_photo_path, auth.uid())
  returning * into v_visit;
  return v_visit;
end;
$$;

create function public.respond_to_visit(p_visit_id uuid, p_response public.visit_status)
returns public.visits
language plpgsql security definer set search_path = ''
as $$
declare
  v_flat uuid;
  v_status public.visit_status;
  v_visit public.visits;
begin
  select flat_id into v_flat from public.visits where id = p_visit_id;
  if v_flat is null or not public.is_flat_resident(v_flat) then
    raise exception 'not_authorized';
  end if;
  if p_response not in ('approved', 'denied', 'leave_at_gate') then
    raise exception 'invalid_response';
  end if;

  update public.visits
     set status = p_response, responded_by = auth.uid(), responded_at = now()
   where id = p_visit_id and status = 'pending'
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

create function public.record_manual_outcome(p_visit_id uuid, p_outcome public.manual_outcome)
returns public.visits
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid;
  v_visit public.visits;
begin
  select society_id into v_society from public.visits where id = p_visit_id;
  if v_society is null or not public.has_role(v_society, 'guard') then
    raise exception 'not_authorized';
  end if;

  update public.visits set manual_outcome = p_outcome
   where id = p_visit_id and status in ('pending', 'expired')
  returning * into v_visit;
  if not found then
    raise exception 'already_responded';
  end if;
  return v_visit;
end;
$$;

create function public.mark_entry(p_visit_id uuid)
returns public.visits
language plpgsql security definer set search_path = ''
as $$
declare
  v_visit public.visits;
begin
  select * into v_visit from public.visits where id = p_visit_id;
  if not found or not public.has_role(v_visit.society_id, 'guard') then
    raise exception 'not_authorized';
  end if;
  if not (v_visit.status in ('approved', 'leave_at_gate') or v_visit.manual_outcome is not distinct from 'allowed') then
    raise exception 'not_allowed_in';
  end if;

  update public.visits set entry_at = coalesce(entry_at, now())
   where id = p_visit_id returning * into v_visit;
  return v_visit;
end;
$$;

create function public.mark_exit(p_visit_id uuid)
returns public.visits
language plpgsql security definer set search_path = ''
as $$
declare
  v_visit public.visits;
begin
  select * into v_visit from public.visits where id = p_visit_id;
  if not found or not public.has_role(v_visit.society_id, 'guard') then
    raise exception 'not_authorized';
  end if;
  if v_visit.entry_at is null then
    raise exception 'not_entered';
  end if;

  update public.visits set exit_at = coalesce(exit_at, now())
   where id = p_visit_id returning * into v_visit;
  return v_visit;
end;
$$;

create function public.flat_contacts(p_flat_id uuid)
returns table (name text, phone text)
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
    select p.name, p.phone
    from public.flat_residents fr
    join public.profiles p on p.id = fr.profile_id
    where fr.flat_id = p_flat_id
    order by p.name;
end;
$$;

create function public.visit_has_app_users(p_flat_id uuid)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_society uuid;
begin
  select society_id into v_society from public.flats where id = p_flat_id;
  if v_society is null or not public.has_role(v_society, 'guard') then
    raise exception 'not_authorized';
  end if;
  return exists (
    select 1
    from public.flat_residents fr
    join public.push_tokens t on t.profile_id = fr.profile_id
    where fr.flat_id = p_flat_id
  );
end;
$$;

create function public.expire_stale_visits()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_count int;
begin
  update public.visits set status = 'expired'
   where status = 'pending' and created_at < now() - interval '10 minutes';
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function
  public.create_visit(uuid, text, text, public.visit_purpose, text),
  public.respond_to_visit(uuid, public.visit_status),
  public.record_manual_outcome(uuid, public.manual_outcome),
  public.mark_entry(uuid),
  public.mark_exit(uuid),
  public.flat_contacts(uuid),
  public.visit_has_app_users(uuid),
  public.expire_stale_visits()
from public, anon, authenticated;

grant execute on function
  public.create_visit(uuid, text, text, public.visit_purpose, text),
  public.respond_to_visit(uuid, public.visit_status),
  public.record_manual_outcome(uuid, public.manual_outcome),
  public.mark_entry(uuid),
  public.mark_exit(uuid),
  public.flat_contacts(uuid),
  public.visit_has_app_users(uuid)
to authenticated;

-- Auto-expiry: every minute (cron runs as postgres)
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('expire-visits', '* * * * *', 'select public.expire_stale_visits()');

-- Realtime: clients subscribe to visit changes (RLS still applies)
alter publication supabase_realtime add table public.visits;
