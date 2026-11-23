-- Migration 0021: amenity booking with slot grid and approvals.
begin;
select plan(64);

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

create function pg_temp.ist(p_day int, p_time time) returns timestamptz language sql stable as
$f$ select (((now() at time zone 'Asia/Kolkata')::date + p_day + p_time) at time zone 'Asia/Kolkata') $f$;
create temp table am (n text, id uuid);
grant select, insert on am to authenticated;

-- ---------------------------------------------------------------- upsert_amenity
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok($$select upsert_amenity(null,'Court',null,'06:00','22:00',60,false,2,null,true)$$, 'P0001', 'not_authorized', 'resident cannot upsert');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select throws_ok($$select upsert_amenity(null,' ',null,'06:00','22:00',60,false,2,null,true)$$, 'P0001', 'invalid_name', 'blank name');
select throws_ok($$select upsert_amenity(null,'X',null,'06:00','22:00',45,false,2,null,true)$$, 'P0001', 'invalid_slot', 'slot 45');
select throws_ok($$select upsert_amenity(null,'X',null,'22:00','06:00',60,false,2,null,true)$$, 'P0001', 'invalid_time', 'open after close');
select throws_ok($$select upsert_amenity(null,'X',null,'06:00','06:00',60,false,2,null,true)$$, 'P0001', 'invalid_time', 'open equals close');
select throws_ok($$select upsert_amenity(null,'X',null,'06:00','06:30',60,false,2,null,true)$$, 'P0001', 'invalid_time', 'window shorter than a slot');
select throws_ok($$select upsert_amenity(null,'X',null,'06:00','22:00',60,false,0,null,true)$$, 'P0001', 'invalid_limit', 'limit 0');
select throws_ok($$select upsert_amenity(gen_random_uuid(),'X',null,'06:00','22:00',60,false,2,null,true)$$, 'P0001', 'not_authorized', 'unknown id');

insert into am select 'court', id from upsert_amenity(null,' Court ',null,'06:00','22:00',60,false,2,null,true);
insert into am select 'hall', id from upsert_amenity(null,'Hall','Big','08:00','22:00',1440,true,2,'Rs 2000',true);
insert into am select 'pool', id from upsert_amenity(null,'Pool',null,'00:00','23:00',30,false,2,null,true);
select is((select name from amenities where id = (select id from am where n = 'court')), 'Court', 'amenity created, name trimmed');
select is((select fee_note from upsert_amenity((select id from am where n = 'court'),'Court',null,'06:00','22:00',60,false,2,'Rs 50',true)), 'Rs 50', 'amenity updated by id');
select is((select count(*)::int from amenities), 3, 'admin sees amenities');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select is((select count(*)::int from amenities), 3, 'resident sees amenities');
select throws_ok($$insert into amenities (society_id,name,open_time,close_time,slot_minutes) values ('aaaaaaaa-0000-0000-0000-000000000000','x','06:00','07:00',60)$$, '42501', null, 'direct insert revoked');

-- ---------------------------------------------------------------- booking basics
select is((select status::text from book_amenity((select id from am where n = 'court'), 'aaaaaaaa-0000-0000-0000-0000000000f1', pg_temp.ist(1,'18:00'), ' Asha ')), 'confirmed', 'A books tomorrow 18:00 (confirmed)');
select is((select booked_by_name from amenity_bookings where flat_id = 'aaaaaaaa-0000-0000-0000-0000000000f1'), 'Asha', 'actor name stored trimmed');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select throws_ok($$select book_amenity((select id from am where n='court'),'aaaaaaaa-0000-0000-0000-0000000000f2',pg_temp.ist(1,'18:00'))$$, 'P0001', 'slot_taken', 'B same slot');
select throws_ok($$select book_amenity((select id from am where n='court'),'aaaaaaaa-0000-0000-0000-0000000000f2',pg_temp.ist(1,'18:30'))$$, 'P0001', 'bad_slot', '18:30 off grid');
select throws_ok($$select book_amenity((select id from am where n='court'),'aaaaaaaa-0000-0000-0000-0000000000f2',pg_temp.ist(1,'05:00'))$$, 'P0001', 'outside_hours', '05:00 before open');
select throws_ok($$select book_amenity((select id from am where n='court'),'aaaaaaaa-0000-0000-0000-0000000000f2',pg_temp.ist(15,'18:00'))$$, 'P0001', 'too_far_ahead', 'day +15');
select throws_ok($$select book_amenity((select id from am where n='court'),'aaaaaaaa-0000-0000-0000-0000000000f2',pg_temp.ist(0,'00:00'))$$, 'P0001', 'in_past', 'earlier today');
select throws_ok($$select book_amenity((select id from am where n='court'),'aaaaaaaa-0000-0000-0000-0000000000f2',pg_temp.ist(-1,'10:00'))$$, 'P0001', 'in_past', 'yesterday');
select throws_ok($$select book_amenity((select id from am where n='court'),'aaaaaaaa-0000-0000-0000-0000000000f1',pg_temp.ist(2,'10:00'))$$, 'P0001', 'not_authorized', 'B cannot book for flat A');
select throws_ok($$select book_amenity(gen_random_uuid(),'aaaaaaaa-0000-0000-0000-0000000000f2',pg_temp.ist(2,'10:00'))$$, 'P0001', 'not_authorized', 'unknown amenity');
select lives_ok($$select book_amenity((select id from am where n='court'),'aaaaaaaa-0000-0000-0000-0000000000f2',pg_temp.ist(14,'10:00'))$$, 'B books day +14');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select lives_ok($$select book_amenity((select id from am where n='court'),'aaaaaaaa-0000-0000-0000-0000000000f1',pg_temp.ist(1,'19:00'))$$, 'A books tomorrow 19:00');
select throws_ok($$select book_amenity((select id from am where n='court'),'aaaaaaaa-0000-0000-0000-0000000000f1',pg_temp.ist(1,'20:00'))$$, 'P0001', 'booking_limit', 'third upcoming booking');

