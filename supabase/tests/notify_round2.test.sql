-- Migration 0016: helper_attendance and parcels notify triggers never block and only
-- queue a webhook when Vault secrets exist (entry insert, exit, parcel logged/collected).
begin;
select plan(8);

insert into societies (id, name) values ('cccccccc-0000-0000-0000-000000000000', 'Society C');
insert into towers (id, society_id, name) values
  ('cccccccc-0000-0000-0000-0000000000a0', 'cccccccc-0000-0000-0000-000000000000', 'TC');
insert into flats (id, society_id, tower_id, number) values
  ('cccccccc-0000-0000-0000-0000000000f1', 'cccccccc-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-0000000000a0', 'C1');
insert into helpers (id, society_id, name, phone, type, entry_code) values
  ('cccccccc-0000-0000-0000-0000000000e1', 'cccccccc-0000-0000-0000-000000000000', 'Sunita', '+919000000001', 'maid', '123456');
insert into helper_flats (helper_id, flat_id, society_id) values
  ('cccccccc-0000-0000-0000-0000000000e1', 'cccccccc-0000-0000-0000-0000000000f1', 'cccccccc-0000-0000-0000-000000000000');

delete from vault.secrets where name in ('notify_url', 'notify_secret', 'service_role_key');

-- 1-5: with Vault secrets absent every write still succeeds and queues nothing
select lives_ok($$insert into helper_attendance (id, society_id, helper_id) values
  ('cccccccc-0000-0000-0000-0000000000a1', 'cccccccc-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-0000000000e1')$$,
  'attendance insert succeeds without secrets');
select lives_ok($$update helper_attendance set exit_at = now() where id = 'cccccccc-0000-0000-0000-0000000000a1'$$,
  'attendance exit succeeds without secrets');
select lives_ok($$insert into parcels (id, society_id, flat_id, courier) values
  ('cccccccc-0000-0000-0000-0000000000b1', 'cccccccc-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-0000000000f1', 'Amazon')$$,
  'parcel insert succeeds without secrets');
select lives_ok($$update parcels set status = 'collected', collected_at = now(), collected_by_name = 'Ravi'
  where id = 'cccccccc-0000-0000-0000-0000000000b1'$$, 'parcel collect succeeds without secrets');
select is((select count(*)::int from net.http_request_queue where url = 'http://test.invalid/round2'), 0,
  'nothing queued without secrets');

-- with secrets: entry, exit, parcel logged, parcel collected each queue one webhook
select vault.create_secret('http://test.invalid/round2', 'notify_url');
select vault.create_secret('r2-secret', 'notify_secret');

insert into helper_attendance (id, society_id, helper_id) values
  ('cccccccc-0000-0000-0000-0000000000a2', 'cccccccc-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-0000000000e1');
update helper_attendance set exit_at = now() where id = 'cccccccc-0000-0000-0000-0000000000a2';
insert into parcels (id, society_id, flat_id, courier) values
  ('cccccccc-0000-0000-0000-0000000000b2', 'cccccccc-0000-0000-0000-000000000000', 'cccccccc-0000-0000-0000-0000000000f1', 'Flipkart');
update parcels set note = 'fragile' where id = 'cccccccc-0000-0000-0000-0000000000b2';
update parcels set status = 'collected', collected_at = now(), collected_by_name = 'Ravi'
  where id = 'cccccccc-0000-0000-0000-0000000000b2';

select is(
  (select array_agg(b->>'table' || ':' || (b->>'type') order by b->>'table', b->>'type')
   from (select convert_from(body, 'utf8')::jsonb b from net.http_request_queue where url = 'http://test.invalid/round2') q),
  array['helper_attendance:INSERT','helper_attendance:UPDATE','parcels:INSERT','parcels:UPDATE'],
  'one webhook per event; non-collect parcel update queues nothing');
select is((select count(*)::int from net.http_request_queue where url = 'http://test.invalid/round2'), 4,
  'exactly four calls queued');
select is(
  (select headers->>'Authorization' from net.http_request_queue where url = 'http://test.invalid/round2' limit 1),
  'Bearer r2-secret', 'webhook sends Bearer <notify_secret>');

select * from finish();
rollback;
