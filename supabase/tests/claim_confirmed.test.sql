begin;
select plan(4);

insert into societies (id, name) values ('aaaaaaaa-0000-0000-0000-000000000000', 'Society A');
insert into auth.users (id, phone) values ('dddddddd-0000-0000-0000-000000000001', '919811111111');
insert into invites (society_id, phone, name, role) values
  ('aaaaaaaa-0000-0000-0000-000000000000', '+919811111111', 'Guard X', 'guard');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}', true);

select is(claim_invites(), 0, 'unconfirmed-phone user claims 0 invites');

reset role;
select is((select count(*)::int from memberships where profile_id = 'dddddddd-0000-0000-0000-000000000001'), 0,
  'no membership created for unconfirmed phone');
update auth.users set phone_confirmed_at = now() where id = 'dddddddd-0000-0000-0000-000000000001';

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"dddddddd-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is(claim_invites(), 1, 'same user claims the invite once the phone is confirmed');

reset role;
select is((select count(*)::int from memberships where profile_id = 'dddddddd-0000-0000-0000-000000000001' and role = 'guard'), 1,
  'membership created after confirmation');

select * from finish();
rollback;