-- ---------------------------------------------------------------- amenity_slots
select is((select state from amenity_slots((select id from am where n='court'), (now() at time zone 'Asia/Kolkata')::date + 1, 'aaaaaaaa-0000-0000-0000-0000000000f1') where start_at = pg_temp.ist(1,'18:00')), 'mine', 'A sees own slot as mine');
select is((select state from amenity_slots((select id from am where n='court'), (now() at time zone 'Asia/Kolkata')::date + 1, 'aaaaaaaa-0000-0000-0000-0000000000f1') where start_at = pg_temp.ist(1,'17:00')), 'free', 'free slot');
select is((select count(*)::int from amenity_slots((select id from am where n='court'), (now() at time zone 'Asia/Kolkata')::date + 1, 'aaaaaaaa-0000-0000-0000-0000000000f1')), 16, '16 hourly slots 06-22');
select is((select count(*)::int from amenity_slots((select id from am where n='court'), (now() at time zone 'Asia/Kolkata')::date - 1) where state = 'past'), 16, 'yesterday all past (no flat)');
select throws_ok($$select * from amenity_slots((select id from am where n='court'), current_date, 'aaaaaaaa-0000-0000-0000-0000000000f2')$$, 'P0001', 'not_authorized', 'slots for a flat that is not mine');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select is((select state from amenity_slots((select id from am where n='court'), (now() at time zone 'Asia/Kolkata')::date + 1, 'aaaaaaaa-0000-0000-0000-0000000000f2') where start_at = pg_temp.ist(1,'18:00')), 'taken', 'B sees A slot as taken');
select is((select state from amenity_slots((select id from am where n='court'), (now() at time zone 'Asia/Kolkata')::date + 1) where start_at = pg_temp.ist(1,'18:00')), 'taken', 'no flat: taken');

-- ---------------------------------------------------------------- cancel
create temp table bk as select id from amenity_bookings where false;
grant select, insert on bk to authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
insert into bk select id from amenity_bookings where flat_id = 'aaaaaaaa-0000-0000-0000-0000000000f1' and start_at = pg_temp.ist(1,'19:00');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select throws_ok($$select cancel_booking((select id from bk))$$, 'P0001', 'not_authorized', 'B cannot cancel A booking');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select is((select status::text from cancel_booking((select id from bk))), 'cancelled', 'A cancels 19:00');
select throws_ok($$select cancel_booking((select id from bk))$$, 'P0001', 'already_cancelled', 'cancel twice');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select lives_ok($$select book_amenity((select id from am where n='court'),'aaaaaaaa-0000-0000-0000-0000000000f2',pg_temp.ist(1,'19:00'))$$, 'freed slot can be booked again');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select lives_ok($$select book_amenity((select id from am where n='court'),'aaaaaaaa-0000-0000-0000-0000000000f1',pg_temp.ist(1,'20:00'))$$, 'A can book again after cancel (limit freed)');

-- already started: a past booking inserted directly as superuser
reset role;
insert into amenity_bookings (society_id, amenity_id, flat_id, start_at, end_at, status)
  select 'aaaaaaaa-0000-0000-0000-000000000000', id, 'aaaaaaaa-0000-0000-0000-0000000000f3',
         pg_temp.ist(-1,'10:00'), pg_temp.ist(-1,'11:00'), 'confirmed' from am where n = 'court';
create temp table old as select id from amenity_bookings where start_at = pg_temp.ist(-1,'10:00');
grant select on old to authenticated;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e103","role":"authenticated"}', true);
select throws_ok($$select cancel_booking((select id from old))$$, 'P0001', 'already_started', 'cancel past booking');

