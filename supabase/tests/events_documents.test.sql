-- Migration 0023: events with RSVPs, society documents.
begin;
select plan(45);

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
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'flat-a1@login.test'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'flat-a2@login.test'),
  ('bbbbbbbb-0000-0000-0000-00000000ad01', 'adminb@staff.test');
insert into profiles (id, name) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'Admin A'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'B1-A-101'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'B1-A-102'),
  ('bbbbbbbb-0000-0000-0000-00000000ad01', 'Admin B');
insert into memberships (profile_id, society_id, role) values
  ('aaaaaaaa-0000-0000-0000-00000000ad01', 'aaaaaaaa-0000-0000-0000-000000000000', 'admin'),
  ('aaaaaaaa-0000-0000-0000-00000000e101', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('aaaaaaaa-0000-0000-0000-00000000e102', 'aaaaaaaa-0000-0000-0000-000000000000', 'resident'),
  ('bbbbbbbb-0000-0000-0000-00000000ad01', 'bbbbbbbb-0000-0000-0000-000000000000', 'admin');
insert into flat_residents (flat_id, profile_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-00000000e101'),
  ('aaaaaaaa-0000-0000-0000-0000000000f2', 'aaaaaaaa-0000-0000-0000-00000000e102');
-- A = f1 (e101), B = f2 (e102)

create temp table ev (n text, id uuid);
grant select, insert on ev to authenticated;
create temp table doc (n text, id uuid);
grant select, insert on doc to authenticated;

-- ---------------------------------------------------------------- create_event
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok($$select create_event('Diwali', null, null, now() + interval '2 days', null)$$,
  'P0001', 'not_authorized', 'resident cannot create event');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select throws_ok($$select create_event(' ', null, null, now() + interval '2 days', null)$$,
  'P0001', 'invalid_title', 'blank title');
select throws_ok($$select create_event(repeat('x', 121), null, null, now() + interval '2 days', null)$$,
  'P0001', 'invalid_title', 'title over 120');
select throws_ok($$select create_event('Diwali', null, null, now() - interval '1 hour', null)$$,
  'P0001', 'invalid_time', 'start in the past');
select throws_ok($$select create_event('Diwali', null, null, null, null)$$,
  'P0001', 'invalid_time', 'null start');
select throws_ok($$select create_event('Diwali', null, null, now() + interval '2 days', now() + interval '1 day')$$,
  'P0001', 'invalid_time', 'ends before it starts');
select throws_ok($$select create_event('Diwali', null, null, now() + interval '2 days', now() + interval '2 days')$$,
  'P0001', 'invalid_time', 'ends equal to start');
select throws_ok($$select create_event('Diwali', repeat('x', 2001), null, now() + interval '2 days', null)$$,
  'P0001', 'invalid_note', 'description over 2000');
select throws_ok($$select create_event('Diwali', null, repeat('x', 121), now() + interval '2 days', null)$$,
  'P0001', 'invalid_note', 'place over 120');

insert into ev select 'main', id from create_event(' Diwali ', ' ', ' Club ', now() + interval '2 days', now() + interval '3 days');
insert into ev select 'second', id from create_event('Yoga', null, null, now() + interval '4 days', null);
select is((select title from events where id = (select id from ev where n = 'main')), 'Diwali', 'event created, title trimmed');
select is((select description from events where id = (select id from ev where n = 'main')), null, 'blank description stored null');
select is((select place from events where id = (select id from ev where n = 'main')), 'Club', 'place trimmed');

-- ---------------------------------------------------------------- RSVPs
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select is((select heads from rsvp_event((select id from ev where n='main'),'aaaaaaaa-0000-0000-0000-0000000000f1','going',3,'Asha')), 3, 'A going with 3');
select is((select response::text from rsvp_event((select id from ev where n='main'),'aaaaaaaa-0000-0000-0000-0000000000f1','maybe',2)), 'maybe', 'A changes to maybe');
select is((select count(*)::int from event_rsvps where flat_id = 'aaaaaaaa-0000-0000-0000-0000000000f1'), 1, 'one row per flat');
select throws_ok($$select rsvp_event((select id from ev where n='main'),'aaaaaaaa-0000-0000-0000-0000000000f1','going',0)$$,
  'P0001', 'invalid_heads', 'going with 0 heads');
select throws_ok($$select rsvp_event((select id from ev where n='main'),'aaaaaaaa-0000-0000-0000-0000000000f1','going',21)$$,
  'P0001', 'invalid_heads', 'going with 21 heads');
select throws_ok($$select rsvp_event((select id from ev where n='main'),'aaaaaaaa-0000-0000-0000-0000000000f1','maybe',null)$$,
  'P0001', 'invalid_heads', 'maybe with null heads');
select throws_ok($$select rsvp_event((select id from ev where n='main'),'aaaaaaaa-0000-0000-0000-0000000000f2','going',1)$$,
  'P0001', 'not_authorized', 'A cannot RSVP for flat B');
select throws_ok($$select rsvp_event((select id from ev where n='main'),'bbbbbbbb-0000-0000-0000-0000000000f1','going',1)$$,
  'P0001', 'not_authorized', 'cannot RSVP for another society flat');
select throws_ok($$select rsvp_event(gen_random_uuid(),'aaaaaaaa-0000-0000-0000-0000000000f1','going',1)$$,
  'P0001', 'not_authorized', 'unknown event');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select is((select heads from rsvp_event((select id from ev where n='main'),'aaaaaaaa-0000-0000-0000-0000000000f2','no',7)), 0, 'RSVP no stores heads 0');
select is((select count(*)::int from event_rsvps), 1, 'flat B sees only its own RSVP');
select is((select count(*)::int from event_rsvps where flat_id = 'aaaaaaaa-0000-0000-0000-0000000000f1'), 0, 'flat B cannot select A RSVP');

-- ---------------------------------------------------------------- event_summary
select is((event_summary((select id from ev where n='main')) ->> 'maybe_heads')::int, 2, 'summary maybe_heads 2');
select is(event_summary((select id from ev where n='main')) -> 'rsvps', 'null'::jsonb, 'resident gets rsvps null');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select is(jsonb_array_length(event_summary((select id from ev where n='main')) -> 'rsvps'), 2, 'admin gets the rsvp list');
select is((event_summary((select id from ev where n='main')) -> 'rsvps' -> 0 ->> 'flat_label'), 'B1-A-101', 'flat label built');
select is((event_summary((select id from ev where n='main')) ->> 'no_flats')::int, 1, 'summary no_flats');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select throws_ok($$select event_summary((select id from ev where n='main'))$$, 'P0001', 'not_authorized', 'other society cannot see summary');
select throws_ok($$select cancel_event((select id from ev where n='main'))$$, 'P0001', 'not_authorized', 'other society admin cannot cancel');

-- ---------------------------------------------------------------- cancel_event
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select ok((select cancelled_at from cancel_event((select id from ev where n='main'))) is not null, 'admin cancels event');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok($$select rsvp_event((select id from ev where n='main'),'aaaaaaaa-0000-0000-0000-0000000000f1','going',1)$$,
  'P0001', 'event_over', 'RSVP after cancel');
select throws_ok($$select cancel_event((select id from ev where n='second'))$$, 'P0001', 'not_authorized', 'resident cannot cancel');

-- ---------------------------------------------------------------- documents
select throws_ok($$select add_document('Bylaws','bylaws','aaaaaaaa-0000-0000-0000-000000000000/b.pdf','pdf')$$,
  'P0001', 'not_authorized', 'resident cannot add document');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select throws_ok($$select add_document('Bylaws','bylaws','bbbbbbbb-0000-0000-0000-000000000000/b.pdf','pdf')$$,
  'P0001', 'invalid_file', 'path under another society');
select throws_ok($$select add_document('Bylaws','bylaws','aaaaaaaa-0000-0000-0000-000000000000/b.doc','doc')$$,
  'P0001', 'invalid_file', 'bad file kind');
select throws_ok($$select add_document(' ','bylaws','aaaaaaaa-0000-0000-0000-000000000000/b.pdf','pdf')$$,
  'P0001', 'invalid_title', 'blank document title');
insert into doc select 'b', id from add_document(' Bylaws ','bylaws','aaaaaaaa-0000-0000-0000-000000000000/b.pdf','pdf');
select is((select title from documents where id = (select id from doc where n='b')), 'Bylaws', 'document added');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select is((select count(*)::int from documents), 1, 'resident can list documents');
select throws_ok($$select delete_document((select id from doc where n='b'))$$, 'P0001', 'not_authorized', 'resident cannot delete document');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select is(delete_document((select id from doc where n='b')), 'aaaaaaaa-0000-0000-0000-000000000000/b.pdf', 'delete_document returns the path');

-- ---------------------------------------------------------------- storage
select lives_ok($$insert into storage.objects (bucket_id, name) values ('society-docs', 'aaaaaaaa-0000-0000-0000-000000000000/b.pdf')$$,
  'admin can upload to society-docs');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok($$insert into storage.objects (bucket_id, name) values ('society-docs', 'aaaaaaaa-0000-0000-0000-000000000000/c.pdf')$$,
  '42501', null, 'resident cannot upload to society-docs');
select is((select count(*)::int from storage.objects where bucket_id = 'society-docs'), 1, 'member can read society-docs');

select * from finish();
rollback;
