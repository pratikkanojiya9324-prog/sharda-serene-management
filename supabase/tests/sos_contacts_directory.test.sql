-- Migration 0022: SOS alerts, emergency contacts, opt-in resident directory.
begin;
select plan(35);

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
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'admina@staff.test'),
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'guarda@staff.test'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'flat-a1@login.test'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'flat-a2@login.test'),
  ('bbbbbbbb-0000-0000-0000-00000000e101', 'flat-b1@login.test'),
  ('cccccccc-0000-0000-0000-00000000e101', 'nobody@login.test');
insert into profiles (id, name) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'Admin A'),
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'Guard A'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'B1-A-101'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'B1-A-102'),
  ('bbbbbbbb-0000-0000-0000-00000000e101', 'B1-A-101'),
  ('cccccccc-0000-0000-0000-00000000e101', 'Nobody');
insert into memberships (profile_id, society_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'aaaaaaaa-0000-0000-0000-000000000000', 'admin'),
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'aaaaaaaa-0000-0000-0000-000000000000', 'guard'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('bbbbbbbb-0000-0000-0000-00000000e101', 'bbbbbbbb-0000-0000-0000-000000000000', 'resident');
insert into flat_residents (flat_id, profile_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000e101'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-00000000e102'),
  ('bbbbbbbb-0000-0000-0000-0000000000f1', 'bbbbbbbb-0000-0000-0000-00000000e101');
insert into family_members (id, society_id, flat_id, name, phone, relation, in_directory) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'Asha', '9000000001', 'Mother', false),
  ('aaaaaaaa-0000-0000-0000-0000000000c2', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f2', 'Neha', '9000000002', 'Self', false),
  ('bbbbbbbb-0000-0000-0000-0000000000c1', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000f1', 'Bob', '9000000003', 'Self', true);

create temp table keep (n text, id uuid);
grant select, insert on keep to authenticated;

-- ---------------------------------------------------------------- SOS
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
insert into keep select 'sos1', id from raise_sos('aaaaaaaa-0000-0000-0000-0000000000f1', 'medical', ' Asha ');
select is((select status::text from sos_alerts where id = (select id from keep where n = 'sos1')), 'open', 'raise_sos creates an open alert');
select is((select id from raise_sos('aaaaaaaa-0000-0000-0000-0000000000f1', 'fire')), (select id from keep where n = 'sos1'), 'raising again returns the same alert');
select is((select count(*)::int from sos_alerts), 1, 'still one row');
select throws_ok($$select raise_sos('aaaaaaaa-0000-0000-0000-0000000000f2', 'fire')$$, 'P0001', 'not_authorized', 'cannot raise for another flat');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select is((select count(*)::int from sos_alerts), 0, 'flat B cannot see flat A alert');
select throws_ok($$select ack_sos((select id from keep where n = 'sos1'))$$, 'P0001', 'not_authorized', 'resident cannot ack');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select is((select count(*)::int from sos_alerts), 1, 'guard sees the alert');
select is((select status::text from ack_sos((select id from keep where n = 'sos1'), ' Guard Ram ')), 'acknowledged', 'guard acks');
select is((select acknowledged_by_name from sos_alerts where id = (select id from keep where n = 'sos1')), 'Guard Ram', 'ack name stored');
select is((select status::text from ack_sos((select id from keep where n = 'sos1'))), 'acknowledged', 'ack again stays acknowledged');
select throws_ok($$select resolve_sos((select id from keep where n = 'sos1'), repeat('x', 301))$$, 'P0001', 'invalid_note', 'note over 300');
select is((select status::text from resolve_sos((select id from keep where n = 'sos1'), 'All clear', 'Guard Ram')), 'resolved', 'resolve');
select throws_ok($$select resolve_sos((select id from keep where n = 'sos1'))$$, 'P0001', 'sos_closed', 'resolve again');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok($$select cancel_sos((select id from keep where n = 'sos1'))$$, 'P0001', 'sos_closed', 'cancel after resolve');
insert into keep select 'sos2', id from raise_sos('aaaaaaaa-0000-0000-0000-0000000000f1', 'lift');
select isnt((select id from keep where n = 'sos2'), (select id from keep where n = 'sos1'), 'raise after resolve creates a new row');
select is((select status::text from cancel_sos((select id from keep where n = 'sos2'))), 'cancelled', 'cancel from open');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select throws_ok($$select ack_sos((select id from keep where n = 'sos2'))$$, 'P0001', 'sos_closed', 'ack a cancelled alert');

-- ---------------------------------------------------------------- contacts
select lives_ok($$select upsert_emergency_contact(null, 'Police', '112', null, 1)$$, 'phone 112 ok');
select lives_ok($$select upsert_emergency_contact(null, 'Clinic', '+911123456789', 'Open 24h', 2)$$, 'international phone ok');
select throws_ok($$select upsert_emergency_contact(null, 'X', '12', null, 0)$$, 'P0001', 'invalid_contact_phone', 'too short');
select throws_ok($$select upsert_emergency_contact(null, 'X', 'abc123', null, 0)$$, 'P0001', 'invalid_contact_phone', 'letters');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok($$select upsert_emergency_contact(null, 'Mine', '112', null, 0)$$, 'P0001', 'not_authorized', 'resident cannot upsert');
select is((select count(*)::int from emergency_contacts), 2, 'resident reads contacts');
select throws_ok($$select delete_emergency_contact((select id from emergency_contacts limit 1))$$, 'P0001', 'not_authorized', 'resident cannot delete');

-- ---------------------------------------------------------------- directory
select is((select in_directory from set_directory_visibility('aaaaaaaa-0000-0000-0000-0000000000c1', true, false)), true, 'opt in');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select results_eq($$select name, flat_label, phone from resident_directory()$$,
  $$values ('Asha'::text, 'B1-A-101'::text, null::text)$$, 'listed with null phone and flat label');
select throws_ok($$select set_directory_visibility('aaaaaaaa-0000-0000-0000-0000000000c1', false, false)$$, 'P0001', 'not_authorized', 'other flat cannot change visibility');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select is((select show_phone from set_directory_visibility('aaaaaaaa-0000-0000-0000-0000000000c1', false, true)), true, 'show_phone kept');
select is((select in_directory from family_members where id = 'aaaaaaaa-0000-0000-0000-0000000000c1'), true, 'show_phone forces in_directory');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select is((select phone from resident_directory() where name = 'Asha'), '9000000001', 'phone appears when shown');
select is((select count(*)::int from resident_directory() where name = 'Bob'), 0, 'other society never appears');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select is((select show_phone from set_directory_visibility('aaaaaaaa-0000-0000-0000-0000000000c1', false, false)), false, 'opt out clears show_phone');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select is((select count(*)::int from resident_directory()), 0, 'opted-out member is absent');

select set_config('request.jwt.claims', '{"sub":"cccccccc-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok($$select * from resident_directory()$$, 'P0001', 'not_authorized', 'no membership, no directory');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select results_eq($$select name from directory_committee()$$, $$values ('Admin A'::text)$$, 'committee lists admin names');

select * from finish();
rollback;
