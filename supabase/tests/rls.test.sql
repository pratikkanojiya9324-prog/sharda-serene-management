begin;
select plan(42);

-- ---------------------------------------------------------------------------
-- Seed (runs as postgres, bypasses RLS)
--   Society A: tower TA, flats A1, A2; admin A, guard A, resident A1, resident A2
--   Society B: tower TB, flat B1;      admin B, guard B, resident B1
-- ---------------------------------------------------------------------------
insert into societies (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Society A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Society B');

insert into towers (id, society_id, name) values
  ('aaaaaaaa-0000-0000-0000-0000000000a0', 'aaaaaaaa-0000-0000-0000-000000000000', 'TA'),
  ('bbbbbbbb-0000-0000-0000-0000000000b0', 'bbbbbbbb-0000-0000-0000-000000000000', 'TB');

insert into flats (id, society_id, tower_id, number) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a0', 'A1'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a0', 'A2'),
  ('bbbbbbbb-0000-0000-0000-0000000000f1', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000b0', 'B1');

insert into auth.users (id, phone) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', '910000000001'),
  ('aaaaaaaa-0000-0000-0000-00000000a901', '910000000002'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', '910000000003'),
  ('aaaaaaaa-0000-0000-0000-00000000e201', '910000000004'),
  ('bbbbbbbb-0000-0000-0000-00000000ad01', '910000000005'),
  ('bbbbbbbb-0000-0000-0000-00000000a901', '910000000006'),
  ('bbbbbbbb-0000-0000-0000-00000000e101', '910000000007'),
  ('cccccccc-0000-0000-0000-000000000001', '919876543210');

insert into profiles (id, name, phone) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'Admin A',    '+910000000001'),
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'Guard A',    '+910000000002'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'Resident A1','+910000000003'),
  ('aaaaaaaa-0000-0000-0000-00000000e201', 'Resident A2','+910000000004'),
  ('bbbbbbbb-0000-0000-0000-00000000ad01', 'Admin B',    '+910000000005'),
  ('bbbbbbbb-0000-0000-0000-00000000a901', 'Guard B',    '+910000000006'),
  ('bbbbbbbb-0000-0000-0000-00000000e101', 'Resident B1','+910000000007');

insert into memberships (profile_id, society_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'aaaaaaaa-0000-0000-0000-000000000000', 'admin'),
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'aaaaaaaa-0000-0000-0000-000000000000', 'guard'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('aaaaaaaa-0000-0000-0000-00000000e201', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('bbbbbbbb-0000-0000-0000-00000000ad01', 'bbbbbbbb-0000-0000-0000-000000000000', 'admin'),
  ('bbbbbbbb-0000-0000-0000-00000000a901', 'bbbbbbbb-0000-0000-0000-000000000000', 'guard'),
  ('bbbbbbbb-0000-0000-0000-00000000e101', 'bbbbbbbb-0000-0000-0000-000000000000', 'resident');

insert into flat_residents (flat_id, profile_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000e101'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-00000000e201'),
  ('bbbbbbbb-0000-0000-0000-0000000000f1', 'bbbbbbbb-0000-0000-0000-00000000e101');

insert into visits (society_id, flat_id, name, purpose, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'V A1', 'delivery', 'aaaaaaaa-0000-0000-0000-00000000a901'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f2', 'V A2', 'guest',    'aaaaaaaa-0000-0000-0000-00000000a901'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000f1', 'V B1', 'cab',      'bbbbbbbb-0000-0000-0000-00000000a901');

insert into passes (society_id, flat_id, created_by, guest_name, code, valid_from, valid_to) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000e101', 'G A1', '111111', now(), now() + interval '1 day'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000f1', 'bbbbbbbb-0000-0000-0000-00000000e101', 'G B1', '222222', now(), now() + interval '1 day');

insert into invites (society_id, phone, name, role, flat_id, created_by) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '+919876543210', 'New Resident', 'resident', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000ad01'),
  ('bbbbbbbb-0000-0000-0000-000000000000', '+910000009999', 'Other Guard',  'guard',    null,                                   'bbbbbbbb-0000-0000-0000-00000000ad01');

insert into push_tokens (profile_id, token, platform) values
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'tok-a1', 'android'),
  ('aaaaaaaa-0000-0000-0000-00000000e201', 'tok-a2', 'android');

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity),
  0, 'RLS is enabled on every table in public');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('has_role','is_member','is_flat_resident','claim_invites')
      and p.prosecdef
      and exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%')),
  4, 'helpers and claim_invites are security definer with a pinned search_path');

-- Tenant consistency: a visit's flat must belong to the visit's society
select throws_ok(
  $$insert into visits (society_id, flat_id, name, purpose, created_by)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000f1',
            'X', 'guest', 'aaaaaaaa-0000-0000-0000-00000000a901')$$,
  '23503', null, 'visit whose flat belongs to another society is rejected');

select throws_ok(
  $$insert into flats (society_id, tower_id, number)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000b0', 'X1')$$,
  '23503', null, 'flat whose tower belongs to another society is rejected');

-- ---------------------------------------------------------------------------
-- Resident A1
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);

