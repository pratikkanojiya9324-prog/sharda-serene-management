-- Society Gate: tenant consistency, row-level security, invite claiming

-- ---------------------------------------------------------------------------
-- Tenant consistency: a child row's flat/tower must belong to the row's society
-- ---------------------------------------------------------------------------
alter table towers add constraint towers_id_society_key unique (id, society_id);
alter table flats  add constraint flats_id_society_key  unique (id, society_id);

alter table flats
  add constraint flats_tower_same_society
  foreign key (tower_id, society_id) references towers (id, society_id) on delete cascade;
alter table visits
  add constraint visits_flat_same_society
  foreign key (flat_id, society_id) references flats (id, society_id) on delete cascade;
alter table passes
  add constraint passes_flat_same_society
  foreign key (flat_id, society_id) references flats (id, society_id) on delete cascade;
-- invites.flat_id is nullable; MATCH SIMPLE skips the check when it is null
alter table invites
  add constraint invites_flat_same_society
  foreign key (flat_id, society_id) references flats (id, society_id) on delete cascade;

create index flat_residents_profile_idx on flat_residents (profile_id);
create index invites_phone_idx on invites (phone);

-- ---------------------------------------------------------------------------
-- Helpers (security definer so policies can read memberships without recursion;
-- empty search_path + qualified names prevents search_path hijacking)
-- ---------------------------------------------------------------------------
create function public.has_role(p_society uuid, p_role public.member_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.profile_id = auth.uid() and m.society_id = p_society and m.role = p_role
  );
$$;

create function public.is_member(p_society uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.profile_id = auth.uid() and m.society_id = p_society
  );
$$;

-- Resident of the flat AND still holding a resident membership in its society,
-- so removing the membership revokes flat access even if the link row remains.
create function public.is_flat_resident(p_flat uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.flat_residents fr
    join public.flats f on f.id = fr.flat_id
    join public.memberships m
      on m.profile_id = fr.profile_id and m.society_id = f.society_id and m.role = 'resident'
    where fr.flat_id = p_flat and fr.profile_id = auth.uid()
  );
$$;

-- Caller's role in the society owning a flat (used by flat_residents policy).
create function public.has_role_for_flat(p_flat uuid, p_role public.member_role)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.flats f
    join public.memberships m on m.society_id = f.society_id
    where f.id = p_flat and m.profile_id = auth.uid() and m.role = p_role
  );
$$;

-- True when the caller and p_profile are members of at least one common society.
create function public.shares_society(p_profile uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships mine
    join public.memberships theirs on theirs.society_id = mine.society_id
    where mine.profile_id = auth.uid() and theirs.profile_id = p_profile
  );
$$;

-- ---------------------------------------------------------------------------
-- claim_invites: first OTP login turns pending invites for the caller's phone
-- into memberships (+ flat link for residents). Returns number claimed.
-- ---------------------------------------------------------------------------
create function public.claim_invites()
returns int
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_phone  text;
  v_invite public.invites%rowtype;
  v_count  int := 0;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;

  -- auth.users.phone is stored without '+'
  select '+' || ltrim(u.phone, '+') into v_phone
  from auth.users u
  where u.id = v_uid and coalesce(u.phone, '') <> '';

  if v_phone is null then
    return 0;
  end if;

  for v_invite in
    select * from public.invites i
    where i.phone = v_phone and i.claimed_at is null
    order by i.created_at
    for update
  loop
    -- profile is created only for invited users (no self-signup); name from first invite
    insert into public.profiles (id, name, phone)
    values (v_uid, v_invite.name, v_phone)
    on conflict (id) do nothing;

    insert into public.memberships (profile_id, society_id, role)
    values (v_uid, v_invite.society_id, v_invite.role)
    on conflict (profile_id, society_id, role) do nothing;

    if v_invite.role = 'resident' then
      insert into public.flat_residents (flat_id, profile_id, added_by)
      values (v_invite.flat_id, v_uid, v_invite.created_by)
      on conflict (flat_id, profile_id) do nothing;
    end if;

    update public.invites set claimed_at = now() where id = v_invite.id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function
  public.has_role(uuid, public.member_role),
  public.is_member(uuid),
  public.is_flat_resident(uuid),
  public.has_role_for_flat(uuid, public.member_role),
  public.shares_society(uuid),
  public.claim_invites()
from public, anon;

grant execute on function
  public.has_role(uuid, public.member_role),
  public.is_member(uuid),
  public.is_flat_resident(uuid),
  public.has_role_for_flat(uuid, public.member_role),
  public.shares_society(uuid),
  public.claim_invites()
