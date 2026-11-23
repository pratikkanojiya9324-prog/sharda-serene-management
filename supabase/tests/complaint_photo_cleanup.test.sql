-- Migration 0017: owners can delete unreferenced complaint photos only.
begin;
select plan(4);

insert into societies (id, name) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Society A');
insert into towers (id, society_id, name) values
  ('aaaaaaaa-0000-0000-0000-0000000000a0', 'aaaaaaaa-0000-0000-0000-000000000000', 'A');
insert into flats (id, society_id, tower_id, number) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a0', '101'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a0', '102');
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'flat-a1@login.test'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'flat-a2@login.test');
insert into profiles (id, name) values
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'B1-A-101'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'B1-A-102');
insert into memberships (profile_id, society_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident');
insert into flat_residents (flat_id, profile_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000e101'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-00000000e102');

insert into storage.objects (bucket_id, name, owner_id) values
  ('complaint-photos', 'aaaaaaaa-0000-0000-0000-000000000000/aaaaaaaa-0000-0000-0000-0000000000f1/free.jpg', 'aaaaaaaa-0000-0000-0000-00000000e101'),
  ('complaint-photos', 'aaaaaaaa-0000-0000-0000-000000000000/aaaaaaaa-0000-0000-0000-0000000000f1/used.jpg', 'aaaaaaaa-0000-0000-0000-00000000e101'),
  ('complaint-photos', 'aaaaaaaa-0000-0000-0000-000000000000/aaaaaaaa-0000-0000-0000-0000000000f2/theirs.jpg', 'aaaaaaaa-0000-0000-0000-00000000e102');

-- The Storage API sets this flag; a plain DELETE is otherwise blocked by storage.protect_delete().
select set_config('storage.allow_delete_query', 'true', true);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select create_complaint('aaaaaaaa-0000-0000-0000-0000000000f1', 'plumbing', 'Leak',
  'aaaaaaaa-0000-0000-0000-000000000000/aaaaaaaa-0000-0000-0000-0000000000f1/used.jpg');

delete from storage.objects where bucket_id = 'complaint-photos' and name like '%/free.jpg';
select is((select count(*)::int from storage.objects where name like '%/free.jpg'), 0,
  'owner deletes an unreferenced own photo');

delete from storage.objects where bucket_id = 'complaint-photos' and name like '%/used.jpg';
select is((select count(*)::int from storage.objects where name like '%/used.jpg'), 1,
  'cannot delete a photo a complaint references');

delete from storage.objects where bucket_id = 'complaint-photos' and name like '%/theirs.jpg';
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select is((select count(*)::int from storage.objects where name like '%/theirs.jpg'), 1,
  'cannot delete another user''s photo');

delete from storage.objects where bucket_id = 'complaint-photos' and name like '%/theirs.jpg';
select is((select count(*)::int from storage.objects where name like '%/theirs.jpg'), 0,
  'the other owner can delete their own unreferenced photo');

select * from finish();
rollback;
