-- Migration 0019: helper_unlinked, attendance-since-link, one parcel per visit.
begin;
select plan(13);

insert into societies (id, name) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Society A');
insert into towers (id, society_id, name) values
  ('aaaaaaaa-0000-0000-0000-0000000000a0', 'aaaaaaaa-0000-0000-0000-000000000000', 'A');
insert into flats (id, society_id, tower_id, number) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a0', '101'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a0', '102');
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'guarda@staff.test'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'flat-a1@login.test'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'flat-a2@login.test');
insert into profiles (id, name) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'Guard A'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'B1-A-101'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'B1-A-102');
insert into memberships (profile_id, society_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'aaaaaaaa-0000-0000-0000-000000000000', 'guard'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident');
insert into flat_residents (flat_id, profile_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000e101'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-00000000e102');

-- Flat 1 adds the helper, flat 2 links the same person later.
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select add_helper('aaaaaaaa-0000-0000-0000-0000000000f1', 'Sunita', '+919876543210', 'maid');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select add_helper('aaaaaaaa-0000-0000-0000-0000000000f2', 'Sunita', '+919876543210', 'maid');
reset role;

-- Timeline: flat 1 linked 1 day ago, flat 2 linked 1 hour ago.
update helper_flats set added_at = now() - interval '1 day' where flat_id = 'aaaaaaaa-0000-0000-0000-0000000000f1';
update helper_flats set added_at = now() - interval '1 hour' where flat_id = 'aaaaaaaa-0000-0000-0000-0000000000f2';
insert into helper_attendance (society_id, helper_id, entry_at, exit_at, entry_by)
select society_id, id, now() - interval '3 hours', now() - interval '2 hours', null from helpers;
insert into helper_attendance (society_id, helper_id, entry_at, exit_at, entry_by)
select society_id, id, now() - interval '30 minutes', now() - interval '20 minutes', null from helpers;

-- ---------------------------------------------------------------- attendance since link
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select is((select count(*)::int from helper_attendance), 2, 'original flat sees all attendance since its own link');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select is((select count(*)::int from helper_attendance), 1, 'later-linked flat sees only attendance after its link');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select is((select count(*)::int from helper_attendance), 2, 'guard still sees everything');

-- ---------------------------------------------------------------- helper_unlinked
select lives_ok($$select helper_check_in((select id from helpers))$$, 'linked helper can check in');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select remove_helper_from_flat((select id from helpers), 'aaaaaaaa-0000-0000-0000-0000000000f1');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select remove_helper_from_flat((select id from helpers), 'aaaaaaaa-0000-0000-0000-0000000000f2');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select lives_ok($$select helper_check_out((select id from helpers))$$, 'unlinked helper who is inside can still be checked out');
select throws_ok($$select helper_check_in((select id from helpers))$$, 'P0001', 'helper_unlinked', 'unlinked helper cannot check in');

-- ---------------------------------------------------------------- one parcel per visit
select is((select count(*)::int from pg_indexes where indexname = 'parcels_visit_id_key'), 1, 'unique parcel-per-visit index exists');
select lives_ok($$select create_visit('aaaaaaaa-0000-0000-0000-0000000000f1', 'Rider', null, 'delivery', null)$$, 'guard logs a delivery visit');
select lives_ok($$select log_parcel('aaaaaaaa-0000-0000-0000-0000000000f1', 'Amazon', null, null, (select id from visits where name = 'Rider'))$$, 'parcel logged from the visit');
select throws_ok($$select log_parcel('aaaaaaaa-0000-0000-0000-0000000000f1', 'Amazon', null, null, (select id from visits where name = 'Rider'))$$,
  'P0001', 'parcel_already_logged', 'second parcel for the same visit is rejected');
select lives_ok($$select log_parcel('aaaaaaaa-0000-0000-0000-0000000000f1', 'Amazon', null, null)$$, 'parcels without a visit can repeat');
select lives_ok($$select log_parcel('aaaaaaaa-0000-0000-0000-0000000000f1', 'Amazon', null, null)$$, 'and repeat again');
select is((select count(*)::int from parcels), 3, 'three parcels in total');

select * from finish();
rollback;
