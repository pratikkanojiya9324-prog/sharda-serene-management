-- Round 1: notices, complaints (with comments) and track-only bills.
-- All writes are RPC-only (security definer); clients get RLS-filtered reads.

alter table public.societies add column short_code text not null default 'SS';

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.complaint_category as enum
  ('plumbing', 'electrical', 'lift', 'cleaning', 'security', 'parking', 'other');
create type public.complaint_status as enum ('open', 'in_progress', 'resolved');
create type public.bill_status as enum ('unpaid', 'paid');
create type public.payment_mode as enum ('cash', 'cheque', 'upi', 'other');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.notices (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  title text not null,
  body text not null,
  attachment_path text,
  attachment_kind text check (attachment_kind in ('image', 'pdf')),
  pinned boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint notices_attachment_pair check ((attachment_path is null) = (attachment_kind is null))
);
create index notices_society_idx on public.notices (society_id, pinned desc, created_at desc);

create table public.complaints (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  flat_id uuid not null,
  category public.complaint_category not null,
  description text not null,
  photo_path text,
  status public.complaint_status not null default 'open',
  created_by uuid references public.profiles(id) on delete set null,
  created_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint complaints_flat_same_society
    foreign key (flat_id, society_id) references public.flats (id, society_id) on delete cascade,
  constraint complaints_id_society_key unique (id, society_id)
);
create index complaints_flat_idx on public.complaints (flat_id, created_at desc);
create index complaints_society_idx on public.complaints (society_id, status, created_at desc);

create table public.complaint_comments (
  id uuid primary key default gen_random_uuid(),
  complaint_id uuid not null,
  society_id uuid not null references public.societies(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  author_name text,
  body text not null,
  created_at timestamptz not null default now(),
  constraint complaint_comments_complaint_same_society
    foreign key (complaint_id, society_id) references public.complaints (id, society_id) on delete cascade
);
create index complaint_comments_complaint_idx on public.complaint_comments (complaint_id, created_at);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  society_id uuid not null references public.societies(id) on delete cascade,
  flat_id uuid not null,
  period date not null check (period = date_trunc('month', period)::date),
  amount numeric(10,2) not null check (amount > 0),
  due_date date not null,
  status public.bill_status not null default 'unpaid',
  paid_at timestamptz,
  payment_mode public.payment_mode,
  payment_reference text,
  receipt_no text,
  created_at timestamptz not null default now(),
  constraint bills_flat_same_society
    foreign key (flat_id, society_id) references public.flats (id, society_id) on delete cascade,
  constraint bills_flat_period_key unique (flat_id, period),
  constraint bills_receipt_key unique (society_id, receipt_no)
);
create index bills_society_period_idx on public.bills (society_id, period desc);

create table public.receipt_counters (
  society_id uuid not null references public.societies(id) on delete cascade,
  month date not null,
  last int not null default 0,
  primary key (society_id, month)
);

-- ---------------------------------------------------------------------------
-- RLS: reads only; writes via RPC
-- ---------------------------------------------------------------------------
alter table public.notices enable row level security;
alter table public.complaints enable row level security;
alter table public.complaint_comments enable row level security;
alter table public.bills enable row level security;
alter table public.receipt_counters enable row level security;

revoke all on public.notices, public.complaints, public.complaint_comments,
  public.bills, public.receipt_counters from anon;
revoke insert, update, delete on public.notices, public.complaints, public.complaint_comments,
  public.bills from authenticated;
revoke all on public.receipt_counters from authenticated;

create policy notices_select on public.notices for select to authenticated
  using (public.is_member(society_id));

create policy complaints_select on public.complaints for select to authenticated
  using (public.has_role(society_id, 'admin') or public.is_flat_resident(flat_id));

create policy complaint_comments_select on public.complaint_comments for select to authenticated
  using (
    public.has_role(society_id, 'admin')
    or exists (
      select 1 from public.complaints c
      where c.id = complaint_id and public.is_flat_resident(c.flat_id)
    )
  );

