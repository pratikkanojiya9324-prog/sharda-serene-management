-- Migration 0010: respond_to_visit is blocked once the guard recorded an outcome.
begin;
select plan(3);

insert into societies (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Society A');
insert into towers (id, society_id, name) values
  ('aaaaaaaa-0000-0000-0000-0000000000a0', 'aaaaaaaa-0000-0000-0000-000000000000', 'TA');
insert into flats (id, society_id, tower_id, number) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a0', 'A1');
insert into auth.users (id, phone) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', '910000000002'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', '910000000003');
insert into profiles (id, name, phone) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'Guard A',     '+910000000002'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'Resident A1', '+910000000003');
insert into memberships (profile_id, society_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'aaaaaaaa-0000-0000-0000-000000000000', 'guard'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident');
insert into flat_residents (flat_id, profile_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000e101');

create temp table t (id uuid);
grant all on t to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);

insert into t select (create_visit('aaaaaaaa-0000-0000-0000-0000000000f1', 'Guest', null, 'guest', null)).id;
select is((select manual_outcome::text from record_manual_outcome((select id from t), 'allowed')), 'allowed',
  'guard records allowed while pending');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok(
  format($$select respond_to_visit(%L, 'denied')$$, (select id from t)),
  'P0001', 'already_responded', 'resident cannot respond after the guard decided');
reset role;
select is((select status::text from visits where id = (select id from t)), 'pending', 'status unchanged');

select * from finish();
rollback;
