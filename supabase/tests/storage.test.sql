begin;
select plan(5);

insert into societies (id, name) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Society A'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Society B');
insert into auth.users (id, phone) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', '910000000002'),
  ('bbbbbbbb-0000-0000-0000-00000000e101', '910000000003'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', '910000000004');
insert into profiles (id, name, phone) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'Guard A',    '+910000000002'),
  ('bbbbbbbb-0000-0000-0000-00000000e101', 'Resident B', '+910000000003'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'Resident A', '+910000000004');
insert into memberships (profile_id, society_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'aaaaaaaa-0000-0000-0000-000000000000', 'guard'),
  ('bbbbbbbb-0000-0000-0000-00000000e101', 'bbbbbbbb-0000-0000-0000-000000000000', 'resident'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);

select lives_ok(
  $$insert into storage.objects (bucket_id, name) values ('visitor-photos', 'aaaaaaaa-0000-0000-0000-000000000000/v1.jpg')$$,
  'guard A can upload under society A folder');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('visitor-photos', 'bbbbbbbb-0000-0000-0000-000000000000/v1.jpg')$$,
  '42501', null, 'guard A cannot upload under society B folder');
select throws_ok(
  $$insert into storage.objects (bucket_id, name) values ('visitor-photos', 'not-a-uuid/v1.jpg')$$,
  '42501', null, 'non-uuid folder is rejected');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'visitor-photos'), 1,
  'resident A (member of society A) can read society A object');

select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where bucket_id = 'visitor-photos'), 0,
  'resident B cannot read society A object');

select * from finish();
rollback;
