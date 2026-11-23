-- Migration 0015: expected entries, parcels, auto-approving create_visit.
begin;
select plan(57);

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


-- A = ...f1 (resident e101), B = ...f2 (e102), guard a901
-- ---------------------------------------------------------------- schema
select is((select count(*)::int from storage.buckets where id = 'parcel-photos' and not public), 1, 'parcel-photos bucket is private');
select has_column('visits', 'expected_entry_id', 'visits.expected_entry_id exists');

-- ---------------------------------------------------------------- create_expected_entry
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select lives_ok($$select create_expected_entry('aaaaaaaa-0000-0000-0000-0000000000f1', 'delivery', 'Swiggy', 2, ' Rahul ')$$, 'flat A creates expected delivery');
select is((select count(*)::int from expected_entries), 1, 'one entry');
select is((select created_by_name from expected_entries), 'Rahul', 'actor name stored');
select is((select (valid_to - valid_from) from expected_entries), interval '2 hours', 'window is 2 hours');
select throws_ok($$select create_expected_entry('aaaaaaaa-0000-0000-0000-0000000000f1', 'delivery', 'Swiggy', 3)$$, 'P0001', 'invalid_hours', '3 hours rejected');
select throws_ok($$select create_expected_entry('aaaaaaaa-0000-0000-0000-0000000000f1', 'other', 'Swiggy', 2)$$, 'P0001', 'invalid_purpose', 'purpose other rejected');
select throws_ok($$select create_expected_entry('aaaaaaaa-0000-0000-0000-0000000000f1', 'delivery', repeat('x', 41), 2)$$, 'P0001', 'invalid_company', 'long company rejected');
select throws_ok($$select create_expected_entry('aaaaaaaa-0000-0000-0000-0000000000f2', 'delivery', 'Swiggy', 2)$$, 'P0001', 'not_authorized', 'not your flat');

-- ---------------------------------------------------------------- create_visit auto-approval
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select lives_ok($$select create_visit('aaaaaaaa-0000-0000-0000-0000000000f1', 'Rider 1', null, 'delivery', null)$$, 'guard logs delivery for A');
select is((select status::text from visits where name = 'Rider 1'), 'approved', 'expected delivery auto-approved');
select is((select expected_entry_id from visits where name = 'Rider 1'), (select id from expected_entries), 'visit linked to entry');
select is((select responded_by_name from visits where name = 'Rider 1'), 'Rahul (expected)', 'responded_by_name set');
select ok((select responded_at is not null from visits where name = 'Rider 1'), 'responded_at set');
select is((select used_count from expected_entries), 1, 'used_count 1');
select lives_ok($$select create_visit('aaaaaaaa-0000-0000-0000-0000000000f1', 'Rider 2', null, 'delivery', null)$$, 'second delivery');
select is((select status::text from visits where name = 'Rider 2'), 'approved', 'second delivery approved (reusable)');
select is((select used_count from expected_entries), 2, 'used_count 2');
select create_visit('aaaaaaaa-0000-0000-0000-0000000000f1', 'Cab 1', null, 'cab', null);
select is((select status::text from visits where name = 'Cab 1'), 'pending', 'different purpose stays pending');
select is((select expected_entry_id from visits where name = 'Cab 1'), null, 'no entry link on pending visit');
select create_visit('aaaaaaaa-0000-0000-0000-0000000000f2', 'Rider B', null, 'delivery', null);
select is((select status::text from visits where name = 'Rider B'), 'pending', 'other flat stays pending');
select throws_ok($$select create_visit('bbbbbbbb-0000-0000-0000-0000000000f1', 'X', null, 'delivery', null)$$, 'P0001', 'not_authorized', 'guard of another society still not_authorized');

-- cancel
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select is((select count(*)::int from expected_entries), 0, 'flat B sees none of A expectations');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select lives_ok($$select cancel_expected_entry((select id from expected_entries))$$, 'flat A cancels');
select throws_ok($$select cancel_expected_entry((select id from expected_entries))$$, 'P0001', 'already_cancelled', 'second cancel is already_cancelled');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select create_visit('aaaaaaaa-0000-0000-0000-0000000000f1', 'Rider 3', null, 'delivery', null);
select is((select status::text from visits where name = 'Rider 3'), 'pending', 'after cancel stays pending');

-- expired window (entry inserted directly)
reset role;
insert into expected_entries (society_id, flat_id, purpose, company, valid_from, valid_to, created_by)
values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'guest', 'Other',
        now() - interval '3 hours', now() - interval '1 hour', 'aaaaaaaa-0000-0000-0000-00000000e101');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select create_visit('aaaaaaaa-0000-0000-0000-0000000000f1', 'Guest 1', null, 'guest', null);
