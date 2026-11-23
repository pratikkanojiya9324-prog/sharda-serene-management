-- Round 3: society events with flat-level RSVPs, and society documents.
-- Writes are RPC-only (security definer).

create type public.rsvp_response as enum ('going', 'maybe', 'no');
create type public.doc_category as enum ('bylaws', 'minutes', 'circular', 'form', 'other');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  description text check (description is null or char_length(description) <= 2000),
  place text check (place is null or char_length(place) <= 120),
  starts_at timestamptz not null,
  ends_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check (ends_at is null or ends_at > starts_at)
);
create index events_society_idx on public.events (society_id, starts_at desc);

create table public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  flat_id uuid not null,
  society_id uuid not null references public.societies(id) on delete cascade,
  response public.rsvp_response not null,
  heads int not null check (heads between 0 and 20),
  by_name text,
  updated_at timestamptz not null default now(),
  primary key (event_id, flat_id),
  constraint event_rsvps_flat_same_society
    foreign key (flat_id, society_id) references public.flats (id, society_id) on delete cascade
);
create index event_rsvps_flat_idx on public.event_rsvps (flat_id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  category public.doc_category not null default 'other',
  file_path text not null,
  file_kind text not null check (file_kind in ('pdf', 'image')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index documents_society_idx on public.documents (society_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.documents enable row level security;

revoke all on public.events, public.event_rsvps, public.documents from anon;
revoke insert, update, delete on public.events, public.event_rsvps, public.documents from authenticated;

create policy events_select on public.events for select to authenticated
  using (public.is_member(society_id));

create policy event_rsvps_select on public.event_rsvps for select to authenticated
  using (public.has_role(society_id, 'admin') or public.is_flat_resident(flat_id));

create policy documents_select on public.documents for select to authenticated
  using (public.is_member(society_id));

-- ---------------------------------------------------------------------------
-- Storage: private society-docs bucket (CASE-guarded uuid cast, as in 0009)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, allowed_mime_types)
values ('society-docs', 'society-docs', false,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy society_docs_admin_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'society-docs'
  and case
    when (storage.foldername(objects.name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_role(((storage.foldername(objects.name))[1])::uuid, 'admin')
    else false
  end
);

create policy society_docs_admin_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'society-docs'
  and case
    when (storage.foldername(objects.name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_role(((storage.foldername(objects.name))[1])::uuid, 'admin')
    else false
  end
);

create policy society_docs_member_select on storage.objects
for select to authenticated
using (
  bucket_id = 'society-docs'
  and case
    when (storage.foldername(objects.name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_member(((storage.foldername(objects.name))[1])::uuid)
    else false
  end
);

-- ---------------------------------------------------------------------------
-- Event RPCs
-- ---------------------------------------------------------------------------
create function public.create_event(
  p_title text, p_description text, p_place text,
  p_starts_at timestamptz, p_ends_at timestamptz
) returns public.events
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid := public.admin_society();
  v_title text := btrim(p_title);
  v_description text := nullif(btrim(p_description), '');
  v_place text := nullif(btrim(p_place), '');
  v_row public.events;
begin
  if v_society is null then
    raise exception 'not_authorized';
  end if;
  if v_title is null or char_length(v_title) < 1 or char_length(v_title) > 120 then
    raise exception 'invalid_title';
  end if;
  if p_starts_at is null or p_starts_at <= now()
     or (p_ends_at is not null and p_ends_at <= p_starts_at) then
    raise exception 'invalid_time';
  end if;
  if (v_description is not null and char_length(v_description) > 2000)
     or (v_place is not null and char_length(v_place) > 120) then
    raise exception 'invalid_note';
  end if;
  insert into public.events (society_id, title, description, place, starts_at, ends_at, created_by)
  values (v_society, v_title, v_description, v_place, p_starts_at, p_ends_at, auth.uid())
  returning * into v_row;
  return v_row;
end;
$$;

create function public.cancel_event(p_id uuid)
returns public.events
language plpgsql security definer set search_path = ''
as $$
declare
  v_row public.events;
begin
  select * into v_row from public.events where id = p_id for update;
  if not found or not public.has_role(v_row.society_id, 'admin') then
    raise exception 'not_authorized';
  end if;
  if v_row.cancelled_at is null then
    update public.events set cancelled_at = now() where id = p_id returning * into v_row;
  end if;
  return v_row;
end;
$$;

create function public.rsvp_event(
  p_event_id uuid, p_flat_id uuid, p_response public.rsvp_response,
  p_heads int default 1, p_actor_name text default null
) returns public.event_rsvps
language plpgsql security definer set search_path = ''
as $$
declare
  v_ev public.events;
  v_flat_society uuid;
  v_name text;
  v_heads int;
  v_row public.event_rsvps;
begin
  select * into v_ev from public.events where id = p_event_id;
  select society_id into v_flat_society from public.flats where id = p_flat_id;
  if v_ev.id is null or v_flat_society is null or v_flat_society <> v_ev.society_id
     or p_response is null or not public.is_flat_resident(p_flat_id) then
    raise exception 'not_authorized';
  end if;
  v_name := public.clean_actor_name(p_actor_name);

  if v_ev.cancelled_at is not null or v_ev.starts_at <= now() then
    raise exception 'event_over';
  end if;
  if p_response = 'no' then
    v_heads := 0;
  else
    if p_heads is null or p_heads < 1 or p_heads > 20 then
      raise exception 'invalid_heads';
    end if;
    v_heads := p_heads;
  end if;

  insert into public.event_rsvps (event_id, flat_id, society_id, response, heads, by_name, updated_at)
  values (v_ev.id, p_flat_id, v_ev.society_id, p_response, v_heads, v_name, now())
  on conflict (event_id, flat_id) do update
    set response = excluded.response, heads = excluded.heads,
        by_name = excluded.by_name, updated_at = now()
  returning * into v_row;
  return v_row;
end;
$$;

create function public.event_summary(p_event_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_society uuid;
  v_list jsonb := null;
  v_out jsonb;
begin
  select society_id into v_society from public.events where id = p_event_id;
  if v_society is null or not public.is_member(v_society) then
    raise exception 'not_authorized';
  end if;

  if public.has_role(v_society, 'admin') then
    select coalesce(jsonb_agg(jsonb_build_object(
             'flat_label',
             coalesce('B' || substring(t.building from '(\d+)\s*$'), t.building)
               || '-' || t.name || '-' || f.number,
             'response', r.response, 'heads', r.heads, 'by_name', r.by_name
           ) order by t.building, t.name, f.number), '[]'::jsonb)
      into v_list
      from public.event_rsvps r
      join public.flats f on f.id = r.flat_id
      join public.towers t on t.id = f.tower_id
     where r.event_id = p_event_id;
  end if;

  select jsonb_build_object(
           'going_flats', count(*) filter (where response = 'going'),
           'going_heads', coalesce(sum(heads) filter (where response = 'going'), 0),
           'maybe_flats', count(*) filter (where response = 'maybe'),
           'maybe_heads', coalesce(sum(heads) filter (where response = 'maybe'), 0),
           'no_flats', count(*) filter (where response = 'no'),
           'rsvps', v_list)
    into v_out
    from public.event_rsvps
   where event_id = p_event_id;
  return v_out;
end;
$$;

-- ---------------------------------------------------------------------------
-- Document RPCs (admin)
-- ---------------------------------------------------------------------------
create function public.add_document(
  p_title text, p_category public.doc_category, p_file_path text, p_file_kind text
) returns public.documents
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid := public.admin_society();
  v_title text := btrim(p_title);
  v_row public.documents;
begin
  if v_society is null then
    raise exception 'not_authorized';
  end if;
  if v_title is null or char_length(v_title) < 1 or char_length(v_title) > 120 then
    raise exception 'invalid_title';
  end if;
  if p_file_kind is null or p_file_kind not in ('pdf', 'image')
     or p_file_path is null or p_file_path not like v_society::text || '/_%' then
    raise exception 'invalid_file';
  end if;
  insert into public.documents (society_id, title, category, file_path, file_kind, created_by)
  values (v_society, v_title, coalesce(p_category, 'other'), p_file_path, p_file_kind, auth.uid())
  returning * into v_row;
  return v_row;
end;
$$;

create function public.delete_document(p_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid := public.admin_society();
  v_path text;
begin
  if v_society is null then
    raise exception 'not_authorized';
  end if;
  delete from public.documents where id = p_id and society_id = v_society
  returning file_path into v_path;
  if v_path is null then
    raise exception 'not_authorized';
  end if;
  return v_path;
end;
$$;

revoke execute on function
  public.create_event(text, text, text, timestamptz, timestamptz),
  public.cancel_event(uuid),
  public.rsvp_event(uuid, uuid, public.rsvp_response, int, text),
  public.event_summary(uuid),
  public.add_document(text, public.doc_category, text, text),
  public.delete_document(uuid)
from public, anon, authenticated;

grant execute on function
  public.create_event(text, text, text, timestamptz, timestamptz),
  public.cancel_event(uuid),
  public.rsvp_event(uuid, uuid, public.rsvp_response, int, text),
  public.event_summary(uuid),
  public.add_document(text, public.doc_category, text, text),
  public.delete_document(uuid)
to authenticated;
