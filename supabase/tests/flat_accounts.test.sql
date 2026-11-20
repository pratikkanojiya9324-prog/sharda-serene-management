-- Migration 0011: flat accounts, family members, login directory, actor names.
begin;
select plan(24);

insert into societies (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Society A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Society B');
insert into towers (id, society_id, name) values
  ('aaaaaaaa-0000-0000-0000-0000000000a0', 'aaaaaaaa-0000-0000-0000-000000000000', 'A'),
  ('bbbbbbbb-0000-0000-0000-0000000000b0', 'bbbbbbbb-0000-0000-0000-000000000000', 'A');
insert into flats (id, society_id, tower_id, number) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a0', '101'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a0', '102'),
  ('bbbbbbbb-0000-0000-0000-0000000000f1', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000b0', '101');
-- accounts are no longer people: no phone
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'guarda@staff.test'),
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'admina@staff.test'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'flat-a1@login.test'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'flat-a2@login.test'),
  ('bbbbbbbb-0000-0000-0000-00000000a901', 'guardb@staff.test');
select lives_ok($$
  insert into profiles (id, name, phone) values
    ('aaaaaaaa-0000-0000-0000-00000000a901', 'Guard A', null),
    ('aaaaaaaa-0000-0000-0000-00000000ad01', 'Admin A', null),
    ('aaaaaaaa-0000-0000-0000-00000000e101', 'B1-A-101', null),
    ('aaaaaaaa-0000-0000-0000-00000000e102', 'B1-A-102', null),
    ('bbbbbbbb-0000-0000-0000-00000000a901', 'Guard B', null)$$, 'profiles.phone may be null');
insert into memberships (profile_id, society_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'aaaaaaaa-0000-0000-0000-000000000000', 'guard'),
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'aaaaaaaa-0000-0000-0000-000000000000', 'admin'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('bbbbbbbb-0000-0000-0000-00000000a901', 'bbbbbbbb-0000-0000-0000-000000000000', 'guard');
insert into flat_residents (flat_id, profile_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000e101'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-00000000e102');
insert into family_members (society_id, flat_id, name, phone, relation) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'Rahul', '+919876543210', 'Son'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'Meena', null, 'Mother'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f2', 'Sita', '+919876543211', 'Wife'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000f1', 'Bob', '+919876543212', 'Father');

-- towers: building column + uniqueness
select is((select building from towers where id = 'aaaaaaaa-0000-0000-0000-0000000000a0'), 'Building 1', 'towers.building defaults to Building 1');
select throws_ok($$insert into towers (society_id, name) values ('aaaaaaaa-0000-0000-0000-000000000000', 'A')$$,
  '23505', null, 'duplicate (society, building, wing) rejected');
select lives_ok($$insert into towers (society_id, building, name) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Building 2', 'A')$$,
  'same wing name allowed in another building');

-- family_members is tenant-consistent
select throws_ok($$insert into family_members (society_id, flat_id, name) values
  ('bbbbbbbb-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'X')$$,
  '23503', null, 'family member flat must belong to its society');

-- login_directory as anon
set local role anon;
select is((select proargnames::text from pg_proc where proname = 'login_directory' and pronamespace = 'public'::regnamespace),
  '{p_society_id,society_name,building,wing,flat_id,flat_number}', 'login_directory returns exactly the 5 columns');
select is((select count(*)::int from login_directory('aaaaaaaa-0000-0000-0000-000000000000')), 2, 'anon sees the 2 flats of society A');
select is((select count(*)::int from login_directory('aaaaaaaa-0000-0000-0000-000000000000') where society_name <> 'Society A'), 0, 'society name is returned');
select is((select count(*)::int from login_directory('aaaaaaaa-0000-0000-0000-000000000000') d
  where d.flat_id = 'bbbbbbbb-0000-0000-0000-0000000000f1'), 0, 'society A directory has no flats of B');
select is((select count(*)::int from login_directory('bbbbbbbb-0000-0000-0000-000000000000')), 1, 'society B directory has its own flat');
select is((select count(*)::int from login_directory('cccccccc-0000-0000-0000-000000000000')), 0, 'unknown society returns nothing');
select throws_ok($$select * from family_members$$, '42501', null, 'anon cannot read family members');

-- family_members RLS
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select is((select count(*)::int from family_members), 2, 'resident of A1 sees only own family');
select is((select count(*)::int from family_members where flat_id = 'aaaaaaaa-0000-0000-0000-0000000000f2'), 0, 'resident of A1 cannot read family of A2');
select throws_ok($$insert into family_members (society_id, flat_id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'Self')$$,
  '42501', null, 'resident cannot write family members');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select is((select count(*)::int from family_members), 3, 'guard of A sees family of every flat in A, none of B');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select lives_ok($$insert into family_members (society_id, flat_id, name, relation) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f2', 'Added', 'Son')$$, 'admin can write family members');

-- flat_contacts returns family members with phones
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select results_eq($$select name, phone, relation from flat_contacts('aaaaaaaa-0000-0000-0000-0000000000f1')$$,
  $$values ('Rahul'::text, '+919876543210'::text, 'Son'::text)$$, 'flat_contacts returns family members with phones only');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select throws_ok($$select * from flat_contacts('aaaaaaaa-0000-0000-0000-0000000000f1')$$,
  'P0001', 'not_authorized', 'guard of B cannot read contacts of A');

-- actor names
reset role;
create temp table t (k text primary key, id uuid);
grant all on t to authenticated;
with v as (insert into visits (society_id, flat_id, name, purpose, created_by)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'Swiggy', 'delivery',
          'aaaaaaaa-0000-0000-0000-00000000a901') returning id)
insert into t select 'v1', id from v;
with v as (insert into visits (society_id, flat_id, name, purpose, created_by)
  values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'Zomato', 'delivery',
          'aaaaaaaa-0000-0000-0000-00000000a901') returning id)
insert into t select 'v2', id from v;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok(format($$select respond_to_visit(%L, 'approved', %L)$$, (select id from t where k = 'v1'), repeat('x', 61)),
  'P0001', 'invalid_actor_name', 'actor name over 60 chars rejected');
select is((select responded_by_name from respond_to_visit((select id from t where k = 'v1'), 'approved', '  Rahul  ')),
  'Rahul', 'respond_to_visit stores the trimmed actor name');
select is((select responded_by_name from respond_to_visit((select id from t where k = 'v2'), 'denied')),
  null, 'actor name is optional');
select is((select created_by_name from create_pass('aaaaaaaa-0000-0000-0000-0000000000f1', 'Aunty',
  now(), now() + interval '1 day', ' Meena ')), 'Meena', 'create_pass stores the trimmed actor name');
select throws_ok(format($$select create_pass('aaaaaaaa-0000-0000-0000-0000000000f1', 'Aunty', now(), now() + interval '1 day', %L)$$, repeat('y', 61)),
  'P0001', 'invalid_actor_name', 'create_pass rejects long actor name');

select * from finish();
rollback;
