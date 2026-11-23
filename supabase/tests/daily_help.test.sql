-- Migration 0014: daily help (helpers, helper_flats, helper_attendance).
begin;
select plan(42);

insert into societies (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Society A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Society B');
insert into towers (id, society_id, name) values
  ('aaaaaaaa-0000-0000-0000-0000000000a0', 'aaaaaaaa-0000-0000-0000-000000000000', 'A'),
  ('bbbbbbbb-0000-0000-0000-0000000000b0', 'bbbbbbbb-0000-0000-0000-000000000000', 'A');
insert into flats (id, society_id, tower_id, number) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a0', '101'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a0', '102'),
  ('aaaaaaaa-0000-0000-0000-0000000000f3', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a0', '103'),
  ('bbbbbbbb-0000-0000-0000-0000000000f1', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000b0', '101');
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'admina@staff.test'),
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'guarda@staff.test'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'flat-a1@login.test'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'flat-a2@login.test'),
  ('aaaaaaaa-0000-0000-0000-00000000e103', 'flat-a3@login.test'),
  ('bbbbbbbb-0000-0000-0000-00000000a901', 'guardb@staff.test');
insert into profiles (id, name) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'Admin A'),
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'Guard A'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'B1-A-101'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'B1-A-102'),
  ('aaaaaaaa-0000-0000-0000-00000000e103', 'B1-A-103'),
  ('bbbbbbbb-0000-0000-0000-00000000a901', 'Guard B');
