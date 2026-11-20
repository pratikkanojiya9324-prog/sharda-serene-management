-- Society Gate: core schema (tables, enums, constraints, indexes only; RLS comes later)

create type member_role as enum ('admin', 'guard', 'resident');
create type visit_purpose as enum ('delivery', 'guest', 'cab', 'service', 'other');
create type visit_status as enum ('pending', 'approved', 'denied', 'leave_at_gate', 'expired');
create type manual_outcome as enum ('allowed', 'sent_back');

create table societies (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  address text
);

create table towers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  society_id uuid not null references societies(id) on delete cascade,
  name text not null,
  unique (society_id, name)
);

create table flats (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  society_id uuid not null references societies(id) on delete cascade,
  tower_id uuid not null references towers(id) on delete cascade,
  number text not null,
  unique (tower_id, number)
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  name text not null,
  phone text not null unique
);

create table memberships (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  profile_id uuid not null references profiles(id) on delete cascade,
  society_id uuid not null references societies(id) on delete cascade,
  role member_role not null,
  unique (profile_id, society_id, role)
);

create table flat_residents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  flat_id uuid not null references flats(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  added_by uuid references profiles(id) on delete set null,
  unique (flat_id, profile_id)
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  society_id uuid not null references societies(id) on delete cascade,
  phone text not null,
  name text not null,
  role member_role not null,
  flat_id uuid references flats(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  claimed_at timestamptz,
  constraint invites_resident_needs_flat check (role <> 'resident' or flat_id is not null)
);

create table passes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  society_id uuid not null references societies(id) on delete cascade,
  flat_id uuid not null references flats(id) on delete cascade,
  created_by uuid not null references profiles(id),
  guest_name text not null,
  code char(6) not null check (code ~ '^[0-9]{6}$'),
  valid_from timestamptz not null,
  valid_to timestamptz not null,
  revoked_at timestamptz,
  constraint passes_valid_range check (valid_to > valid_from)
);

create table visits (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  society_id uuid not null references societies(id) on delete cascade,
  flat_id uuid not null references flats(id) on delete cascade,
  name text not null,
  phone text,
  photo_path text,
  purpose visit_purpose not null,
  status visit_status not null default 'pending',
  responded_by uuid references profiles(id) on delete set null,
  responded_at timestamptz,
  manual_outcome manual_outcome,
  created_by uuid not null references profiles(id),
  pass_id uuid references passes(id) on delete set null,
  entry_at timestamptz,
  exit_at timestamptz
);

create table push_tokens (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  profile_id uuid not null references profiles(id) on delete cascade,
  token text not null unique,
  platform text not null
);

create index visits_society_created_idx on visits (society_id, created_at desc);
create index visits_pending_idx on visits (status, created_at) where status = 'pending';
create index passes_society_code_idx on passes (society_id, code);