select is((select status::text from visits where name = 'Guest 1'), 'pending', 'after window stays pending');

-- plain visit unchanged: still expires after 10 minutes
reset role;
update visits set created_at = now() - interval '11 minutes' where name = 'Guest 1';
select expire_stale_visits();
select is((select status::text from visits where name = 'Guest 1'), 'expired', 'plain visit still expires');
select is((select status::text from visits where name = 'Rider 1'), 'approved', 'auto-approved visit not expired');

-- ---------------------------------------------------------------- parcels
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok($$select log_parcel('aaaaaaaa-0000-0000-0000-0000000000f1', 'Amazon', null, null)$$, 'P0001', 'not_authorized', 'resident cannot log parcel');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select lives_ok($$select log_parcel('aaaaaaaa-0000-0000-0000-0000000000f1', ' Amazon ', 'big box', 'aaaaaaaa-0000-0000-0000-000000000000/aaaaaaaa-0000-0000-0000-0000000000f1/p1.jpg')$$, 'guard logs parcel');
select is((select courier from parcels), 'Amazon', 'courier trimmed');
select is((select status::text from parcels), 'at_gate', 'status at_gate');
select throws_ok($$select log_parcel('aaaaaaaa-0000-0000-0000-0000000000f1', '  ', null, null)$$, 'P0001', 'invalid_courier', 'blank courier');
select throws_ok($$select log_parcel('aaaaaaaa-0000-0000-0000-0000000000f1', repeat('x', 41), null, null)$$, 'P0001', 'invalid_courier', 'long courier');
select throws_ok($$select log_parcel('aaaaaaaa-0000-0000-0000-0000000000f1', 'Amazon', null, null, (select id from visits where name = 'Rider B'))$$, 'P0001', 'not_authorized', 'visit of another flat rejected');
select lives_ok($$select log_parcel('aaaaaaaa-0000-0000-0000-0000000000f1', 'Flipkart', null, null, (select id from visits where name = 'Rider 1'))$$, 'parcel linked to own flat visit');
select throws_ok($$select log_parcel('bbbbbbbb-0000-0000-0000-0000000000f1', 'Amazon', null, null)$$, 'P0001', 'not_authorized', 'guard of another society cannot log');
select throws_ok($$select collect_parcel((select id from parcels where courier = 'Amazon'), '  ')$$, 'P0001', 'invalid_name', 'collect needs name');
select lives_ok($$select collect_parcel((select id from parcels where courier = 'Amazon'), ' Rahul ')$$, 'guard collects');
select is((select collected_by_name from parcels where courier = 'Amazon'), 'Rahul', 'collector trimmed');
select throws_ok($$select collect_parcel((select id from parcels where courier = 'Amazon'), 'Rahul')$$, 'P0001', 'already_collected', 'collect twice');
select throws_ok($$select return_parcel((select id from parcels where courier = 'Amazon'))$$, 'P0001', 'already_collected', 'return after collect');
select lives_ok($$select return_parcel((select id from parcels where courier = 'Flipkart'))$$, 'return at-gate parcel');
select is((select status::text from parcels where courier = 'Flipkart'), 'returned', 'status returned');
select throws_ok($$select collect_parcel((select id from parcels where courier = 'Flipkart'), 'Rahul')$$, 'P0001', 'already_collected', 'collect after return');
select throws_ok($$insert into parcels (society_id, flat_id, courier) values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'x')$$, '42501', null, 'direct insert revoked');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select is((select count(*)::int from parcels), 0, 'flat B sees 0 of A parcels');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select is((select count(*)::int from parcels), 2, 'flat A sees own parcels');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select is((select count(*)::int from parcels) + (select count(*)::int from expected_entries), 0, 'other society guard sees nothing');

-- ---------------------------------------------------------------- storage
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select lives_ok($$insert into storage.objects (bucket_id, name) values ('parcel-photos', 'aaaaaaaa-0000-0000-0000-000000000000/aaaaaaaa-0000-0000-0000-0000000000f1/p1.jpg')$$, 'guard uploads parcel photo');
select throws_ok($$insert into storage.objects (bucket_id, name) values ('parcel-photos', 'bbbbbbbb-0000-0000-0000-000000000000/bbbbbbbb-0000-0000-0000-0000000000f1/p2.jpg')$$, '42501', null, 'guard cannot upload into other society');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'parcel-photos'), 1, 'flat A resident reads its parcel photo');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'parcel-photos'), 0, 'other flat resident reads nothing');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'parcel-photos'), 0, 'other society guard reads nothing');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'parcel-photos'), 1, 'society guard reads');

select * from finish();
rollback;
