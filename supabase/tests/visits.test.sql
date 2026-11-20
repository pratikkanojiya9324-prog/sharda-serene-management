begin;
select plan(21);

insert into societies (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Society A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Society B');
insert into towers (id, society_id, name) values
  ('aaaaaaaa-0000-0000-0000-0000000000a0', 'aaaaaaaa-0000-0000-0000-000000000000', 'TA'),
  ('bbbbbbbb-0000-0000-0000-0000000000b0', 'bbbbbbbb-0000-0000-0000-000000000000', 'TB');
insert into flats (id, society_id, tower_id, number) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a0', 'A1'),
  ('bbbbbbbb-0000-0000-0000-0000000000f1', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000b0', 'B1');
insert into auth.users (id, phone) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', '910000000002'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', '910000000003'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', '910000000008'),
  ('aaaaaaaa-0000-0000-0000-00000000e103', '910000000009'),
  ('bbbbbbbb-0000-0000-0000-00000000a901', '910000000006');
insert into profiles (id, name, phone) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'Guard A',     '+910000000002'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'Resident A1', '+910000000003'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'Resident A1b','+910000000008'),
  ('aaaaaaaa-0000-0000-0000-00000000e103', 'Removed Res','+910000000009'),
  ('bbbbbbbb-0000-0000-0000-00000000a901', 'Guard B',     '+910000000006');
insert into memberships (profile_id, society_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'aaaaaaaa-0000-0000-0000-000000000000', 'guard'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('bbbbbbbb-0000-0000-0000-00000000a901', 'bbbbbbbb-0000-0000-0000-000000000000', 'guard');
insert into flat_residents (flat_id, profile_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000e101'),
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000e102'),
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000e103');
insert into push_tokens (profile_id, token, platform) values
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'tok-a1', 'android'),
  ('aaaaaaaa-0000-0000-0000-00000000e103', 'tok-removed', 'android');

-- Scratch table (created as postgres) to carry visit ids between statements
create temp table t (k text primary key, id uuid);
grant all on t to authenticated;

-- Resident cannot create visits
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok(
  $$select create_visit('aaaaaaaa-0000-0000-0000-0000000000f1', 'X', null, 'guest', null)$$,
  'P0001', 'not_authorized', 'resident cannot create_visit');
select throws_ok($$select expire_stale_visits()$$, '42501', null, 'authenticated cannot call expire_stale_visits');

-- Guard creates visit
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
insert into t select 'v1', (create_visit('aaaaaaaa-0000-0000-0000-0000000000f1', 'Swiggy', '+911111111111', 'delivery', null)).id;
select is((select status::text from visits where id = (select id from t where k = 'v1')), 'pending', 'new visit is pending');
select is((select created_by from visits where id = (select id from t where k = 'v1')),
  'aaaaaaaa-0000-0000-0000-00000000a901'::uuid, 'created_by is the guard');
select throws_ok(
  $$select create_visit('bbbbbbbb-0000-0000-0000-0000000000f1', 'X', null, 'guest', null)$$,
  'P0001', 'not_authorized', 'guard of A cannot create visit for flat of B');

-- Flat contacts / app users (contacts are the flat's family members with phones, since 0011)
reset role;
insert into family_members (society_id, flat_id, name, phone, relation) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'Fam One', '+919000000001', 'Son'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'Fam Two', '+919000000002', 'Wife'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'No Phone', null, 'Mother');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select is((select count(*)::int from flat_contacts('aaaaaaaa-0000-0000-0000-0000000000f1')), 2, 'guard sees the flat family contacts that have phones');
select is(visit_has_app_users('aaaaaaaa-0000-0000-0000-0000000000f1'), true, 'flat with push token has app users');
reset role;
delete from push_tokens where token = 'tok-a1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select is(visit_has_app_users('aaaaaaaa-0000-0000-0000-0000000000f1'), false, 'push token of a removed resident does not count');

-- First response wins
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok(
  format($$select respond_to_visit(%L, 'pending')$$, (select id from t where k = 'v1')),
  'P0001', 'invalid_response', 'pending is not a valid response');
select is((select status::text from respond_to_visit((select id from t where k = 'v1'), 'approved')), 'approved', 'resident approves');
select is((select responded_by from visits where id = (select id from t where k = 'v1')),
  'aaaaaaaa-0000-0000-0000-00000000e101'::uuid, 'responded_by set');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select throws_ok(
  format($$select respond_to_visit(%L, 'denied')$$, (select id from t where k = 'v1')),
  'P0001', 'already_responded', 'second response rejected');
select is((select status::text from visits where id = (select id from t where k = 'v1')), 'approved', 'status still approved');

-- Guard of B is locked out of society A
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select throws_ok(
  $$select * from flat_contacts('aaaaaaaa-0000-0000-0000-0000000000f1')$$,
  'P0001', 'not_authorized', 'guard of B cannot read contacts of flat A1');
select throws_ok(
  format($$select mark_entry(%L)$$, (select id from t where k = 'v1')),
  'P0001', 'not_authorized', 'guard of B cannot mark entry on A visit');

-- Expiry
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
insert into t select 'v2', (create_visit('aaaaaaaa-0000-0000-0000-0000000000f1', 'Late', null, 'guest', null)).id;
reset role;
update visits set created_at = now() - interval '11 minutes' where id = (select id from t where k = 'v2');
select is(expire_stale_visits(), 1, 'expire_stale_visits expires the stale pending visit');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok(
  format($$select respond_to_visit(%L, 'approved')$$, (select id from t where k = 'v2')),
  'P0001', 'visit_expired', 'resident cannot respond to expired visit');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select is((select manual_outcome::text from record_manual_outcome((select id from t where k = 'v2'), 'allowed')), 'allowed', 'guard records manual outcome on expired visit');
select isnt((select entry_at from mark_entry((select id from t where k = 'v2'))), null, 'mark_entry succeeds after manual allow');

-- Not allowed in / not entered
insert into t select 'v3', (create_visit('aaaaaaaa-0000-0000-0000-0000000000f1', 'Denied', null, 'cab', null)).id;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select respond_to_visit((select id from t where k = 'v3'), 'denied');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select throws_ok(
  format($$select mark_entry(%L)$$, (select id from t where k = 'v3')),
  'P0001', 'not_allowed_in', 'mark_entry on denied visit rejected');
select throws_ok(
  format($$select mark_exit(%L)$$, (select id from t where k = 'v3')),
  'P0001', 'not_entered', 'mark_exit before entry rejected');

select * from finish();
rollback;
