begin;
select plan(24);

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
  ('aaaaaaaa-0000-0000-0000-00000000a901', '910000000002'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', '910000000003'),
  ('aaaaaaaa-0000-0000-0000-00000000e201', '910000000004'),
  ('aaaaaaaa-0000-0000-0000-00000000ad01', '910000000005'),
  ('bbbbbbbb-0000-0000-0000-00000000a901', '910000000006');
insert into profiles (id, name, phone) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'Guard A',     '+910000000002'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'Resident A1', '+910000000003'),
  ('aaaaaaaa-0000-0000-0000-00000000e201', 'Resident A2', '+910000000004'),
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'Admin A',     '+910000000005'),
  ('bbbbbbbb-0000-0000-0000-00000000a901', 'Guard B',     '+910000000006');
insert into memberships (profile_id, society_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'aaaaaaaa-0000-0000-0000-000000000000', 'guard'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('aaaaaaaa-0000-0000-0000-00000000e201', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'aaaaaaaa-0000-0000-0000-000000000000', 'admin'),
  ('bbbbbbbb-0000-0000-0000-00000000a901', 'bbbbbbbb-0000-0000-0000-000000000000', 'guard');
insert into flat_residents (flat_id, profile_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000e101'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-00000000e201');

create temp table t (k text primary key, id uuid, code text);
grant all on t to authenticated;

set local role authenticated;

-- Resident A1 creates passes
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
insert into t select 'ok', p.id, p.code from create_pass('aaaaaaaa-0000-0000-0000-0000000000f1', 'Aunty', now() - interval '1 hour', now() + interval '1 day') p;
insert into t select 'rev', p.id, p.code from create_pass('aaaaaaaa-0000-0000-0000-0000000000f1', 'Revoked', now() - interval '1 hour', now() + interval '1 day') p;
insert into t select 'fut', p.id, p.code from create_pass('aaaaaaaa-0000-0000-0000-0000000000f1', 'Future', now() + interval '1 day', now() + interval '2 days') p;
insert into t select 'exp', p.id, p.code from create_pass('aaaaaaaa-0000-0000-0000-0000000000f1', 'Expired', now() - interval '2 days', now() + interval '1 hour') p;

select ok((select code from t where k = 'ok') ~ '^\d{6}$', 'created pass code is 6 digits');
select is((select created_by from passes where id = (select id from t where k = 'ok')),
  'aaaaaaaa-0000-0000-0000-00000000e101'::uuid, 'pass created_by is the resident');
select is((select count(distinct code)::int from t), 4, 'codes of concurrently valid passes are distinct');
select throws_ok(
  $$select create_pass('aaaaaaaa-0000-0000-0000-0000000000f2', 'X', now(), now() + interval '1 day')$$,
  'P0001', 'not_authorized', 'resident of A1 cannot create pass for flat A2');
select throws_ok(
  $$select create_pass('aaaaaaaa-0000-0000-0000-0000000000f1', 'X', now() + interval '1 day', now())$$,
  'P0001', 'invalid_validity', 'valid_to must be after valid_from');
select throws_ok(
  $$select create_pass('aaaaaaaa-0000-0000-0000-0000000000f1', '  ', now(), now() + interval '1 day')$$,
  'P0001', 'invalid_guest_name', 'blank guest name rejected');

-- Revocation: other flat's resident cannot; own resident can; admin can
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e201","role":"authenticated"}', true);
select throws_ok(
  format($$select revoke_pass(%L)$$, (select id from t where k = 'rev')),
  'P0001', 'not_authorized', 'resident of another flat cannot revoke');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select isnt((select revoked_at from revoke_pass((select id from t where k = 'rev'))), null, 'resident of flat revokes pass');
insert into t select 'adm', p.id, p.code from create_pass('aaaaaaaa-0000-0000-0000-0000000000f1', 'AdminRev', now(), now() + interval '1 day') p;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select isnt((select revoked_at from revoke_pass((select id from t where k = 'adm'))), null, 'admin revokes pass');

-- Resident cannot use a pass; guard can
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok(
  format($$select use_pass(%L)$$, (select code from t where k = 'ok')),
  'P0001', 'not_authorized', 'resident cannot use_pass');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
insert into t select 'v1', v.id, null from use_pass((select code from t where k = 'ok')) v;
select is((select status::text from visits where id = (select id from t where k = 'v1')), 'approved', 'use_pass creates approved visit');
select is((select pass_id from visits where id = (select id from t where k = 'v1')),
  (select id from t where k = 'ok'), 'visit linked to pass');
select is((select name || '/' || purpose::text || '/' || (flat_id = 'aaaaaaaa-0000-0000-0000-0000000000f1')::text
           || '/' || (entry_at is not null)::text || '/' || (created_by = auth.uid())::text
           from visits where id = (select id from t where k = 'v1')),
  'Aunty/guest/true/true/true', 'visit has guest name, purpose, flat from pass, entry_at, guard as creator');
insert into t select 'v2', v.id, null from use_pass((select code from t where k = 'ok')) v;
select isnt((select id from t where k = 'v2'), (select id from t where k = 'v1'), 'pass is reusable within window');

select throws_ok(format($$select use_pass(%L)$$, (select code from t where k = 'rev')),
  'P0001', 'pass_revoked', 'revoked pass rejected');
select throws_ok(format($$select use_pass(%L)$$, (select code from t where k = 'fut')),
  'P0001', 'pass_not_yet_valid', 'future pass rejected');
reset role;
update passes set valid_to = now() - interval '1 day' where id = (select id from t where k = 'exp');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select throws_ok(format($$select use_pass(%L)$$, (select code from t where k = 'exp')),
  'P0001', 'pass_expired', 'expired pass rejected');
select throws_ok($$select use_pass('abc')$$, 'P0001', 'invalid_code', 'malformed code is invalid_code');

-- Guard B cannot use society A's code
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select throws_ok(format($$select use_pass(%L)$$, (select code from t where k = 'ok')),
  'P0001', 'invalid_code', 'guard of B cannot use pass of A');

-- Household members
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e201","role":"authenticated"}', true);
select throws_ok(
  $$select add_household_member('aaaaaaaa-0000-0000-0000-0000000000f1', 'Spouse', '+919876543210')$$,
  'P0001', 'not_authorized', 'resident of A2 cannot add member to A1');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok(
  $$select add_household_member('aaaaaaaa-0000-0000-0000-0000000000f1', 'Spouse', '9876543210')$$,
  'P0001', 'invalid_phone', 'non-E.164 phone rejected');
select throws_ok(
  $$select add_household_member('aaaaaaaa-0000-0000-0000-0000000000f1', 'Spouse', '+915876543210')$$,
  'P0001', 'invalid_phone', 'phone not starting 6-9 rejected');
select is((select role::text || '/' || (flat_id = 'aaaaaaaa-0000-0000-0000-0000000000f1')::text
                  || '/' || (society_id = 'aaaaaaaa-0000-0000-0000-000000000000')::text
                  || '/' || (created_by = auth.uid())::text || '/' || phone
           from add_household_member('aaaaaaaa-0000-0000-0000-0000000000f1', 'Spouse', '+919876543210')),
  'resident/true/true/true/+919876543210', 'resident invite created for flat');

-- Direct writes remain blocked
select throws_ok($$insert into passes (society_id, flat_id, created_by, guest_name, code, valid_from, valid_to)
  values ('aaaaaaaa-0000-0000-0000-000000000000','aaaaaaaa-0000-0000-0000-0000000000f1','aaaaaaaa-0000-0000-0000-00000000e101','X','123456', now(), now() + interval '1 day')$$,
  '42501', null, 'direct insert on passes blocked');

select * from finish();
rollback;
