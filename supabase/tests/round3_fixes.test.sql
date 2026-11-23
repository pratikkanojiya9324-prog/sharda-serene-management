-- Migration 0025: Round 3 fix wave — directory flags are resident-only.
begin;
select plan(8);

insert into societies (id, name) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Society A');
insert into towers (id, society_id, name) values
  ('aaaaaaaa-0000-0000-0000-0000000000a0', 'aaaaaaaa-0000-0000-0000-000000000000', 'A');
insert into flats (id, society_id, tower_id, number) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a0', '101');
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'admina@staff.test'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'flat-a1@login.test');
insert into profiles (id, name) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'Admin A'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'B1-A-101');
insert into memberships (profile_id, society_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'aaaaaaaa-0000-0000-0000-000000000000', 'admin'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident');
insert into flat_residents (flat_id, profile_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000e101');
insert into family_members (id, society_id, flat_id, name, phone, relation) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'Asha', '9000000001', 'Mother');

-- ---------------------------------------------------------------- admin direct writes
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select throws_ok($$update family_members set show_phone = true where id = 'aaaaaaaa-0000-0000-0000-0000000000c1'$$, '42501', null, 'admin cannot set show_phone directly');
select throws_ok($$update family_members set in_directory = true where id = 'aaaaaaaa-0000-0000-0000-0000000000c1'$$, '42501', null, 'admin cannot set in_directory directly');
select throws_ok($$insert into family_members (society_id, flat_id, name, in_directory) values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'X', true)$$, '42501', null, 'admin cannot insert a member already in the directory');
select lives_ok($$update family_members set name = 'Asha K', phone = '9000000009', relation = 'Mom' where id = 'aaaaaaaa-0000-0000-0000-0000000000c1'$$, 'admin updates name, phone, relation');
select is((select name from family_members where id = 'aaaaaaaa-0000-0000-0000-0000000000c1'), 'Asha K', 'name updated');
select lives_ok($$insert into family_members (society_id, flat_id, name, phone, relation) values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000f1', 'Ravi', null, 'Son')$$, 'admin inserts a member without flags');

-- ---------------------------------------------------------------- resident RPC still works
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select is((select show_phone from set_directory_visibility('aaaaaaaa-0000-0000-0000-0000000000c1', true, true)), true, 'set_directory_visibility still works');
select throws_ok($$update family_members set in_directory = false where id = 'aaaaaaaa-0000-0000-0000-0000000000c1'$$, '42501', null, 'resident has no direct update of flags');

select * from finish();
rollback;
