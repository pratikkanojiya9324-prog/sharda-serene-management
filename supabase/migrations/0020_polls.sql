-- Round 3: secret one-vote-per-flat polls. Writes are RPC-only (security definer).
-- Choices are readable only by the voting flat; everyone else gets aggregates
-- through poll_results().

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.polls (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  question text not null check (char_length(question) between 1 and 200),
  description text check (description is null or char_length(description) <= 1000),
  options jsonb not null,
  multi boolean not null default false,
  max_choices int not null default 1 check (max_choices >= 1),
  closes_at timestamptz not null,
  closed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  last_reminded_at timestamptz
);
create index polls_society_idx on public.polls (society_id, created_at desc);

create table public.poll_votes (
  poll_id uuid not null references public.polls(id) on delete cascade,
  flat_id uuid not null,
  society_id uuid not null references public.societies(id) on delete cascade,
  option_ids uuid[] not null,
  voted_by_name text,
  voted_at timestamptz not null default now(),
  primary key (poll_id, flat_id),
  constraint poll_votes_flat_same_society
    foreign key (flat_id, society_id) references public.flats (id, society_id) on delete cascade
);

-- ---------------------------------------------------------------------------
-- RLS: polls readable by members; votes readable only by the voting flat
-- ---------------------------------------------------------------------------
alter table public.polls enable row level security;
alter table public.poll_votes enable row level security;

revoke all on public.polls, public.poll_votes from anon;
revoke insert, update, delete on public.polls, public.poll_votes from authenticated;

create policy polls_select on public.polls for select to authenticated
  using (public.is_member(society_id));

create policy poll_votes_select on public.poll_votes for select to authenticated
  using (public.is_flat_resident(flat_id));

-- ---------------------------------------------------------------------------
-- Admin RPCs
-- ---------------------------------------------------------------------------
create function public.create_poll(
  p_question text, p_description text, p_options text[], p_multi boolean,
  p_max_choices int, p_closes_at timestamptz
) returns public.polls
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid := public.admin_society();
  v_question text := btrim(p_question);
  v_description text := nullif(btrim(p_description), '');
  v_labels text[];
  v_count int;
  v_multi boolean := coalesce(p_multi, false);
  v_max int;
  v_options jsonb;
  v_row public.polls;
begin
  if v_society is null then
    raise exception 'not_authorized';
  end if;
  if v_question is null or char_length(v_question) < 1 or char_length(v_question) > 200
     or (v_description is not null and char_length(v_description) > 1000) then
    raise exception 'invalid_question';
  end if;

  select coalesce(array_agg(btrim(o) order by ord), '{}') into v_labels
    from unnest(p_options) with ordinality as t(o, ord);
  v_count := cardinality(v_labels);
  if v_count < 2 or v_count > 6
     or exists (
       select 1 from unnest(v_labels) l where l is null or char_length(l) < 1 or char_length(l) > 80
     ) then
    raise exception 'invalid_options';
  end if;

  if v_multi then
    if p_max_choices is null or p_max_choices < 1 or p_max_choices > v_count then
      raise exception 'invalid_choice';
    end if;
    v_max := p_max_choices;
  else
    v_max := 1;
  end if;

  if p_closes_at is null or p_closes_at <= now() or p_closes_at > now() + interval '90 days' then
    raise exception 'invalid_time';
  end if;

  select jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'label', l) order by ord)
    into v_options
    from unnest(v_labels) with ordinality as t(l, ord);

  insert into public.polls
    (society_id, question, description, options, multi, max_choices, closes_at, created_by)
  values
    (v_society, v_question, v_description, v_options, v_multi, v_max, p_closes_at, auth.uid())
  returning * into v_row;
  return v_row;
end;
$$;

create function public.close_poll(p_poll_id uuid)
returns public.polls
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.polls;
begin
  select * into v_row from public.polls where id = p_poll_id for update;
  if not found or not public.has_role(v_row.society_id, 'admin') then
    raise exception 'not_authorized';
  end if;
  if v_row.closed_at is not null or now() >= v_row.closes_at then
    raise exception 'poll_closed';
  end if;
  update public.polls set closed_at = now() where id = p_poll_id returning * into v_row;
  return v_row;
end;
$$;