select is((select count(*)::int from visits where society_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 0,
  'resident A1 sees 0 society B visits');
select is((select count(*)::int from visits where flat_id = 'aaaaaaaa-0000-0000-0000-0000000000f2'), 0,
  'resident A1 sees 0 flat A2 visits');
select is((select count(*)::int from visits), 1, 'resident A1 sees only own flat visit');
select is((select count(*)::int from passes), 1, 'resident A1 sees only own flat pass');
select is((select count(*)::int from societies), 1, 'resident A1 sees only society A');
select is((select count(*)::int from flats), 2, 'resident A1 sees society A flats only');
select is((select count(*)::int from memberships), 1, 'resident A1 sees only own membership');
select is((select count(*)::int from invites), 0, 'resident A1 sees no invites');
select is((select count(*)::int from flat_residents), 1, 'resident A1 sees only residents of own flat');
select is((select count(*)::int from profiles), 4, 'resident A1 sees profiles of society A members only');
select is((select count(*)::int from push_tokens), 1, 'resident A1 sees only own push token');

select throws_ok(
  $$insert into visits (society_id, flat_id, name, purpose, created_by)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1',
            'X', 'guest', 'aaaaaaaa-0000-0000-0000-00000000e101')$$,
  '42501', null, 'resident A1 cannot insert into visits');
select throws_ok(
  $$update visits set status = 'approved'$$,
  '42501', null, 'resident A1 cannot update visits directly');
select throws_ok(
  $$insert into passes (society_id, flat_id, created_by, guest_name, code, valid_from, valid_to)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1',
            'aaaaaaaa-0000-0000-0000-00000000e101', 'G', '333333', now(), now() + interval '1 hour')$$,
  '42501', null, 'resident A1 cannot insert into passes directly');
select throws_ok(
  $$insert into towers (society_id, name) values ('aaaaaaaa-0000-0000-0000-000000000000', 'T-res')$$,
  '42501', null, 'resident A1 cannot insert towers');
select throws_ok(
  $$update profiles set phone = '+910000000099' where id = 'aaaaaaaa-0000-0000-0000-00000000e101'$$,
  '42501', null, 'resident A1 cannot change own phone');
select lives_ok(
  $$update profiles set name = 'Renamed A1' where id = 'aaaaaaaa-0000-0000-0000-00000000e101'$$,
  'resident A1 can rename self');
select lives_ok(
  $$insert into push_tokens (profile_id, token, platform) values ('aaaaaaaa-0000-0000-0000-00000000e101', 'tok-a1-2', 'android')$$,
  'resident A1 can insert own push token');
select throws_ok(
  $$insert into push_tokens (profile_id, token, platform) values ('aaaaaaaa-0000-0000-0000-00000000e201', 'tok-x', 'android')$$,
  '42501', null, 'resident A1 cannot insert a push token for someone else');

-- ---------------------------------------------------------------------------
-- Guard A
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);

select is((select count(*)::int from visits where society_id = 'aaaaaaaa-0000-0000-0000-000000000000'), 2,
  'guard A sees all society A visits');
select is((select count(*)::int from visits where society_id = 'bbbbbbbb-0000-0000-0000-000000000000'), 0,
  'guard A sees 0 society B visits');
select is((select count(*)::int from passes), 0, 'guard A selecting passes returns 0 rows');
select is((select count(*)::int from flat_residents), 2, 'guard A sees society A flat residents only');
select throws_ok(
  $$insert into visits (society_id, flat_id, name, purpose, created_by)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1',
            'X', 'guest', 'aaaaaaaa-0000-0000-0000-00000000a901')$$,
  '42501', null, 'guard A cannot insert into visits directly');

-- ---------------------------------------------------------------------------
-- Admin A
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);

select is((select count(*)::int from passes), 1, 'admin A sees society A passes only');
select is((select count(*)::int from memberships), 4, 'admin A sees society A memberships only');
select is((select count(*)::int from invites), 1, 'admin A sees society A invites only');
select lives_ok(
  $$insert into towers (society_id, name) values ('aaaaaaaa-0000-0000-0000-000000000000', 'TA2')$$,
  'admin A can add a tower to society A');
select throws_ok(
  $$insert into towers (society_id, name) values ('bbbbbbbb-0000-0000-0000-000000000000', 'TB2')$$,
  '42501', null, 'admin A cannot add a tower to society B');
select throws_ok(
  $$insert into invites (society_id, phone, name, role) values ('bbbbbbbb-0000-0000-0000-000000000000', '+910000008888', 'X', 'guard')$$,
  '42501', null, 'admin A cannot invite into society B');

-- ---------------------------------------------------------------------------
-- Anonymous
-- ---------------------------------------------------------------------------
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select is((select count(*)::int from visits), 0, 'anon sees no visits');
select throws_ok($$select claim_invites()$$, '42501', null, 'anon cannot execute claim_invites');

-- ---------------------------------------------------------------------------
-- claim_invites
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(claim_invites(), 1, 'claim_invites claims the matching invite');

reset role;
select is(
  (select phone from profiles where id = 'cccccccc-0000-0000-0000-000000000001'),
  '+919876543210', 'claim_invites creates a profile with E.164 phone');
select is(
  (select count(*)::int from memberships
    where profile_id = 'cccccccc-0000-0000-0000-000000000001'
      and society_id = 'aaaaaaaa-0000-0000-0000-000000000000' and role = 'resident'),
  1, 'claim_invites creates the membership');
select is(
  (select count(*)::int from flat_residents
    where profile_id = 'cccccccc-0000-0000-0000-000000000001'
      and flat_id = 'aaaaaaaa-0000-0000-0000-0000000000f1'),
  1, 'claim_invites creates the flat_residents row');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is(claim_invites(), 0, 'calling claim_invites again returns 0');
select is((select count(*)::int from visits), 1, 'claimed resident now sees own flat visit');

select * from finish();
rollback;