to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere (no policy = no access)
-- ---------------------------------------------------------------------------
alter table societies      enable row level security;
alter table towers         enable row level security;
alter table flats          enable row level security;
alter table profiles       enable row level security;
alter table memberships    enable row level security;
alter table flat_residents enable row level security;
alter table invites        enable row level security;
alter table passes         enable row level security;
alter table visits         enable row level security;
alter table push_tokens    enable row level security;

-- societies -----------------------------------------------------------------
-- No insert policy: societies are created by the operator (service role / seed).
create policy societies_select on societies for select to authenticated
  using (public.is_member(id));
create policy societies_update on societies for update to authenticated
  using (public.has_role(id, 'admin')) with check (public.has_role(id, 'admin'));
create policy societies_delete on societies for delete to authenticated
  using (public.has_role(id, 'admin'));

-- towers --------------------------------------------------------------------
create policy towers_select on towers for select to authenticated
  using (public.is_member(society_id));
create policy towers_insert on towers for insert to authenticated
  with check (public.has_role(society_id, 'admin'));
create policy towers_update on towers for update to authenticated
  using (public.has_role(society_id, 'admin')) with check (public.has_role(society_id, 'admin'));
create policy towers_delete on towers for delete to authenticated
  using (public.has_role(society_id, 'admin'));

-- flats ---------------------------------------------------------------------
create policy flats_select on flats for select to authenticated
  using (public.is_member(society_id));
create policy flats_insert on flats for insert to authenticated
  with check (public.has_role(society_id, 'admin'));
create policy flats_update on flats for update to authenticated
  using (public.has_role(society_id, 'admin')) with check (public.has_role(society_id, 'admin'));
create policy flats_delete on flats for delete to authenticated
  using (public.has_role(society_id, 'admin'));

-- profiles ------------------------------------------------------------------
-- Rows are created by claim_invites. Users may change only their own name.
create policy profiles_select on profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_society(id));
create policy profiles_update on profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, update, delete on profiles from authenticated, anon;
grant update (name) on profiles to authenticated;

-- memberships ---------------------------------------------------------------
-- Created by claim_invites; admins can view and remove them in their society.
create policy memberships_select on memberships for select to authenticated
  using (profile_id = (select auth.uid()) or public.has_role(society_id, 'admin'));
create policy memberships_delete on memberships for delete to authenticated
  using (public.has_role(society_id, 'admin'));

-- flat_residents ------------------------------------------------------------
create policy flat_residents_select on flat_residents for select to authenticated
  using (
    public.has_role_for_flat(flat_id, 'admin')
    or public.has_role_for_flat(flat_id, 'guard')
    or public.is_flat_resident(flat_id)
  );
create policy flat_residents_delete on flat_residents for delete to authenticated
  using (public.has_role_for_flat(flat_id, 'admin'));

-- invites -------------------------------------------------------------------
-- Residents add household members via add_household_member RPC (Task 5).
create policy invites_select on invites for select to authenticated
  using (public.has_role(society_id, 'admin'));
create policy invites_insert on invites for insert to authenticated
  with check (public.has_role(society_id, 'admin'));
create policy invites_update on invites for update to authenticated
  using (public.has_role(society_id, 'admin')) with check (public.has_role(society_id, 'admin'));
create policy invites_delete on invites for delete to authenticated
  using (public.has_role(society_id, 'admin'));

-- visits: read-only to clients; all writes go through RPCs (Task 4/5) -------
create policy visits_select on visits for select to authenticated
  using (
    public.has_role(society_id, 'admin')
    or public.has_role(society_id, 'guard')
    or public.is_flat_resident(flat_id)
  );
revoke insert, update, delete on visits from authenticated, anon;

-- passes: guards read none (they use use_pass); writes via RPCs (Task 5) ----
create policy passes_select on passes for select to authenticated
  using (public.is_flat_resident(flat_id) or public.has_role(society_id, 'admin'));
revoke insert, update, delete on passes from authenticated, anon;

-- push_tokens: owner only (update allowed so the app can upsert its token) --
create policy push_tokens_select on push_tokens for select to authenticated
  using (profile_id = (select auth.uid()));
create policy push_tokens_insert on push_tokens for insert to authenticated
  with check (profile_id = (select auth.uid()));
create policy push_tokens_update on push_tokens for update to authenticated
  using (profile_id = (select auth.uid())) with check (profile_id = (select auth.uid()));
create policy push_tokens_delete on push_tokens for delete to authenticated
  using (profile_id = (select auth.uid()));