create function public.delete_poll(p_poll_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid;
begin
  select society_id into v_society from public.polls where id = p_poll_id;
  if v_society is null or not public.has_role(v_society, 'admin') then
    raise exception 'not_authorized';
  end if;
  delete from public.polls where id = p_poll_id;
end;
$$;

create function public.remind_poll(p_poll_id uuid)
returns public.polls
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.polls;
begin
  select * into v_row from public.polls where id = p_poll_id for update;
  if not found or not public.has_role(v_row.society_id, 'admin') then
    raise exception 'not_authorized';
  end if;
  if v_row.closed_at is not null or now() >= v_row.closes_at then
    raise exception 'poll_closed';
  end if;
  if v_row.last_reminded_at is not null and v_row.last_reminded_at > now() - interval '6 hours' then
    raise exception 'remind_too_soon';
  end if;
  update public.polls set last_reminded_at = now() where id = p_poll_id returning * into v_row;
  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------
-- Resident RPC: one vote per flat, final, secret
-- ---------------------------------------------------------------------------
create function public.vote_poll(
  p_poll_id uuid, p_flat_id uuid, p_option_ids uuid[], p_actor_name text default null
) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_poll public.polls;
  v_flat_society uuid;
  v_valid uuid[];
  v_name text;
begin
  select * into v_poll from public.polls where id = p_poll_id;
  select society_id into v_flat_society from public.flats where id = p_flat_id;
  if v_poll.id is null or v_flat_society is null or v_flat_society <> v_poll.society_id
     or not public.is_flat_resident(p_flat_id) then
    raise exception 'not_authorized';
  end if;
  v_name := public.clean_actor_name(p_actor_name);
  if v_poll.closed_at is not null or now() >= v_poll.closes_at then
    raise exception 'poll_closed';
  end if;

  select coalesce(array_agg((o->>'id')::uuid), '{}') into v_valid
    from jsonb_array_elements(v_poll.options) o;
  if p_option_ids is null or cardinality(p_option_ids) < 1
     or exists (select 1 from unnest(p_option_ids) x where x is null or x <> all (v_valid))
     or (select count(distinct x) from unnest(p_option_ids) x) <> cardinality(p_option_ids) then
    raise exception 'invalid_choice';
  end if;
  if cardinality(p_option_ids) > v_poll.max_choices then
    raise exception 'too_many_choices';
  end if;

  begin
    insert into public.poll_votes (poll_id, flat_id, society_id, option_ids, voted_by_name)
    values (p_poll_id, p_flat_id, v_poll.society_id, p_option_ids, v_name);
  exception when unique_violation then
    raise exception 'already_voted';
  end;
end;
$$;

-- ---------------------------------------------------------------------------
-- Results: aggregates only; the choices of a flat are never returned to others
-- ---------------------------------------------------------------------------
create function public.poll_results(p_poll_id uuid, p_flat_id uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_poll public.polls;
  v_admin boolean;
  v_open boolean;
  v_flat_ok boolean := false;
  v_my public.poll_votes;
  v_voted_flats int;
  v_total_flats int;
  v_show_counts boolean;
  v_counts jsonb := null;
  v_not_voted jsonb := null;
begin
  select * into v_poll from public.polls where id = p_poll_id;
  if v_poll.id is null then
    raise exception 'not_authorized';
  end if;
  v_admin := public.has_role(v_poll.society_id, 'admin');
  if p_flat_id is not null then
    v_flat_ok := exists (
      select 1 from public.flats f where f.id = p_flat_id and f.society_id = v_poll.society_id
    ) and public.is_flat_resident(p_flat_id);
  end if;
  if not v_admin and not v_flat_ok then
    raise exception 'not_authorized';
  end if;

  v_open := v_poll.closed_at is null and now() < v_poll.closes_at;
  if v_flat_ok then
    select * into v_my from public.poll_votes where poll_id = p_poll_id and flat_id = p_flat_id;
  end if;
  v_show_counts := v_admin or v_my.poll_id is not null or not v_open;

  select count(*)::int into v_voted_flats from public.poll_votes where poll_id = p_poll_id;
  select count(distinct f.id)::int into v_total_flats
    from public.flats f
    join public.flat_residents fr on fr.flat_id = f.id
   where f.society_id = v_poll.society_id;

  if v_show_counts then
    select jsonb_object_agg(o->>'id', coalesce(c.n, 0)) into v_counts
      from jsonb_array_elements(v_poll.options) o
      left join (
        select x as option_id, count(*)::int as n
          from public.poll_votes v, unnest(v.option_ids) x
         where v.poll_id = p_poll_id
         group by x
      ) c on c.option_id = (o->>'id')::uuid;
  end if;

  if v_admin then
    select coalesce(jsonb_agg(label order by label), '[]'::jsonb) into v_not_voted
      from (
        select coalesce('B' || substring(t.building from '(\d+)\s*$'), t.building)
               || '-' || t.name || '-' || f.number as label
          from public.flats f
          join public.towers t on t.id = f.tower_id
         where f.society_id = v_poll.society_id
           and exists (select 1 from public.flat_residents fr where fr.flat_id = f.id)
           and not exists (
             select 1 from public.poll_votes v where v.poll_id = p_poll_id and v.flat_id = f.id
           )
      ) s;
  end if;

  return jsonb_build_object(
    'counts', v_counts,
    'voted_flats', v_voted_flats,
    'total_flats', v_total_flats,
    'my_vote', case when v_my.poll_id is null then null else jsonb_build_object(
      'option_ids', to_jsonb(v_my.option_ids),
      'voted_by_name', v_my.voted_by_name,
      'voted_at', v_my.voted_at) end,
    'not_voted', v_not_voted,
    'is_open', v_open
  );
end;
$$;

revoke execute on function
  public.create_poll(text, text, text[], boolean, int, timestamptz),
  public.close_poll(uuid),
  public.delete_poll(uuid),
  public.remind_poll(uuid),
  public.vote_poll(uuid, uuid, uuid[], text),
  public.poll_results(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  public.create_poll(text, text, text[], boolean, int, timestamptz),
  public.close_poll(uuid),
  public.delete_poll(uuid),
  public.remind_poll(uuid),
  public.vote_poll(uuid, uuid, uuid[], text),
  public.poll_results(uuid, uuid)
to authenticated;
