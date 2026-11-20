-- Society Gate: attach a visitor photo after the visit exists, and register a
-- device push token (reassigning it to whoever is signed in on that device).

-- ---------------------------------------------------------------------------
-- set_visit_photo: the guard creates the visit first (so the push goes out at
-- once), uploads the photo, then attaches it here. Only a guard of the visit's
-- society, only once, and only a path inside that society's storage folder.
-- ---------------------------------------------------------------------------
create function public.set_visit_photo(p_visit_id uuid, p_photo_path text)
returns public.visits
language plpgsql security definer set search_path = ''
as $$
declare
  v_visit public.visits;
  v_prefix text;
begin
  select * into v_visit from public.visits where id = p_visit_id;
  if not found or not public.has_role(v_visit.society_id, 'guard') then
    raise exception 'not_authorized';
  end if;

  v_prefix := v_visit.society_id::text || '/';
  if p_photo_path is null
     or left(p_photo_path, length(v_prefix)) <> v_prefix
     or length(p_photo_path) <= length(v_prefix)
     or position('/' in substr(p_photo_path, length(v_prefix) + 1)) > 0 then
    raise exception 'invalid_photo_path';
  end if;

  update public.visits set photo_path = p_photo_path
   where id = p_visit_id and photo_path is null
  returning * into v_visit;
  if not found then
    raise exception 'photo_already_set';
  end if;
  return v_visit;
end;
$$;

-- ---------------------------------------------------------------------------
-- register_push_token: upsert this device's token for the caller. A token is a
-- device, so if another user signed in on it earlier the row moves to the caller
-- (plain RLS upsert cannot do that: the old row belongs to someone else).
-- ---------------------------------------------------------------------------
create function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from public.profiles where id = v_uid) then
    raise exception 'not_authorized';
  end if;
  if coalesce(btrim(p_token), '') = '' or coalesce(btrim(p_platform), '') = '' then
    raise exception 'invalid_token';
  end if;

  insert into public.push_tokens (profile_id, token, platform)
  values (v_uid, p_token, p_platform)
  on conflict (token) do update
    set profile_id = excluded.profile_id, platform = excluded.platform;
end;
$$;

revoke execute on function
  public.set_visit_photo(uuid, text),
  public.register_push_token(text, text)
from public, anon, authenticated;

grant execute on function
  public.set_visit_photo(uuid, text),
  public.register_push_token(text, text)
to authenticated;