create policy bills_select on public.bills for select to authenticated
  using (public.has_role(society_id, 'admin') or public.is_flat_resident(flat_id));

-- receipt_counters: no policies, no grants (internal to mark_bill_paid)

-- ---------------------------------------------------------------------------
-- Storage buckets and policies (CASE-guarded uuid cast, as in 0009)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('notices', 'notices', false), ('complaint-photos', 'complaint-photos', false)
on conflict (id) do nothing;

create policy notices_admin_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'notices'
  and case
    when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_role(((storage.foldername(name))[1])::uuid, 'admin')
    else false
  end
);

create policy notices_member_select on storage.objects
for select to authenticated
using (
  bucket_id = 'notices'
  and case
    when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_member(((storage.foldername(name))[1])::uuid)
    else false
  end
);

-- Complaint photos live under {society_id}/{flat_id}/...: only that flat's
-- residents (and admins, for reads) may touch them.
create policy complaint_photos_flat_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'complaint-photos'
  and case
    when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.is_flat_resident(((storage.foldername(name))[2])::uuid)
       and exists (
         select 1 from public.flats f
         where f.id = ((storage.foldername(name))[2])::uuid
           and f.society_id = ((storage.foldername(name))[1])::uuid
       )
    else false
  end
);

create policy complaint_photos_select on storage.objects
for select to authenticated
using (
  bucket_id = 'complaint-photos'
  and case
    when (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.has_role(((storage.foldername(name))[1])::uuid, 'admin')
       or ((storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           and public.is_flat_resident(((storage.foldername(name))[2])::uuid))
    else false
  end
);

-- ---------------------------------------------------------------------------
-- Internal helper: the society the caller administers (null if none)
-- ---------------------------------------------------------------------------
create function public.admin_society()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select m.society_id from public.memberships m
  where m.profile_id = auth.uid() and m.role = 'admin'
  order by m.society_id
  limit 1;
$$;
revoke execute on function public.admin_society() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Notices
-- ---------------------------------------------------------------------------
create function public.create_notice(
  p_title text, p_body text, p_attachment_path text default null,
  p_attachment_kind text default null, p_pinned boolean default false
) returns public.notices
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid := public.admin_society();
  v_notice public.notices;
begin
  if v_society is null then
    raise exception 'not_authorized';
  end if;
  if p_title is null or btrim(p_title) = '' then
    raise exception 'invalid_title';
  end if;
  if p_body is null or btrim(p_body) = '' then
    raise exception 'invalid_body';
  end if;
  if (p_attachment_path is null) <> (p_attachment_kind is null)
     or (p_attachment_kind is not null and p_attachment_kind not in ('image', 'pdf'))
     or (p_attachment_path is not null and p_attachment_path not like v_society::text || '/%') then
    raise exception 'invalid_attachment';
  end if;
  insert into public.notices (society_id, title, body, attachment_path, attachment_kind, pinned, created_by)
  values (v_society, btrim(p_title), btrim(p_body), p_attachment_path, p_attachment_kind,
          coalesce(p_pinned, false), auth.uid())
  returning * into v_notice;
  return v_notice;
end;
$$;
revoke execute on function public.create_notice(text, text, text, text, boolean) from public, anon, authenticated;
grant execute on function public.create_notice(text, text, text, text, boolean) to authenticated;

create function public.set_notice_pinned(p_id uuid, p_pinned boolean)
returns public.notices
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid;
  v_notice public.notices;
begin
  select society_id into v_society from public.notices where id = p_id;
  if v_society is null or not public.has_role(v_society, 'admin') then
    raise exception 'not_authorized';
  end if;
  update public.notices set pinned = coalesce(p_pinned, false) where id = p_id
  returning * into v_notice;
  return v_notice;
end;
$$;
revoke execute on function public.set_notice_pinned(uuid, boolean) from public, anon, authenticated;
grant execute on function public.set_notice_pinned(uuid, boolean) to authenticated;

create function public.delete_notice(p_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid;
begin
  select society_id into v_society from public.notices where id = p_id;
  if v_society is null or not public.has_role(v_society, 'admin') then
    raise exception 'not_authorized';
  end if;
  delete from public.notices where id = p_id;
end;
$$;
revoke execute on function public.delete_notice(uuid) from public, anon, authenticated;
grant execute on function public.delete_notice(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Complaints
-- ---------------------------------------------------------------------------
create function public.create_complaint(
  p_flat_id uuid, p_category public.complaint_category, p_description text,
  p_photo_path text default null, p_actor_name text default null
) returns public.complaints
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid;
  v_name text;
  v_complaint public.complaints;
begin
  select society_id into v_society from public.flats where id = p_flat_id;
  if v_society is null or not public.is_flat_resident(p_flat_id) then
    raise exception 'not_authorized';
  end if;
  if p_category is null then
    raise exception 'invalid_category';
  end if;
  if p_description is null or btrim(p_description) = '' then
    raise exception 'invalid_description';
  end if;
  if p_photo_path is not null and p_photo_path not like v_society::text || '/' || p_flat_id::text || '/%' then
    raise exception 'invalid_photo_path';
  end if;
  v_name := public.clean_actor_name(p_actor_name);
  insert into public.complaints (society_id, flat_id, category, description, photo_path, created_by, created_by_name)
  values (v_society, p_flat_id, p_category, btrim(p_description), p_photo_path, auth.uid(), v_name)
  returning * into v_complaint;
  return v_complaint;
end;
$$;
revoke execute on function public.create_complaint(uuid, public.complaint_category, text, text, text) from public, anon, authenticated;
grant execute on function public.create_complaint(uuid, public.complaint_category, text, text, text) to authenticated;

create function public.add_complaint_comment(
  p_complaint_id uuid, p_body text, p_actor_name text default null
) returns public.complaint_comments
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid;
  v_flat uuid;
  v_name text;
  v_comment public.complaint_comments;
begin
  select society_id, flat_id into v_society, v_flat from public.complaints where id = p_complaint_id;
  if v_society is null
     or not (public.has_role(v_society, 'admin') or public.is_flat_resident(v_flat)) then
    raise exception 'not_authorized';
  end if;
  if p_body is null or btrim(p_body) = '' then
    raise exception 'invalid_body';
  end if;
  v_name := public.clean_actor_name(p_actor_name);
  insert into public.complaint_comments (complaint_id, society_id, author_id, author_name, body)
  values (p_complaint_id, v_society, auth.uid(), v_name, btrim(p_body))
  returning * into v_comment;
  return v_comment;
end;
$$;
revoke execute on function public.add_complaint_comment(uuid, text, text) from public, anon, authenticated;
grant execute on function public.add_complaint_comment(uuid, text, text) to authenticated;

create function public.set_complaint_status(p_complaint_id uuid, p_status public.complaint_status)
returns public.complaints
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid;
  v_complaint public.complaints;
begin
  select society_id into v_society from public.complaints where id = p_complaint_id;
  if v_society is null or not public.has_role(v_society, 'admin') then
    raise exception 'not_authorized';
  end if;
  if p_status is null then
    raise exception 'invalid_status';
  end if;
  update public.complaints set status = p_status, updated_at = clock_timestamp()
  where id = p_complaint_id
  returning * into v_complaint;
  return v_complaint;
end;
$$;
revoke execute on function public.set_complaint_status(uuid, public.complaint_status) from public, anon, authenticated;
grant execute on function public.set_complaint_status(uuid, public.complaint_status) to authenticated;

-- ---------------------------------------------------------------------------
-- Bills (track-only)
-- ---------------------------------------------------------------------------
create function public.generate_bills(p_period date, p_amount numeric, p_due_date date)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid := public.admin_society();
  v_count int;
begin
  if v_society is null then
    raise exception 'not_authorized';
  end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'invalid_period';
  end if;
  if p_amount is null or p_amount <= 0 or p_amount >= 100000000 then
    raise exception 'invalid_amount';
  end if;
  if p_due_date is null then
    raise exception 'invalid_due_date';
  end if;
  insert into public.bills (society_id, flat_id, period, amount, due_date)
  select v_society, f.id, p_period, round(p_amount, 2), p_due_date
  from public.flats f
  where f.society_id = v_society
  on conflict (flat_id, period) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke execute on function public.generate_bills(date, numeric, date) from public, anon, authenticated;
grant execute on function public.generate_bills(date, numeric, date) to authenticated;

create function public.generate_bills_custom(p_period date, p_due_date date, p_rows jsonb)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid := public.admin_society();
  v_row jsonb;
  v_flat uuid;
  v_amount numeric;
  v_count int := 0;
  v_inserted int;
begin
  if v_society is null then
    raise exception 'not_authorized';
  end if;
  if p_period is null or p_period <> date_trunc('month', p_period)::date then
    raise exception 'invalid_period';
  end if;
  if p_due_date is null then
    raise exception 'invalid_due_date';
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'invalid_rows';
  end if;
  for v_row in select * from jsonb_array_elements(p_rows) loop
    begin
      v_flat := (v_row ->> 'flat_id')::uuid;
      v_amount := (v_row ->> 'amount')::numeric;
    exception when others then
      raise exception 'invalid_rows';
    end;
    if v_amount is null or v_amount <= 0 or v_amount >= 100000000 then
      raise exception 'invalid_amount';
    end if;
    if not exists (select 1 from public.flats where id = v_flat and society_id = v_society) then
      raise exception 'not_authorized';
    end if;
    insert into public.bills (society_id, flat_id, period, amount, due_date)
    values (v_society, v_flat, p_period, round(v_amount, 2), p_due_date)
    on conflict (flat_id, period) do nothing;
    get diagnostics v_inserted = row_count;
    v_count := v_count + v_inserted;
  end loop;
  return v_count;
end;
$$;
revoke execute on function public.generate_bills_custom(date, date, jsonb) from public, anon, authenticated;
grant execute on function public.generate_bills_custom(date, date, jsonb) to authenticated;

create function public.mark_bill_paid(p_bill_id uuid, p_mode public.payment_mode, p_reference text default null)
returns public.bills
language plpgsql security definer set search_path = ''
as $$
declare
  v_society uuid;
  v_status public.bill_status;
  v_month date := date_trunc('month', now() at time zone 'Asia/Kolkata')::date;
  v_code text;
  v_last int;
  v_bill public.bills;
begin
  select society_id into v_society from public.bills where id = p_bill_id;
  if v_society is null or not public.has_role(v_society, 'admin') then
    raise exception 'not_authorized';
  end if;
  if p_mode is null then
    raise exception 'invalid_payment_mode';
  end if;

  -- Lock the bill so concurrent payments of the same bill serialize.
  select status into v_status from public.bills where id = p_bill_id for update;
  if v_status = 'paid' then
    raise exception 'already_paid';
  end if;

  insert into public.receipt_counters (society_id, month, last)
  values (v_society, v_month, 0)
  on conflict (society_id, month) do nothing;
  select last into v_last from public.receipt_counters
  where society_id = v_society and month = v_month for update;
  v_last := v_last + 1;
  update public.receipt_counters set last = v_last
  where society_id = v_society and month = v_month;

  select short_code into v_code from public.societies where id = v_society;
  update public.bills
     set status = 'paid', paid_at = now(), payment_mode = p_mode,
         payment_reference = nullif(btrim(p_reference), ''),
         receipt_no = v_code || '-' || to_char(v_month, 'YYYY-MM') || '-' || lpad(v_last::text, 4, '0')
   where id = p_bill_id
  returning * into v_bill;
  return v_bill;
end;
$$;
revoke execute on function public.mark_bill_paid(uuid, public.payment_mode, text) from public, anon, authenticated;
grant execute on function public.mark_bill_paid(uuid, public.payment_mode, text) to authenticated;