insert into memberships (profile_id, society_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'aaaaaaaa-0000-0000-0000-000000000000', 'admin'),
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'aaaaaaaa-0000-0000-0000-000000000000', 'guard'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('aaaaaaaa-0000-0000-0000-00000000e103', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('bbbbbbbb-0000-0000-0000-00000000a901', 'bbbbbbbb-0000-0000-0000-000000000000', 'guard');
insert into flat_residents (flat_id, profile_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000e101'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-00000000e102'),
  ('aaaaaaaa-0000-0000-0000-0000000000f3', 'aaaaaaaa-0000-0000-0000-00000000e103');

-- ---------------------------------------------------------------- schema
select is((select count(*)::int from storage.buckets where id = 'helper-photos' and not public), 1, 'helper-photos bucket is private');
select ok(
  (select with_check ilike '%case%' from pg_policies where tablename = 'objects' and policyname = 'helper_photos_insert'),
  'helper photo insert policy uses CASE');
select is((select count(*)::int from pg_enum e join pg_type t on t.oid = e.enumtypid where t.typname = 'helper_type'), 7, 'helper_type has 7 values');

-- ---------------------------------------------------------------- add_helper (flat A)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select lives_ok($$select add_helper('aaaaaaaa-0000-0000-0000-0000000000f1', ' Sunita ', '+919876543210', 'maid', null, ' Rahul ')$$, 'flat A adds helper');
select is((select count(*)::int from helpers), 1, 'one helper');
select is((select name from helpers), 'Sunita', 'name trimmed');
select matches((select entry_code from helpers), '^[0-9]{6}$', 'entry code is 6 digits');
select is((select added_by_name from helper_flats), 'Rahul', 'actor name trimmed and stored');
select throws_ok($$select add_helper('aaaaaaaa-0000-0000-0000-0000000000f1', 'Sunita', '+919876543210', 'maid')$$,
  'P0001', 'helper_already_linked', 'second add from same flat is helper_already_linked');
select throws_ok($$select add_helper('aaaaaaaa-0000-0000-0000-0000000000f1', 'X', '9876543210', 'maid')$$,
  'P0001', 'invalid_phone', 'bad phone rejected');
select throws_ok($$select add_helper('aaaaaaaa-0000-0000-0000-0000000000f1', '   ', '+919876543211', 'maid')$$,
  'P0001', 'invalid_name', 'blank name rejected');
select throws_ok($$select add_helper('aaaaaaaa-0000-0000-0000-0000000000f1', repeat('x', 61), '+919876543211', 'maid')$$,
  'P0001', 'invalid_name', 'long name rejected');
select throws_ok($$select add_helper('aaaaaaaa-0000-0000-0000-0000000000f2', 'Sunita', '+919876543210', 'maid')$$,
  'P0001', 'not_authorized', 'cannot add to a flat that is not yours');
select throws_ok($$select add_helper('00000000-0000-0000-0000-000000000099', 'Sunita', '+919876543210', 'maid')$$,
  'P0001', 'not_authorized', 'unknown flat is not_authorized');
select throws_ok($$select add_helper('aaaaaaaa-0000-0000-0000-0000000000f1', 'X', '+919876543211', 'maid', 'bbbbbbbb-0000-0000-0000-000000000000/p.jpg')$$,
  'P0001', 'invalid_photo_path', 'photo must be in own society folder');
select throws_ok($$insert into helpers (society_id, name, phone, type, entry_code) values ('aaaaaaaa-0000-0000-0000-000000000000', 'x', '+919999999999', 'maid', '111111')$$,
  '42501', null, 'direct insert revoked');

-- ---------------------------------------------------------------- flat B links same helper
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select lives_ok($$select add_helper('aaaaaaaa-0000-0000-0000-0000000000f2', 'Sunita Devi', '+919876543210', 'cook')$$, 'flat B adds same phone');
reset role;
select is((select count(*)::int from helpers), 1, 'still one helper');
select is((select count(*)::int from helper_flats), 2, 'two links');
select is((select name from helpers), 'Sunita', 'existing name kept');
select is((select count(distinct entry_code)::int from helpers), 1, 'one code');

-- ---------------------------------------------------------------- resident visibility
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select is((select count(*)::int from helper_flats), 1, 'flat A sees only its own link');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e103","role":"authenticated"}', true);
select is((select count(*)::int from helpers) + (select count(*)::int from helper_flats), 0, 'unlinked flat C sees no helpers or links');

-- ---------------------------------------------------------------- guard
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select is((select count(*)::int from helpers), 1, 'guard sees helper');
select lives_ok($$select helper_check_in((select id from helpers))$$, 'guard checks in');
select throws_ok($$select helper_check_in((select id from helpers))$$, 'P0001', 'already_inside', 'second check-in is already_inside');
select is((select count(*)::int from helper_attendance where exit_at is null), 1, 'exactly one open row');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e103","role":"authenticated"}', true);
select is((select count(*)::int from helper_attendance), 0, 'flat C sees no attendance');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select is((select count(*)::int from helper_attendance), 1, 'flat A sees attendance');
select throws_ok($$select helper_check_in((select id from helpers))$$, 'P0001', 'not_authorized', 'resident cannot check in');

-- remove link from flat A
select lives_ok($$select remove_helper_from_flat((select id from helpers), 'aaaaaaaa-0000-0000-0000-0000000000f1')$$, 'flat A removes helper');
select is((select count(*)::int from helpers) + (select count(*)::int from helper_attendance), 0, 'flat A sees nothing after removal');
select throws_ok($$select remove_helper_from_flat('00000000-0000-0000-0000-000000000099', 'aaaaaaaa-0000-0000-0000-0000000000f1')$$,
  'P0001', 'not_authorized', 'remove with unknown helper is not_authorized');

-- check out
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select lives_ok($$select helper_check_out((select id from helpers))$$, 'guard checks out');
select throws_ok($$select helper_check_out((select id from helpers))$$, 'P0001', 'not_inside', 'check-out without open row is not_inside');

-- guard of another society
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select is((select count(*)::int from helpers) + (select count(*)::int from helper_attendance), 0, 'other society guard sees nothing');

-- ---------------------------------------------------------------- admin: deactivate
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select helper_check_in((select id from helpers));
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select throws_ok($$select set_helper_active((select id from helpers), false)$$, 'P0001', 'not_authorized', 'resident cannot deactivate');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select lives_ok($$select set_helper_active((select id from helpers), false)$$, 'admin deactivates');
select is((select count(*)::int from helper_attendance where exit_at is null), 0, 'deactivation closes open attendance');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select throws_ok($$select helper_check_in((select id from helpers))$$, 'P0001', 'helper_inactive', 'deactivated helper cannot check in');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok($$select add_helper('aaaaaaaa-0000-0000-0000-0000000000f1', 'Sunita', '+919876543210', 'maid')$$,
  'P0001', 'helper_inactive', 'adding a deactivated helper by phone is helper_inactive');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select is((select active from set_helper_active((select id from helpers), true)), true, 'admin reactivates');

select * from finish();
rollback;
