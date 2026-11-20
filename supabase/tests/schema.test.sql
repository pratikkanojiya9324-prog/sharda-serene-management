begin;
select plan(12);

select has_table('public'::name, t::name) from unnest(array[
  'societies','towers','flats','profiles','memberships',
  'flat_residents','invites','visits','passes','push_tokens'
]) as t;

insert into societies (id, name, address) values ('00000000-0000-0000-0000-000000000001', 'S', 'A');

select throws_ok(
  $$insert into invites (society_id, phone, name, role, flat_id)
    values ('00000000-0000-0000-0000-000000000001', '+919999999999', 'R', 'resident', null)$$,
  '23514', null, 'resident invite requires flat_id');

insert into towers (id, society_id, name) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-000000000001', 'T1');
insert into flats (id, society_id, tower_id, number) values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', '101');
insert into auth.users (id, phone) values ('00000000-0000-0000-0000-0000000000b1', '919999999998');
insert into profiles (id, name, phone) values ('00000000-0000-0000-0000-0000000000b1', 'P', '+919999999998');

select throws_ok(
  $$insert into passes (society_id, flat_id, created_by, guest_name, code, valid_from, valid_to)
    values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000f1',
            '00000000-0000-0000-0000-0000000000b1', 'G', '123456', now(), now())$$,
  '23514', null, 'pass valid_to must be after valid_from');

select * from finish();
rollback;
