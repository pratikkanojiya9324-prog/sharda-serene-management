begin;
select plan(13);

insert into societies (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Society A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Society B');
insert into towers (id, society_id, name) values
  ('aaaaaaaa-0000-0000-0000-0000000000a0', 'aaaaaaaa-0000-0000-0000-000000000000', 'TA');
insert into flats (id, society_id, tower_id, number) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a0', 'A1');
insert into auth.users (id, phone) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', '910000000002'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', '910000000003'),
  ('bbbbbbbb-0000-0000-0000-00000000a901', '910000000006'),
  ('cccccccc-0000-0000-0000-000000000001', '910000000007');
insert into profiles (id, name, phone) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'Guard A',     '+910000000002'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'Resident A1', '+910000000003'),
  ('bbbbbbbb-0000-0000-0000-00000000a901', 'Guard B',     '+910000000006');
insert into memberships (profile_id, society_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'aaaaaaaa-0000-0000-0000-000000000000', 'guard'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('bbbbbbbb-0000-0000-0000-00000000a901', 'bbbbbbbb-0000-0000-0000-000000000000', 'guard');
insert into flat_residents (flat_id, profile_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000e101');
insert into visits (id, society_id, flat_id, name, purpose, created_by) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000000',
   'aaaaaaaa-0000-0000-0000-0000000000f1', 'Swiggy', 'delivery', 'aaaaaaaa-0000-0000-0000-00000000a901');

set local role authenticated;

-- set_visit_photo ------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok(
  $$select set_visit_photo('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000000/p.jpg')$$,
  'P0001', 'not_authorized', 'resident cannot set a visit photo');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select throws_ok(
  $$select set_visit_photo('aaaaaaaa-0000-0000-0000-0000000000c1', 'bbbbbbbb-0000-0000-0000-000000000000/p.jpg')$$,
  'P0001', 'not_authorized', 'guard of another society cannot set the photo');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select throws_ok(
  $$select set_visit_photo('00000000-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-000000000000/p.jpg')$$,
  'P0001', 'not_authorized', 'unknown visit id is not_authorized');
select throws_ok(
  $$select set_visit_photo('aaaaaaaa-0000-0000-0000-0000000000c1', 'bbbbbbbb-0000-0000-0000-000000000000/p.jpg')$$,
  'P0001', 'invalid_photo_path', 'path outside the society folder is rejected');
select throws_ok(
  $$select set_visit_photo('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000000/')$$,
  'P0001', 'invalid_photo_path', 'empty file name is rejected');
select is(
  (select photo_path from set_visit_photo('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000000/p.jpg')),
  'aaaaaaaa-0000-0000-0000-000000000000/p.jpg', 'guard of the society sets the photo');
select throws_ok(
  $$select set_visit_photo('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000000/q.jpg')$$,
  'P0001', 'photo_already_set', 'photo cannot be replaced once set');

-- register_push_token ---------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select lives_ok($$select register_push_token('ExponentPushToken[dev1]', 'android')$$, 'user A registers a token');
select is((select profile_id from push_tokens where token = 'ExponentPushToken[dev1]'),
  'aaaaaaaa-0000-0000-0000-00000000e101'::uuid, 'token owned by A');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select lives_ok($$select register_push_token('ExponentPushToken[dev1]', 'android')$$, 'user B registers the same token');
reset role;
select is((select profile_id from push_tokens where token = 'ExponentPushToken[dev1]'),
  'aaaaaaaa-0000-0000-0000-00000000a901'::uuid, 'token reassigned to B (one row)');
set local role authenticated;

select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-000000000001","role":"authenticated"}', true);
select throws_ok($$select register_push_token('ExponentPushToken[x]', 'android')$$,
  'P0001', 'not_authorized', 'user without a profile cannot register a token');

set local role anon;
select throws_ok($$select register_push_token('ExponentPushToken[y]', 'android')$$,
  '42501', null, 'anon cannot call register_push_token');

select * from finish();
rollback;