-- ---------------------------------------------------------------- hours edges
select lives_ok($$select book_amenity((select id from am where n='court'),'aaaaaaaa-0000-0000-0000-0000000000f3',pg_temp.ist(1,'21:00'))$$, 'C books 21:00 (ends at close)');
select throws_ok($$select book_amenity((select id from am where n='court'),'aaaaaaaa-0000-0000-0000-0000000000f3',pg_temp.ist(1,'22:00'))$$, 'P0001', 'outside_hours', '22:00 after close');
select is((select count(*)::int from amenity_bookings where flat_id = 'aaaaaaaa-0000-0000-0000-0000000000f1'), 0, 'C cannot see flat A bookings');
select lives_ok($$select book_amenity((select id from am where n='pool'),'aaaaaaaa-0000-0000-0000-0000000000f3',pg_temp.ist(1,'00:30'))$$, 'pool 00:30 tomorrow (IST boundary)');
select is((select (start_at at time zone 'Asia/Kolkata')::date from amenity_bookings where amenity_id = (select id from am where n='pool')), (now() at time zone 'Asia/Kolkata')::date + 1, '00:30 IST counts as tomorrow');
select is((select state from amenity_slots((select id from am where n='pool'), (now() at time zone 'Asia/Kolkata')::date + 1, 'aaaaaaaa-0000-0000-0000-0000000000f3') where start_at = pg_temp.ist(1,'00:30')), 'mine', 'pool 00:30 slot is mine on tomorrow');
select lives_ok($$select book_amenity((select id from am where n='pool'),'aaaaaaaa-0000-0000-0000-0000000000f3',pg_temp.ist(1,'22:30'))$$, 'pool 22:30 valid');
select throws_ok($$select book_amenity((select id from am where n='pool'),'aaaaaaaa-0000-0000-0000-0000000000f3',pg_temp.ist(1,'23:00'))$$, 'P0001', 'outside_hours', 'pool 23:00 outside');
select is((select count(*)::int from amenity_slots((select id from am where n='pool'), (now() at time zone 'Asia/Kolkata')::date + 1, 'aaaaaaaa-0000-0000-0000-0000000000f3')), 46, '46 half-hour slots 00-23');

-- ---------------------------------------------------------------- hall (full day, approval)
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e101","role":"authenticated"}', true);
select throws_ok($$select book_amenity((select id from am where n='hall'),'aaaaaaaa-0000-0000-0000-0000000000f1',pg_temp.ist(2,'09:00'))$$, 'P0001', 'bad_slot', 'hall start must equal open time');
select is((select status::text from book_amenity((select id from am where n='hall'), 'aaaaaaaa-0000-0000-0000-0000000000f1', pg_temp.ist(2,'08:00'))), 'pending', 'hall booking pending');
select is((select count(*)::int from amenity_slots((select id from am where n='hall'), (now() at time zone 'Asia/Kolkata')::date + 2, 'aaaaaaaa-0000-0000-0000-0000000000f1')), 1, 'hall has one slot');
select is((select state from amenity_slots((select id from am where n='hall'), (now() at time zone 'Asia/Kolkata')::date + 2, 'aaaaaaaa-0000-0000-0000-0000000000f1')), 'mine', 'pending hall slot is mine');

create temp table hb as select id from amenity_bookings where amenity_id = (select id from am where n='hall');
grant select on hb to authenticated;
select throws_ok($$select decide_booking((select id from hb), true)$$, 'P0001', 'not_authorized', 'resident cannot decide');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select throws_ok($$select decide_booking((select id from hb), false, repeat('x',201))$$, 'P0001', 'invalid_reason', 'long reason');
select is((select status::text from decide_booking((select id from hb), false, ' Date clash ')), 'rejected', 'admin rejects');
select is((select reject_reason from amenity_bookings where id = (select id from hb)), 'Date clash', 'reason stored trimmed');
select throws_ok($$select decide_booking((select id from hb), true)$$, 'P0001', 'not_pending', 'decide twice');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e102","role":"authenticated"}', true);
select lives_ok($$select book_amenity((select id from am where n='hall'),'aaaaaaaa-0000-0000-0000-0000000000f2',pg_temp.ist(2,'08:00'))$$, 'B books hall slot freed by rejection');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
create temp table hb2 as select id from amenity_bookings where status = 'pending';
grant select on hb2 to authenticated;
select is((select status::text from decide_booking((select id from hb2), true)), 'confirmed', 'admin approves');
select is((select decided_by from amenity_bookings where id = (select id from hb2)), 'aaaaaaaa-0000-0000-0000-00000000ad01'::uuid, 'decided_by recorded');

select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000a901","role":"authenticated"}', true);
select ok((select count(*) from amenity_bookings) >= 6, 'guard sees society bookings');

-- ---------------------------------------------------------------- inactive + cross-society
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select is((select active from upsert_amenity((select id from am where n='pool'),'Pool',null,'00:00','23:00',30,false,2,null,false)), false, 'pool deactivated');
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-00000000e103","role":"authenticated"}', true);
select throws_ok($$select book_amenity((select id from am where n='pool'),'aaaaaaaa-0000-0000-0000-0000000000f3',pg_temp.ist(3,'10:00'))$$, 'P0001', 'amenity_inactive', 'inactive amenity');
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-00000000ad01","role":"authenticated"}', true);
select throws_ok($$select upsert_amenity((select id from am where n='court'),'Hijack',null,'06:00','22:00',60,false,2,null,true)$$, 'P0001', 'not_authorized', 'other society admin cannot edit');

select * from finish();
rollback;
