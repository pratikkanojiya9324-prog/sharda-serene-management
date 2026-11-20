-- claim_invites now requires a confirmed phone (OTP verified), so an invite
-- cannot be claimed by someone who merely typed the invited number.
create or replace function public.claim_invites()
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
  where u.id = v_uid and coalesce(u.phone, '') <> ''
    and u.phone_confirmed_at is not null;  -- phone ownership must be proven by OTP

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

revoke execute on function public.claim_invites() from public, anon;
grant execute on function public.claim_invites() to authenticated;
