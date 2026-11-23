-- Migration 0024: poll, event, booking and SOS triggers never block and queue a webhook
-- only with Vault secrets; SOS, polls and bookings are in the realtime publication.
begin;
select plan(13);

insert into societies (id, name) values ('dddddddd-0000-0000-0000-000000000000', 'Society D');
insert into towers (id, society_id, name) values
  ('dddddddd-0000-0000-0000-0000000000a0', 'dddddddd-0000-0000-0000-000000000000', 'TD');
insert into flats (id, society_id, tower_id, number) values
  ('dddddddd-0000-0000-0000-0000000000f1', 'dddddddd-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-0000000000a0', 'D1');
insert into amenities (id, society_id, name, open_time, close_time, slot_minutes, requires_approval) values
  ('dddddddd-0000-0000-0000-0000000000c1', 'dddddddd-0000-0000-0000-000000000000', 'Party hall', '08:00', '22:00', 60, true);

delete from vault.secrets where name in ('notify_url', 'notify_secret', 'service_role_key');

-- 1-8: with Vault secrets absent every write still succeeds and queues nothing
select lives_ok($$insert into polls (id, society_id, question, options, closes_at) values
  ('dddddddd-0000-0000-0000-0000000000d1', 'dddddddd-0000-0000-0000-000000000000', 'Repaint?',
   '[{"id":"11111111-0000-0000-0000-000000000001","label":"Yes"},{"id":"11111111-0000-0000-0000-000000000002","label":"No"}]',
   now() + interval '1 day')$$, 'poll insert succeeds without secrets');
select lives_ok($$update polls set last_reminded_at = now() where id = 'dddddddd-0000-0000-0000-0000000000d1'$$,
  'poll reminder stamp succeeds without secrets');
select lives_ok($$insert into events (id, society_id, title, starts_at) values
  ('dddddddd-0000-0000-0000-0000000000e1', 'dddddddd-0000-0000-0000-000000000000', 'Mela', now() + interval '2 days')$$,
  'event insert succeeds without secrets');
select lives_ok($$insert into amenity_bookings (id, society_id, amenity_id, flat_id, start_at, end_at, status) values
  ('dddddddd-0000-0000-0000-0000000000b1', 'dddddddd-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-0000000000c1',
   'dddddddd-0000-0000-0000-0000000000f1', now() + interval '3 days', now() + interval '3 days 1 hour', 'pending')$$,
  'pending booking insert succeeds without secrets');
select lives_ok($$update amenity_bookings set status = 'rejected', reject_reason = 'Closed'
  where id = 'dddddddd-0000-0000-0000-0000000000b1'$$, 'booking decision succeeds without secrets');
select lives_ok($$insert into sos_alerts (id, society_id, flat_id, type) values
  ('dddddddd-0000-0000-0000-0000000000a1', 'dddddddd-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-0000000000f1', 'medical')$$,
  'SOS insert succeeds without secrets');
select lives_ok($$update sos_alerts set status = 'acknowledged', acknowledged_by_name = 'Ravi', acknowledged_at = now()
  where id = 'dddddddd-0000-0000-0000-0000000000a1'$$, 'SOS acknowledge succeeds without secrets');
select is((select count(*)::int from net.http_request_queue where url = 'http://test.invalid/round3'), 0,
  'nothing queued without secrets');

-- with secrets: each qualifying change queues exactly one webhook
select vault.create_secret('http://test.invalid/round3', 'notify_url');
select vault.create_secret('r3-secret', 'notify_secret');

insert into polls (id, society_id, question, options, closes_at) values
  ('dddddddd-0000-0000-0000-0000000000d2', 'dddddddd-0000-0000-0000-000000000000', 'Gym hours?',
   '[{"id":"11111111-0000-0000-0000-000000000001","label":"Yes"},{"id":"11111111-0000-0000-0000-000000000002","label":"No"}]',
   now() + interval '1 day');
update polls set question = 'Gym hours??' where id = 'dddddddd-0000-0000-0000-0000000000d2';  -- nothing
update polls set last_reminded_at = now() where id = 'dddddddd-0000-0000-0000-0000000000d2';  -- reminder
insert into events (id, society_id, title, starts_at) values
  ('dddddddd-0000-0000-0000-0000000000e2', 'dddddddd-0000-0000-0000-000000000000', 'Yoga', now() + interval '2 days');
insert into amenity_bookings (id, society_id, amenity_id, flat_id, start_at, end_at, status) values
  ('dddddddd-0000-0000-0000-0000000000b2', 'dddddddd-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-0000000000c1',
   'dddddddd-0000-0000-0000-0000000000f1', now() + interval '4 days', now() + interval '4 days 1 hour', 'pending');
insert into amenity_bookings (id, society_id, amenity_id, flat_id, start_at, end_at, status) values
  ('dddddddd-0000-0000-0000-0000000000b3', 'dddddddd-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-0000000000c1',
   'dddddddd-0000-0000-0000-0000000000f1', now() + interval '5 days', now() + interval '5 days 1 hour', 'confirmed');  -- auto-confirmed: nothing
update amenity_bookings set status = 'confirmed' where id = 'dddddddd-0000-0000-0000-0000000000b2';  -- decided
update amenity_bookings set status = 'cancelled' where id = 'dddddddd-0000-0000-0000-0000000000b2';  -- nothing
update sos_alerts set status = 'resolved', resolved_at = now(), resolved_by_name = 'Ravi'
  where id = 'dddddddd-0000-0000-0000-0000000000a1';  -- resolved
insert into sos_alerts (id, society_id, flat_id, type) values
  ('dddddddd-0000-0000-0000-0000000000a2', 'dddddddd-0000-0000-0000-000000000000', 'dddddddd-0000-0000-0000-0000000000f1', 'fire');  -- raised
update sos_alerts set status = 'cancelled' where id = 'dddddddd-0000-0000-0000-0000000000a2';  -- nothing

select is(
  (select array_agg(b->>'table' || ':' || (b->>'type') order by b->>'table', b->>'type')
   from (select convert_from(body, 'utf8')::jsonb b from net.http_request_queue where url = 'http://test.invalid/round3') q),
  array['amenity_bookings:INSERT','amenity_bookings:UPDATE','events:INSERT','polls:INSERT','polls:UPDATE',
        'sos_alerts:INSERT','sos_alerts:UPDATE'],
  'one webhook per qualifying event; auto-confirmed, cancelled and unrelated updates queue nothing');
select is((select count(*)::int from net.http_request_queue where url = 'http://test.invalid/round3'), 7,
  'exactly seven calls queued');
select is(
  (select headers->>'Authorization' from net.http_request_queue where url = 'http://test.invalid/round3' limit 1),
  'Bearer r3-secret', 'webhook sends Bearer <notify_secret>');

select ok(
  (select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public'
     and tablename in ('sos_alerts', 'polls', 'amenity_bookings')) = 3,
  'sos_alerts, polls and amenity_bookings are in the realtime publication');
select ok(exists (select 1 from pg_trigger where tgname = 'sos_alerts_notify_update' and not tgisinternal),
  'SOS update trigger exists');

select * from finish();
rollback;
