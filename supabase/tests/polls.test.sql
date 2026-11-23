-- Migration 0020: secret one-vote-per-flat polls.
begin;
select plan(60);

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
  ('aaaaaaaa-0000-0000-0000-0000000000f4', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a0', '104'),
  ('bbbbbbbb-0000-0000-0000-0000000000f1', 'bbbbbbbb-0000-0000-0000-000000000000', 'bbbbbbbb-0000-0000-0000-0000000000b0', '101');
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'admina@staff.test'),
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'guarda@staff.test'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'flat-a1@login.test'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'flat-a2@login.test'),
  ('aaaaaaaa-0000-0000-0000-00000000e103', 'flat-a3@login.test'),
  ('bbbbbbbb-0000-0000-0000-00000000ad01', 'adminb@staff.test');
insert into profiles (id, name) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'Admin A'),
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'Guard A'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'B1-A-101'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'B1-A-102'),
  ('aaaaaaaa-0000-0000-0000-00000000e103', 'B1-A-103'),
  ('bbbbbbbb-0000-0000-0000-00000000ad01', 'Admin B');
insert into memberships (profile_id, society_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'aaaaaaaa-0000-0000-0000-000000000000', 'admin'),
  ('aaaaaaaa-0000-0000-0000-00000000a901', 'aaaaaaaa-0000-0000-0000-000000000000', 'guard'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('aaaaaaaa-0000-0000-0000-00000000e103', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('bbbbbbbb-0000-0000-0000-00000000ad01', 'bbbbbbbb-0000-0000-0000-000000000000', 'admin');
insert into flat_residents (flat_id, profile_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000e101'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-00000000e102'),
  ('aaaaaaaa-0000-0000-0000-0000000000f3', 'aaaaaaaa-0000-0000-0000-00000000e103');
-- A = f1 (e101), B = f2 (e102), C = f3 (e103); f4 has no residents.

-- ---------------------------------------------------------------- create_poll
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok($$select create_poll('Q?', null, array['a','b'], false, 1, now() + interval '1 day')$$, 'P0001', 'not_authorized', 'resident cannot create');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select throws_ok($$select create_poll('Q?', null, array['a'], false, 1, now() + interval '1 day')$$, 'P0001', 'invalid_options', '1 option rejected');
select throws_ok($$select create_poll('Q?', null, array['a','b','c','d','e','f','g'], false, 1, now() + interval '1 day')$$, 'P0001', 'invalid_options', '7 options rejected');
select throws_ok($$select create_poll('Q?', null, array['a',' '], false, 1, now() + interval '1 day')$$, 'P0001', 'invalid_options', 'blank option rejected');
select throws_ok($$select create_poll('Q?', null, array['a',repeat('x',81)], false, 1, now() + interval '1 day')$$, 'P0001', 'invalid_options', 'long option rejected');
select throws_ok($$select create_poll('  ', null, array['a','b'], false, 1, now() + interval '1 day')$$, 'P0001', 'invalid_question', 'blank question rejected');
select throws_ok($$select create_poll(repeat('x',201), null, array['a','b'], false, 1, now() + interval '1 day')$$, 'P0001', 'invalid_question', 'long question rejected');
select throws_ok($$select create_poll('Q?', null, array['a','b'], false, 1, now() - interval '1 minute')$$, 'P0001', 'invalid_time', 'past closes_at rejected');
select throws_ok($$select create_poll('Q?', null, array['a','b'], false, 1, now() + interval '91 days')$$, 'P0001', 'invalid_time', 'closes_at beyond 90 days rejected');
select throws_ok($$select create_poll('Q?', null, array['a','b','c'], true, 4, now() + interval '1 day')$$, 'P0001', 'invalid_choice', 'max 4 on 3 options rejected');
select throws_ok($$select create_poll('Q?', null, array['a','b','c'], true, 0, now() + interval '1 day')$$, 'P0001', 'invalid_choice', 'max 0 rejected');

select lives_ok($$select create_poll(' Painting? ', ' colour ', array['Red',' Blue '], false, 5, now() + interval '1 day')$$, 'admin creates single-choice poll');
select is((select question from polls), 'Painting?', 'question trimmed');
select is((select max_choices from polls), 1, 'max_choices forced to 1 when not multi');
select is((select options->1->>'label' from polls), 'Blue', 'option label trimmed');
select lives_ok($$select create_poll('Pick two', null, array['x','y','z'], true, 2, now() + interval '1 day')$$, 'admin creates multi poll');
select throws_ok($$insert into polls (society_id, question, options, closes_at) values ('aaaaaaaa-0000-0000-0000-000000000000', 'x', '[]', now())$$, '42501', null, 'direct insert revoked');

-- ---------------------------------------------------------------- voting
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select is((select count(*)::int from polls), 2, 'residents see polls');
create temp table p1 as select id, (options->0->>'id')::uuid as o1, (options->1->>'id')::uuid as o2 from polls where question = 'Painting?';
create temp table p2 as select id, (options->0->>'id')::uuid as o1, (options->1->>'id')::uuid as o2, (options->2->>'id')::uuid as o3 from polls where question = 'Pick two';
grant select on p1, p2 to authenticated;

select throws_ok($$select vote_poll((select id from p1), 'aaaaaaaa-0000-0000-0000-0000000000f2', array[(select o1 from p1)])$$, 'P0001', 'not_authorized', 'cannot vote for another flat');
select throws_ok($$select vote_poll((select id from p1), 'aaaaaaaa-0000-0000-0000-0000000000f1', array[]::uuid[])$$, 'P0001', 'invalid_choice', 'empty vote rejected');
select throws_ok($$select vote_poll((select id from p1), 'aaaaaaaa-0000-0000-0000-0000000000f1', array[gen_random_uuid()])$$, 'P0001', 'invalid_choice', 'unknown option rejected');
select throws_ok($$select vote_poll((select id from p2), 'aaaaaaaa-0000-0000-0000-0000000000f1', array[(select o1 from p2),(select o1 from p2)])$$, 'P0001', 'invalid_choice', 'duplicate option rejected');
select throws_ok($$select vote_poll((select id from p1), 'aaaaaaaa-0000-0000-0000-0000000000f1', array[(select o1 from p1),(select o2 from p1)])$$, 'P0001', 'too_many_choices', 'single-choice with 2 ids rejected');
select throws_ok($$select vote_poll((select id from p2), 'aaaaaaaa-0000-0000-0000-0000000000f1', array[(select o1 from p2),(select o2 from p2),(select o3 from p2)])$$, 'P0001', 'too_many_choices', 'multi over max rejected');
select throws_ok($$select vote_poll((select id from p1), 'aaaaaaaa-0000-0000-0000-0000000000f1', array[(select o1 from p1)], repeat('x', 61))$$, 'P0001', 'invalid_actor_name', 'long actor name rejected');
select lives_ok($$select vote_poll((select id from p1), 'aaaaaaaa-0000-0000-0000-0000000000f1', array[(select o1 from p1)], ' Asha ')$$, 'flat A votes');
select throws_ok($$select vote_poll((select id from p1), 'aaaaaaaa-0000-0000-0000-0000000000f1', array[(select o2 from p1)])$$, 'P0001', 'already_voted', 'A cannot vote twice');
select is((poll_results((select id from p1), 'aaaaaaaa-0000-0000-0000-0000000000f1')->'my_vote'->>'voted_by_name'), 'Asha', 'A my_vote set');
select is((poll_results((select id from p1), 'aaaaaaaa-0000-0000-0000-0000000000f1')->'counts'->>(select o1::text from p1))::int, 1, 'A sees chosen count 1');
select is((poll_results((select id from p1), 'aaaaaaaa-0000-0000-0000-0000000000f1')->'counts'->>(select o2::text from p1))::int, 0, 'A sees other count 0');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select is((poll_results((select id from p1), 'aaaaaaaa-0000-0000-0000-0000000000f2')->'counts'), 'null'::jsonb, 'B before voting gets counts null');
select is((poll_results((select id from p1), 'aaaaaaaa-0000-0000-0000-0000000000f2')->>'voted_flats')::int, 1, 'B sees voted_flats 1');
select is((poll_results((select id from p1), 'aaaaaaaa-0000-0000-0000-0000000000f2')->'not_voted'), 'null'::jsonb, 'resident gets no not_voted');
select is((poll_results((select id from p1), 'aaaaaaaa-0000-0000-0000-0000000000f2')->'my_vote'), 'null'::jsonb, 'B my_vote null');
select throws_ok($$select poll_results((select id from p1), 'aaaaaaaa-0000-0000-0000-0000000000f1')$$, 'P0001', 'not_authorized', 'B cannot read results as flat A');
select throws_ok($$select poll_results((select id from p1))$$, 'P0001', 'not_authorized', 'resident without flat not authorized');

-- ---------------------------------------------------------------- secrecy
select is((select count(*)::int from poll_votes), 0, 'B cannot select A vote');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select is((select count(*)::int from poll_votes), 0, 'admin cannot select votes');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select is((select count(*)::int from poll_votes), 1, 'A sees only own flat vote row');

-- ---------------------------------------------------------------- admin results
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select ok((poll_results((select id from p1))->'not_voted') @> '"B1-A-102"'::jsonb, 'not_voted has B label');
select ok(not ((poll_results((select id from p1))->'not_voted') @> '"B1-A-101"'::jsonb), 'not_voted lacks A label');
select is((poll_results((select id from p1))->>'total_flats')::int, 3, 'total_flats counts only flats with residents');
select is((poll_results((select id from p1))->'counts'), 'null'::jsonb, 'admin gets no counts while open');
select is((poll_results((select id from p1))->>'voted_flats')::int, 1, 'admin sees turnout while open');

-- ---------------------------------------------------------------- reminders
select lives_ok($$select remind_poll((select id from p1))$$, 'first reminder ok');
select throws_ok($$select remind_poll((select id from p1))$$, 'P0001', 'remind_too_soon', 'second reminder too soon');

-- ---------------------------------------------------------------- guard / cross-society
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select throws_ok($$select poll_results((select id from p1))$$, 'P0001', 'not_authorized', 'guard cannot read results');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select throws_ok($$select close_poll((select id from p1))$$, 'P0001', 'not_authorized', 'other society admin cannot close');
select throws_ok($$select poll_results((select id from p1))$$, 'P0001', 'not_authorized', 'other society admin cannot read results');

-- ---------------------------------------------------------------- closing
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select lives_ok($$select close_poll((select id from p1))$$, 'admin closes');
select is((poll_results((select id from p1))->'counts'->>(select o1::text from p1))::int, 1, 'admin sees counts after close');
select throws_ok($$select close_poll((select id from p1))$$, 'P0001', 'poll_closed', 'close again rejected');
select throws_ok($$select remind_poll((select id from p1))$$, 'P0001', 'poll_closed', 'remind closed rejected');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select throws_ok($$select vote_poll((select id from p1), 'aaaaaaaa-0000-0000-0000-0000000000f2', array[(select o1 from p1)])$$, 'P0001', 'poll_closed', 'B cannot vote after close');
select is((poll_results((select id from p1), 'aaaaaaaa-0000-0000-0000-0000000000f2')->'counts'->>(select o1::text from p1))::int, 1, 'B sees counts after close');

-- expiry by time
reset role;
update polls set closes_at = now() - interval '1 minute' where id = (select id from p2);
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e103","role":"authenticated"}', true);
select throws_ok($$select vote_poll((select id from p2), 'aaaaaaaa-0000-0000-0000-0000000000f3', array[(select o1 from p2)])$$, 'P0001', 'poll_closed', 'vote after closes_at rejected');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select throws_ok($$select close_poll((select id from p2))$$, 'P0001', 'poll_closed', 'close past-deadline poll rejected');

-- turnout: a vote from a flat that no longer has residents is not counted
reset role;
delete from flat_residents where flat_id = 'aaaaaaaa-0000-0000-0000-0000000000f1';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select is((poll_results((select id from p1))->>'voted_flats')::int, 0, 'voted_flats ignores flats without residents');

-- ---------------------------------------------------------------- delete cascades
select lives_ok($$select delete_poll((select id from p1))$$, 'admin deletes poll');
reset role;
select is((select count(*)::int from poll_votes where poll_id = (select id from p1)), 0, 'votes cascade on delete');

select * from finish();
rollback;
