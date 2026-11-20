-- Migration 0009: storage policies guard the uuid cast with CASE.
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

select ok(
  (select qual ilike '%case%' from pg_policies where tablename = 'objects' and policyname = 'visitor_photos_member_select'),
  'select policy uses CASE');
select ok(
  (select with_check ilike '%case%' from pg_policies where tablename = 'objects' and policyname = 'visitor_photos_guard_insert'),
  'insert policy uses CASE');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('visitor-photos', 'zzzzzzzz-0000-0000-0000-000000000000/v.jpg')$$,
  '42501', null, 'non-uuid folder is denied (no cast error)');

select * from finish();
rollback;
